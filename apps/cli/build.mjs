import { build } from 'esbuild'
import { access, cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, 'dist')
const webDist = join(root, '..', 'web', 'dist')

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

try {
  await access(webDist)
} catch {
  console.error('apps/web/dist was not found. Run "npm run build" from the repository root.')
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: join(outDir, 'index.js'),

  external: ['@playwright/test', 'playwright-core', 'fastify', '@fastify/static'],
  banner: { js: '#!/usr/bin/env node' },
  define: { __LAZYSCOUT_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  minify: false
})

await cp(webDist, join(outDir, 'web'), { recursive: true })

console.log(`Build completed: ${outDir}`)
