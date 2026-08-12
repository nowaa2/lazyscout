import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const npmCommand = process.platform === 'win32' ? process.env.ComSpec : 'npm'
const npmArguments = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', 'pack'] : ['pack']
const cliPackage = JSON.parse(readFileSync(join(root, 'apps', 'cli', 'package.json'), 'utf8'))
const distEntry = join(root, 'apps', 'cli', 'dist', 'index.js')

if (!existsSync(distEntry)) {
  throw new Error('apps/cli/dist/index.js was not found. Run npm run build first.')
}

const source = readFileSync(distEntry, 'utf8')
if (/from\s+["'][^"']+\.ts["']|import\s*\(\s*["'][^"']+\.ts["']/.test(source)) {
  throw new Error('The published CLI contains a runtime TypeScript import.')
}

const archive = execFileSync(
  npmCommand,
  [...npmArguments, '--workspace', 'lazyscout', '--pack-destination', root, '--json'],
  {
    cwd: root,
    encoding: 'utf8'
  }
)
const packageInfo = JSON.parse(archive)[0]
const archivePath = join(root, packageInfo.filename)

try {
  execFileSync(process.execPath, [distEntry, '--version'], { cwd: root, stdio: 'inherit' })
  if (!packageInfo.filename.endsWith(`${cliPackage.version}.tgz`)) {
    throw new Error(`Unexpected package archive: ${packageInfo.filename}`)
  }
} finally {
  rmSync(archivePath, { force: true })
}

console.log(`npm package smoke check passed for lazyscout@${cliPackage.version}`)
