import assert from 'node:assert/strict'
import { access, readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requiredFiles = [
  '.nojekyll',
  'CNAME',
  'app.js',
  'assets/og.png',
  'assets/writersstudio-icon.png',
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'styles.css'
]

for (const file of requiredFiles) await access(resolve(repositoryRoot, file))

const html = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8')
const css = await readFile(resolve(repositoryRoot, 'styles.css'), 'utf8')
const cname = (await readFile(resolve(repositoryRoot, 'CNAME'), 'utf8')).trim()
const robots = await readFile(resolve(repositoryRoot, 'robots.txt'), 'utf8')
const sitemap = await readFile(resolve(repositoryRoot, 'sitemap.xml'), 'utf8')

const requiredHtmlPatterns = [
  /<!doctype html>/iu,
  /<html lang="en">/u,
  /<meta name="viewport"/u,
  /<meta\s+name="description"/u,
  /<link rel="canonical" href="https:\/\/writersstudio\.app\/"/u,
  /<meta property="og:image" content="https:\/\/writersstudio\.app\/assets\/og\.png"/u,
  /<main id="main-content">/u,
  /<h1 id="hero-title">/u,
  /id="download"/u,
  /role="tablist"/u,
  /role="tabpanel"/u,
  /data-release-menu-button/u,
  /Free forever on desktop/u,
  /Git-powered autosaves and story branches/u,
  /Every version\. Zero terminal\./u,
  /Desktop stays free\./u
]

for (const pattern of requiredHtmlPatterns) {
  assert(pattern.test(html), `Required HTML contract is missing: ${pattern}`)
}
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u)
assert.match(css, /@media \(forced-colors: active\)/u)
assert.match(css, /scrollbar-color/u)
assert.equal(cname, 'writersstudio.app')
assert.match(robots, /Sitemap: https:\/\/writersstudio\.app\/sitemap\.xml/u)
assert.match(sitemap, /<loc>https:\/\/writersstudio\.app\/<\/loc>/u)

const ids = new Set([...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]))
assert.equal(ids.size, [...html.matchAll(/\sid="([^"]+)"/gu)].length, 'HTML ids must be unique.')
for (const match of html.matchAll(/\saria-controls="([^"]+)"/gu)) {
  assert(ids.has(match[1]), `aria-controls target does not exist: ${match[1]}`)
}

const localReferences = new Set()
for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/gu)) {
  const value = match[1]
  if (/^(?:#|https?:|mailto:)/u.test(value)) continue
  localReferences.add(value.split(/[?#]/u)[0])
}

for (const reference of localReferences) {
  const target = resolve(repositoryRoot, reference)
  assert(target.startsWith(repositoryRoot), `Reference escapes repository: ${reference}`)
  const targetStats = await stat(target)
  if (extname(reference) === '') assert(targetStats.isDirectory(), `Expected a directory: ${reference}`)
}

const png = await readFile(resolve(repositoryRoot, 'assets/og.png'))
assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'Social card must be a PNG.')
assert.equal(png.readUInt32BE(16), 1200, 'Social card width must be 1200px.')
assert.equal(png.readUInt32BE(20), 630, 'Social card height must be 630px.')

console.log(`Site contract passed · ${requiredFiles.length} required files · ${localReferences.size} local references.`)
