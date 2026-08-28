import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = resolve(repositoryRoot, 'index.html')
const catalog = JSON.parse(await readFile(resolve(repositoryRoot, 'locales.json'), 'utf8'))
const messages = catalog.locales[catalog.defaultLocale]?.messages

if (!messages) throw new Error(`Default locale is missing: ${catalog.defaultLocale}`)

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const elementPattern = /(?<opening><(?<tag>[a-z][a-z0-9-]*)\b[^>]*\bdata-i18n="(?<key>[^"]+)"[^>]*>)(?<body>[\s\S]*?)(?<closing><\/\k<tag>>)/giu
const html = await readFile(indexPath, 'utf8')
let replacements = 0

const synchronized = html.replace(elementPattern, (match, ...argumentsAfterMatch) => {
  const groups = argumentsAfterMatch.at(-1)
  const message = messages[groups.key]
  if (typeof message !== 'string') throw new Error(`Missing default translation: ${groups.key}`)
  if (/<[a-z][^>]*>/iu.test(groups.body)) {
    throw new Error(`Default-locale sync only supports leaf elements: ${groups.key}`)
  }

  const leadingWhitespace = groups.body.match(/^\s*/u)?.[0] ?? ''
  const trailingWhitespace = groups.body.match(/\s*$/u)?.[0] ?? ''
  const nextBody = `${leadingWhitespace}${escapeHtml(message)}${trailingWhitespace}`
  if (nextBody === groups.body) return match
  replacements += 1
  return `${groups.opening}${nextBody}${groups.closing}`
})

await writeFile(indexPath, synchronized, 'utf8')
console.log(`Default locale synchronized · ${replacements} text nodes updated.`)
