import assert from 'node:assert/strict'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requiredFiles = [
  '.nojekyll',
  'CNAME',
  'README.md',
  'app.js',
  'assets/og.png',
  'assets/writersstudio-icon.png',
  'index.html',
  'locales.json',
  'robots.txt',
  'sitemap.xml',
  'styles.css'
]

const requiredScreenshotFiles = [
  'writersstudio-characters-dark.webp',
  'writersstudio-characters-light.webp',
  'writersstudio-history-dark.webp',
  'writersstudio-history-light.webp',
  'writersstudio-manuscript-dark.webp',
  'writersstudio-manuscript-light.webp',
  'writersstudio-onboarding-arrange-dark.webp',
  'writersstudio-onboarding-arrange-light.webp',
  'writersstudio-onboarding-search-light.webp',
  'writersstudio-onboarding-split-dark.webp',
  'writersstudio-onboarding-split-light.webp',
  'writersstudio-search-light.webp',
  'writersstudio-search-replace-dark.webp',
  'writersstudio-search-replace-light.webp',
  'writersstudio-split-workspace-dark.webp',
  'writersstudio-split-workspace-light.webp',
  'writersstudio-timeline-dark.webp',
  'writersstudio-timeline-light.webp'
]

for (const file of requiredFiles) await access(resolve(repositoryRoot, file))

const html = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8')
const readme = await readFile(resolve(repositoryRoot, 'README.md'), 'utf8')
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
  /data-language-picker/u,
  /data-language-option="ru"/u,
  /data-language-option="es"/u,
  /class="utility-controls"/u,
  /<a class="text-link" href="#inside"><span data-i18n="hero\.seeHow">/u,
  /<a class="scroll-cue" href="#inside">/u,
  /<section class="trust-strip" id="inside"/u,
  /data-i18n="final\.titleSecond">from scratch\.<\/span>/u,
  /data-i18n="final\.startNote">Choose Empty project when WritersStudio opens\./u,
  /data-theme-toggle/u,
  /class="theme-shot theme-shot-light"/u,
  /class="theme-shot theme-shot-dark"/u,
  /The desktop app is free and will stay free/u,
  /Every project keeps its own version history/u,
  /Autosave without giving up the past\./u,
  /The desktop app is free\./u,
  /data-i18n="download\.earlyAccess">Early access/u,
  /data-i18n="hero\.historyDisclaimer">Illustrative demo\./u,
  /data-i18n="cloud\.status">TO BE DONE</u
]

for (const pattern of requiredHtmlPatterns) {
  assert(pattern.test(html), `Required HTML contract is missing: ${pattern}`)
}
assert.doesNotMatch(html, /samples\/pride-and-prejudice/u, 'The landing must not link to the removed embedded sample.')
assert.doesNotMatch(html, /data-i18n="split\.sample"/u, 'The obsolete inline sample action must stay removed.')
assert.doesNotMatch(
  html,
  /WritersStudio_sample_project|data-i18n="(?:final|footer)\.sample/u,
  'The landing must not advertise or link to the standalone sample project.'
)
assert.match(readme, /https:\/\/github\.com\/TrinkieYinkie\/WritersStudio_sample_project/u)
await assert.rejects(
  access(resolve(repositoryRoot, 'samples/pride-and-prejudice')),
  'The embedded sample directory must not remain in the releases repository.'
)
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u)
assert.match(css, /@media \(forced-colors: active\)/u)
assert.match(css, /scrollbar-color/u)
for (const viewportContract of [
  /@media \(min-width: 1440px\)/u,
  /@media \(max-width: 1050px\)/u,
  /@media \(max-width: 820px\)/u,
  /@media \(max-width: 650px\)/u,
  /@media \(max-width: 520px\)/u,
  /@media \(max-height: 700px\) and \(min-width: 821px\)/u
]) {
  assert.match(css, viewportContract, `Responsive contract is missing: ${viewportContract}`)
}
assert.match(css, /min-width:\s*320px/u)
assert.match(css, /overflow-x:\s*hidden/u)
assert.match(css, /\.utility-controls\s*\{/u)
assert.match(css, /\.scroll-cue\s*\{[^}]*bottom:\s*clamp\(2\.1rem,\s*3vh,\s*2\.75rem\)/su)
assert.match(css, /\.hero-promises\s*\{[^}]*flex-direction:\s*column/su)
assert.match(css, /\.hero-actions \.text-link\s*\{[^}]*opacity:\s*0\.68/su)
assert.match(css, /\.trust-strip\s*\{[^}]*scroll-margin-top:\s*5\.25rem/su)
assert.match(css, /\.eyebrow > span\[aria-hidden="true"\]/u)
assert.match(css, /\.hero-promises li > span\[aria-hidden="true"\]/u)
assert.doesNotMatch(css, /\.eyebrow span\s*\{/u, 'Translation wrappers must not inherit the eyebrow marker geometry.')
assert.doesNotMatch(css, /\.hero-promises span\s*\{/u, 'Translation wrappers must not inherit promise-check styling.')
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

for (const match of readme.matchAll(/\s(?:src|srcset)="([^"]+)"/gu)) {
  const reference = match[1].replace(/^\.\//u, '')
  const target = resolve(repositoryRoot, reference)
  assert(target.startsWith(repositoryRoot), `README reference escapes repository: ${reference}`)
  await access(target)
}

const screenshotDirectory = resolve(repositoryRoot, 'assets/screenshots')
const screenshotNames = await readdir(screenshotDirectory)
assert.equal(
  screenshotNames.filter((name) => /-copy\.webp$/u.test(name)).length,
  0,
  'Accidental -copy screenshot duplicates must not be committed.'
)
for (const file of requiredScreenshotFiles) {
  const target = resolve(screenshotDirectory, file)
  const webp = await readFile(target)
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF', `${file} must have a RIFF header.`)
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP', `${file} must be a WebP image.`)
  assert(webp.byteLength < 500_000, `${file} should stay below 500 KB.`)
}

const png = await readFile(resolve(repositoryRoot, 'assets/og.png'))
assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'Social card must be a PNG.')
assert.equal(png.readUInt32BE(16), 1200, 'Social card width must be 1200px.')
assert.equal(png.readUInt32BE(20), 630, 'Social card height must be 630px.')

console.log(`Site contract passed · ${requiredFiles.length} required files · ${requiredScreenshotFiles.length} product captures · ${localReferences.size} local references.`)
