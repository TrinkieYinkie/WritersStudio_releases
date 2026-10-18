import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { landingActionForLink } from '../landing-analytics.js'
import { landingAnalyticsConfig as config } from '../landing-analytics-config.js'

export async function runLandingPageTests() {
  const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8')
  const html = await read('index.html'), app = await read('app.js')
  const copy = JSON.parse(await read('docs/contracts/landing-analytics-v2.ui-copy.json'))
  let locales
  if (config.downloadSection === '#platforms') {
    await import('../locales.js'); locales = globalThis.YinkieLocales
    assert.match(html, /type="module" src="analytics.js"/u)
    assert.match(await read('analytics.js'), /initializeWebsiteStatistics/u)
    assert.doesNotMatch(html, /data-analytics-download/u)
  } else {
    const catalog = JSON.parse(await read('locales.json'))
    locales = Object.fromEntries(Object.entries(catalog.locales).map(([locale, value]) => [locale, value.messages]))
    assert.match(app, /import\('\.\/landing-analytics-ui\.js'\)[\s\S]*?\.catch\(\(\) => \{\}\)/u)
    assert.match(app, /statisticsPlacement = 'release-older'/u)
  }
  for (const [locale, messages] of Object.entries(copy)) {
    for (const [key, value] of Object.entries(messages)) assert.equal(locales[locale][key], value, locale + ':' + key)
  }
  assert.match(html, /id="website-statistics"/u)
  assert.match(html, /aria-live="polite"/u)
  assert.match(html, /<dialog[^>]*data-statistics-dialog[^>]*aria-labelledby="statistics-title"/u)
  assert.equal((html.match(/data-statistics-category=/gu) ?? []).length, 3)
  assert.doesNotMatch(html, /<input[^>]*data-statistics-category[^>]*checked/u)
  for (const action of ['accept', 'reject', 'configure', 'save']) assert.match(html, new RegExp('data-statistics-' + action, 'u'))
  assert.match(html, /data-statistics-open/u)
  assert.doesNotMatch(html, /data-statistics-toggle/u)
  assert.doesNotMatch(html, /without visitor IDs|No individual browsing history/u)
  const actions = []
  for (const match of html.matchAll(/<a\b[^>]+>/gu)) {
    const tag = match[0]
    const attr = name => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1]
    const kind = attr('data-statistics-link')
    if (!kind) continue
    const action = landingActionForLink({ kind, placement: attr('data-statistics-placement'),
      platform: attr('data-statistics-platform'), href: attr('href') }, config)
    assert.ok(action, 'Invalid or stale link marker: ' + tag)
    actions.push(action)
  }
  assert.ok(actions.some(action => action.properties.action === 'open-download-section'))
  assert.ok(actions.some(action => action.properties.action === 'open-releases'))
  assert.ok(actions.some(action => action.properties.destination === 'support-email'))
  if (config.webOrigin) assert.ok(actions.some(action => action.properties.destination === 'web-app'))
  console.log(`PASS page integration: ${actions.length} exact link owners, shared EN/RU/ES copy, accessible explicit consent and isolated v2 entry point.`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runLandingPageTests()
