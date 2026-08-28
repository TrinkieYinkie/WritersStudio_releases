import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(resolve(repositoryRoot, 'index.html'), 'utf8')
const catalog = JSON.parse(await readFile(resolve(repositoryRoot, 'locales.json'), 'utf8'))
const expectedLocales = ['en', 'ru', 'es']

assert.equal(catalog.version, 1, 'The localization catalog version must be 1.')
assert.equal(catalog.defaultLocale, 'en', 'English must remain the default locale.')
assert.deepEqual(catalog.supportedLocales, expectedLocales, 'Supported locales must be English, Russian, and Spanish.')

const htmlKeys = new Set(
  [...html.matchAll(/data-i18n(?:-aria-label|-alt)?="([^"]+)"/gu)].map((match) => match[1])
)
const referenceKeys = Object.keys(catalog.locales.en.messages).sort()
const templateTokens = (value) => [...value.matchAll(/\{([a-z][a-z0-9]*)\}/giu)].map((match) => match[1]).sort()

for (const locale of expectedLocales) {
  const entry = catalog.locales[locale]
  assert(entry && typeof entry === 'object', `Missing locale entry: ${locale}`)
  assert.equal(typeof entry.label, 'string', `Missing label for ${locale}`)
  assert.match(entry.shortLabel, /^[A-Z]{2}$/u, `Short label for ${locale} must contain two uppercase letters.`)
  assert.equal(typeof entry.pageTitle, 'string', `Missing page title for ${locale}`)
  assert.equal(typeof entry.pageDescription, 'string', `Missing page description for ${locale}`)
  assert(entry.messages && typeof entry.messages === 'object', `Missing messages for ${locale}`)

  const keys = Object.keys(entry.messages).sort()
  assert.deepEqual(keys, referenceKeys, `Message keys differ for ${locale}.`)
  for (const key of htmlKeys) assert(key in entry.messages, `${locale} is missing HTML translation key: ${key}`)
  for (const key of referenceKeys) {
    const value = entry.messages[key]
    assert.equal(typeof value, 'string', `${locale}.${key} must be a string.`)
    assert(value.trim().length > 0, `${locale}.${key} must not be empty.`)
    assert.deepEqual(
      templateTokens(value),
      templateTokens(catalog.locales.en.messages[key]),
      `Template variables differ for ${locale}.${key}.`
    )
  }
}

console.log(`Localization catalog passed · ${expectedLocales.length} locales · ${referenceKeys.length} synchronized messages.`)
