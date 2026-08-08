

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), 'demo-site')
const port = Number(process.env.DEMO_PORT ?? 5500)

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`)
  if (url.pathname === '/api/health.json') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({ status: 'ok', service: 'lazyshop-demo', version: '1.0.0' }))
    return
  }
  const name = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\
  const file = normalize(join(root, name.includes('.') ? name : `${name}.html`))

  if (!file.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const content = await readFile(file)
    const contentType = file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'
    response.writeHead(200, { 'Content-Type': contentType }).end(content)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>404 Not Found</h1>')
  }
}).listen(port, () => console.log(`Demo site: http://localhost:${port}`))
