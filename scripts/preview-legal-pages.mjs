import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const owner = JSON.parse(await readFile(resolve(root, '.test-out/validation/writersstudio-site-full.lock'), 'utf8'))
if (owner.pid !== process.ppid || owner.token !== 'writersstudio-site-full') {
  throw new Error('Run the preview through scripts/validation-plans/legal-preview.json.')
}
let server
let heartbeat
let timeout
let close
try {
  const data = JSON.parse(await readFile(resolve(root, 'legal/documents.json'), 'utf8'))
  const pages = new Map()
  const add = async (route, file, type) => pages.set(route, { body: await readFile(resolve(root, file)), type })
  for (const kind of ['terms', 'privacy']) {
    for (const version of ['', '2026-10-14/', data.version + '/']) {
      for (const locale of ['', 'ru/', 'es/']) {
        const route = kind + '/' + version + locale
        await add('/' + route, route + 'index.html', 'text/html; charset=utf-8')
      }
    }
  }
  await add('/styles.css', 'styles.css', 'text/css; charset=utf-8')
  await add('/legal.css', 'legal.css', 'text/css; charset=utf-8')
  await add('/legal.js', 'legal.js', 'text/javascript; charset=utf-8')
  await add('/assets/writersstudio-icon.png', 'assets/writersstudio-icon.png', 'image/png')
  server = createServer((request, response) => {
    const page = pages.get(request.url)
    if (request.method !== 'GET' || !page) { response.writeHead(404).end(); return }
    response.writeHead(200, {
      'Content-Type': page.type, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    }).end(page.body)
  })
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
  console.log('Legal-only preview: http://127.0.0.1:' + server.address().port + '/privacy/ru/ (closes in 3 minutes)')
  await new Promise(done => {
    let closing = false
    close = () => {
      if (closing) return
      closing = true
      server.closeAllConnections()
      server.close(done)
    }
    process.once('SIGINT', close)
    process.once('SIGTERM', close)
    timeout = setTimeout(close, 180_000)
    heartbeat = setInterval(() => console.log('[legal-preview] pid=' + process.pid + ' ' + new Date().toISOString()), 15_000)
  })
} finally {
  clearInterval(heartbeat)
  clearTimeout(timeout)
  if (close) {
    process.removeListener('SIGINT', close)
    process.removeListener('SIGTERM', close)
  }
  if (server?.listening) {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
  }
}
