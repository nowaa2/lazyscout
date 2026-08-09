import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const PACKAGE_NAME = 'lazyscout'
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const CACHE_TTL_MS = 60_000

type RegistryPackage = {
  versions?: Record<string, unknown>
  'dist-tags'?: Record<string, string>
  time?: Record<string, string>
}

type PublishedVersion = {
  version: string
  tags: string[]
  publishedAt?: string
}

type RegistryVersions = {
  latestVersion?: string
  versions: PublishedVersion[]
}

let registryCache: { expiresAt: number; value: RegistryVersions } | undefined
let installInProgress = false

function compareVersions(left: string, right: string): number {
  const [leftMain, leftPre] = left.split('-', 2)
  const [rightMain, rightPre] = right.split('-', 2)
  const leftParts = leftMain.split('.').map(Number)
  const rightParts = rightMain.split('.').map(Number)

  for (let index = 0; index < 3; index++) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }

  if (!leftPre && rightPre) return 1
  if (leftPre && !rightPre) return -1
  return (leftPre ?? '').localeCompare(rightPre ?? '', undefined, { numeric: true })
}

async function fetchPublishedVersions(force = false): Promise<RegistryVersions> {
  if (!force && registryCache && registryCache.expiresAt > Date.now()) return registryCache.value

  const response = await fetch(REGISTRY_URL, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(8_000)
  })
  if (!response.ok) throw new Error(`npm Registry returned HTTP ${response.status}.`)

  const body = (await response.json()) as RegistryPackage
  const tags = body['dist-tags'] ?? {}
  const versions = Object.keys(body.versions ?? {})
    .filter((version) => VERSION_PATTERN.test(version))
    .sort((left, right) => compareVersions(right, left))
    .slice(0, 20)
    .map((version) => ({
      version,
      tags: Object.entries(tags)
        .filter(([, taggedVersion]) => taggedVersion === version)
        .map(([tag]) => tag),
      publishedAt: body.time?.[version]
    }))
  const value = { latestVersion: tags.latest, versions }
  registryCache = { expiresAt: Date.now() + CACHE_TTL_MS, value }
  return value
}

async function findNpmCli(): Promise<string> {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js') : undefined,
    '/usr/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js'
  ].filter((value): value is string => Boolean(value?.endsWith('.js')))

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {}
  }
  throw new Error('Could not locate npm-cli.js. Copy the install command and run it in a terminal instead.')
}

async function runNpmInstall(version: string): Promise<string> {
  const npmCli = await findNpmCli()
  return new Promise((resolve, reject) => {
    const commandArgs = [npmCli, 'install', '--global', `${PACKAGE_NAME}@${version}`, '--no-audit', '--no-fund']
    const child = spawn(process.execPath, commandArgs, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    let settled = false
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString()}`.slice(-12_000)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error('npm installation timed out after 5 minutes.'))
    }, 300_000)
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code === 0) resolve(output.trim())
      else reject(new Error(output.trim() || `npm exited with code ${code ?? 'unknown'}.`))
    })
  })
}

export function registerVersionRoutes(app: FastifyInstance, currentVersion: string): void {
  app.get('/api/versions', async (_request, reply) => {
    try {
      const published = await fetchPublishedVersions()
      return reply.send({
        packageName: PACKAGE_NAME,
        currentVersion,
        latestVersion: published.latestVersion,
        updateAvailable: Boolean(
          published.latestVersion && compareVersions(published.latestVersion, currentVersion) > 0
        ),
        registryAvailable: true,
        versions: published.versions
      })
    } catch (error) {
      return reply.send({
        packageName: PACKAGE_NAME,
        currentVersion,
        updateAvailable: false,
        registryAvailable: false,
        versions: VERSION_PATTERN.test(currentVersion) ? [{ version: currentVersion, tags: ['current'] }] : [],
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })

  app.post('/api/versions/install', async (request, reply) => {
    const body = (request.body ?? {}) as { version?: unknown }
    if (typeof body.version !== 'string' || !VERSION_PATTERN.test(body.version)) {
      return reply.status(400).send({
        error: { code: 'invalid-version', message: 'Select a valid published LazyScout version.' }
      })
    }
    if (installInProgress) {
      return reply.status(409).send({
        error: { code: 'install-in-progress', message: 'Another LazyScout installation is still running.' }
      })
    }

    installInProgress = true
    try {
      const published = await fetchPublishedVersions(true)
      if (!published.versions.some((item) => item.version === body.version)) {
        return reply.status(400).send({
          error: { code: 'unknown-version', message: 'That version is not available from npm Registry.' }
        })
      }
      const output = await runNpmInstall(body.version)
      return reply.send({
        installedVersion: body.version,
        command: `npm install -g ${PACKAGE_NAME}@${body.version}`,
        output
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return reply.status(500).send({
        error: {
          code: 'install-failed',
          message: `Could not install LazyScout v${body.version}.`,
          hint: message
        }
      })
    } finally {
      installInProgress = false
    }
  })
}
