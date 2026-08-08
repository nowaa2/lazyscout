// รวมโค้ดของทุก workspace package ให้เป็นไฟล์เดียว เพื่อให้ publish ขึ้น npm เป็น package เดียวได้
// (dependency ภายนอกยังคงเป็น dependency ปกติ ไม่ถูก bundle เข้ามา)
import { build } from 'esbuild'
import { access, cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, 'dist')
const webDist = join(root, '..', 'web', 'dist')

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

// ถ้าไม่ build หน้าเว็บก่อน แพ็กเกจจะออกมาโดยไม่มี UI — ต้องหยุดตั้งแต่ตรงนี้
try {
  await access(webDist)
} catch {
  console.error('ไม่พบ apps/web/dist — ให้รัน "npm run build" จาก root ของ repo แทน')
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
  // ทั้งสามตัวนี้ต้องเป็น dependency จริง: playwright-core มีไบนารี ส่วน fastify ใช้ dynamic require
  external: ['playwright-core', 'fastify', '@fastify/static'],
  banner: { js: '#!/usr/bin/env node' },
  define: { __LAZYSCOUT_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  minify: false
})

// คัดลอกหน้าเว็บที่ build แล้วไปไว้ที่ dist/web ให้ Fastify เสิร์ฟ
await cp(webDist, join(outDir, 'web'), { recursive: true })

console.log(`build เสร็จแล้ว: ${outDir}`)
