// เว็บไซต์ตัวอย่างสำหรับทดสอบ LazyScout (ไม่มี dependency)
// รัน: node fixtures/serve.mjs  ->  http://localhost:5500
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), 'demo-site')
const port = Number(process.env.DEMO_PORT ?? 5500)

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`)
  const name = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '')
  const file = normalize(join(root, name.endsWith('.html') ? name : `${name}.html`))

  if (!file.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const html = await readFile(file)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>404 Not Found</h1>')
  }
}).listen(port, () => console.log(`Demo site: http://localhost:${port}`))
