import { constants } from 'node:fs'
import { access, open, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const lockPath = join(repositoryRoot, 'scripts', '.landing-preview.lock')
const port = Number.parseInt(process.env.WRITERSSTUDIO_SITE_PORT ?? '4173', 10)
const host = '127.0.0.1'
const maximumLifetimeMilliseconds = 30 * 60 * 1000

if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error('WRITERSSTUDIO_SITE_PORT must be an integer between 1024 and 65535.')
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml; charset=utf-8']
])

let lockHandle
let heartbeat
let lifetime
let closing = false

function requestPath(url) {
  const pathname = new URL(url ?? '/', `http://${host}:${port}`).pathname
  const decoded = decodeURIComponent(pathname)
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const candidate = resolve(repositoryRoot, normalize(relative))
  if (candidate !== repositoryRoot && !candidate.startsWith(`${repositoryRoot}${sep}`)) {
    return undefined
  }
  return candidate
}

async function sendFile(response, filePath) {
  let resolvedPath = filePath
  const fileStats = await stat(resolvedPath)
  if (fileStats.isDirectory()) resolvedPath = join(resolvedPath, 'index.html')
  await access(resolvedPath, constants.R_OK)
  const body = await readFile(resolvedPath)
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': body.byteLength,
    'Content-Type': contentTypes.get(extname(resolvedPath).toLowerCase()) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  })
  response.end(body)
}

const server = createServer(async (request, response) => {
  const filePath = requestPath(request.url)
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Bad request')
    return
  }

  try {
    await sendFile(response, filePath)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

async function cleanup(exitCode = 0) {
  if (closing) return
  closing = true
  clearInterval(heartbeat)
  clearTimeout(lifetime)
  server.closeAllConnections?.()
  await new Promise((resolveClose) => server.close(resolveClose))
  await lockHandle?.close()
  await rm(lockPath, { force: true })
  process.exitCode = exitCode
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => void cleanup(0))
}

process.once('uncaughtException', async (error) => {
  console.error(error)
  await cleanup(1)
})

try {
  lockHandle = await open(lockPath, 'wx')
  await lockHandle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`)
} catch (error) {
  if (error?.code === 'EEXIST') {
    throw new Error(`A WritersStudio site preview already owns ${lockPath}.`)
  }
  throw error
}

server.listen(port, host, () => {
  console.log(`WritersStudio site preview: http://${host}:${port}/`)
  console.log(`Preview owner: pid=${process.pid}; maximum lifetime=30 minutes`)
})

heartbeat = setInterval(() => {
  console.log(`[preview heartbeat] ${new Date().toISOString()} pid=${process.pid}`)
}, 30_000)
heartbeat.unref()

lifetime = setTimeout(() => {
  console.error('Preview reached its 30 minute lifetime and is shutting down.')
  void cleanup(0)
}, maximumLifetimeMilliseconds)
lifetime.unref()
