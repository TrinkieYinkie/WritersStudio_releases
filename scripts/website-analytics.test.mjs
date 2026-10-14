import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWebsiteStatistics, isStatisticsEvent, statisticsEventForLink,
  statisticsPreferenceKey, statisticsEndpoint, statisticsOrigin } from '../website-analytics.js'
import { websiteAnalyticsConfig } from '../website-analytics-config.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const view = { name: 'landing_page_viewed', page: 'home' }
function harness(overrides = {}) {
  const values = new Map()
  const calls = []
  const timers = new Map()
  let nextTimer = 0
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const client = createWebsiteStatistics({
    config: { ...websiteAnalyticsConfig, enabled: true }, origin: statisticsOrigin,
    storage, privacySignal: () => false,
    fetch: (...args) => { calls.push(args); return Promise.resolve({ ok: true }) },
    setTimeout: (callback, duration) => { assert.equal(duration, 3000); timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: id => timers.delete(id), ...overrides
  })
  return { client, values, calls, timers, storage }
}

test('production is disabled and previews never send even if the build switch is enabled', () => {
  assert.equal(websiteAnalyticsConfig.enabled, false)
  for (const overrides of [
    { config: websiteAnalyticsConfig }, { origin: 'http://127.0.0.1:4173' },
    { origin: 'https://preview.writersstudio.app' }, { origin: 'null' },
    { config: { ...websiteAnalyticsConfig, enabled: true, endpoint: 'https://attacker.invalid/' } },
    { config: { ...websiteAnalyticsConfig, enabled: true, origin: 'https://attacker.invalid' } }
  ]) {
    const h = harness(overrides)
    assert.equal(h.client.pageView(), false)
    assert.equal(h.calls.length, 0)
  }
})

test('one view per document, no IDs, timestamps, URLs or storage writes', async () => {
  const h = harness()
  assert.equal(h.client.pageView(), true)
  assert.equal(h.client.pageView(), false)
  await tick()
  h.client.exclude(true)
  h.client.exclude(false)
  assert.equal(h.client.pageView(), false)
  assert.equal(h.calls.length, 1)
  assert.equal(h.values.size, 0)
  assert.deepEqual(JSON.parse(h.calls[0][1].body), {
    schemaVersion: 1, site: 'writersstudio', surface: 'landing', event: view
  })
  const [, options] = h.calls[0]
  assert.equal(h.calls[0][0], statisticsEndpoint)
  for (const [key, value] of Object.entries({ credentials: 'omit', referrerPolicy: 'no-referrer',
    redirect: 'error', cache: 'no-store', keepalive: true, mode: 'cors', method: 'POST' })) assert.equal(options[key], value)
  assert.deepEqual(options.headers, { 'Content-Type': 'application/json' })
  assert.equal(h.timers.size, 0)
})

test('persisted opt-out, corrupt preference, privacy signal and storage failures all stop collection', () => {
  for (const flag of ['off', '', 'corrupt', '{"visitorId":"secret"}']) {
    const h = harness()
    h.values.set(statisticsPreferenceKey, flag)
    assert.equal(h.client.pageView(), false)
    assert.equal(h.client.status(), 'excluded')
  }
  for (const overrides of [{ privacySignal: () => true }, { storage: { getItem() { throw Error('blocked') } } }]) {
    const h = harness(overrides)
    assert.equal(h.client.pageView(), false)
    assert.equal(h.calls.length, 0)
  }
})

test('withdrawal aborts pending requests, saves only off, supports cross-tab revocation', () => {
  let signal
  const h = harness({ fetch: (_, options) => { signal = options.signal; return new Promise(() => {}) } })
  assert.equal(h.client.pageView(), true)
  assert.equal(h.client.exclude(true), 'excluded')
  assert.equal(signal.aborted, true)
  assert.deepEqual([...h.values], [[statisticsPreferenceKey, 'off']])
  assert.equal(h.client.record(view), false)
  assert.equal(h.timers.size, 0)
  h.client.exclude(false)
  h.client.record(view)
  h.values.set(statisticsPreferenceKey, 'off')
  assert.equal(h.client.synchronize(), 'excluded')
  assert.equal(signal.aborted, true)
  h.values.clear()
  assert.equal(h.client.status(), 'active')
})

test('failed opt-out persistence still excludes the current page; destruction aborts requests', () => {
  const h = harness({ storage: { getItem: () => null, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } } })
  assert.equal(h.client.exclude(true), 'excluded')
  assert.equal(h.client.pageView(), false)
  assert.equal(h.client.exclude(false), 'excluded')
  const active = harness()
  active.client.pageView()
  active.client.dispose()
  assert.equal(active.calls[0][1].signal.aborted, true)
  assert.equal(active.client.record(view), false)
})

test('bounded concurrency, 3-second abort, no queue and 30 attempts per document', async () => {
  const h = harness({ fetch: () => new Promise(() => {}) })
  for (let i = 0; i < 4; i++) assert.equal(h.client.record(view), true)
  assert.equal(h.client.record(view), false)
  for (const callback of [...h.timers.values()]) callback()
  assert.equal(h.client.record(view), true)
  h.client.dispose()
  const capped = harness()
  for (let i = 0; i < 30; i++) { assert.equal(capped.client.record(view), true); await tick() }
  assert.equal(capped.client.record(view), false)
  assert.equal(capped.calls.length, 30)
})

test('network throws, rejection and unsuccessful HTTP responses never escape or retry', async () => {
  for (const send of [() => { throw Error('offline') }, () => Promise.reject(Error('offline')),
    () => Promise.resolve({ ok: false, status: 429 })]) {
    let count = 0
    const h = harness({ fetch: (...args) => { count++; return send(...args) } })
    assert.doesNotThrow(() => h.client.pageView())
    await tick()
    assert.equal(count, 1)
    assert.equal(h.timers.size, 0)
    assert.equal(h.client.pageView(), false)
  }
})

test('closed events reject identity, arbitrary dimensions, unknown fields and invalid combinations', () => {
  assert.equal(isStatisticsEvent(view), true)
  for (const field of ['visitorId', 'sessionId', 'eventId', 'occurredAt', 'referrer', 'url', 'utm_source', 'locale']) {
    assert.equal(isStatisticsEvent({ ...view, [field]: 'private' }), false)
  }
  for (const event of [null, [], {}, { ...view, name: 'app_started' }, { ...view, page: '/private' },
    { name: 'landing_outbound_clicked', page: 'home', destination: '__proto__', placement: 'footer' },
    { name: 'landing_download_clicked', page: 'home', action: 'request-installer', placement: 'hero', platform: 'windows' }]) {
    assert.equal(isStatisticsEvent(event), false)
  }
})

test('links distinguish section intent, official installers and empty/error release fallbacks', () => {
  const link = (kind, placement, href, platform) => statisticsEventForLink({ kind, placement, href, platform }, statisticsOrigin)
  assert.equal(link('download-section', 'hero', '#download').action, 'open-download-section')
  for (const [platform, extension] of [['windows', 'exe'], ['macos', 'dmg']]) {
    for (const placement of ['release-latest', 'release-older']) {
      assert.equal(link('release', placement, `https://github.com/TrinkieYinkie/WritersStudio_releases/releases/download/v2.3.0/Setup.${extension}`, platform).action, 'request-installer')
    }
  }
  assert.equal(link('release', 'release-latest', 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases', 'windows').destination, 'github-releases')
  assert.equal(link('release-notes', 'release-notes', 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/tag/v2.3.0').destination, 'github-release-notes')
  assert.equal(link('privacy', 'footer', '/privacy/ru/').destination, 'privacy')
  assert.equal(link('support', 'footer', 'mailto:support@writersstudio.app').destination, 'support-email')
  for (const href of ['javascript:alert(1)', 'https://attacker.invalid/Setup.exe',
    'https://github.com/Someone/Other/releases/download/v1/Setup.exe',
    'https://user:password@github.com/TrinkieYinkie/WritersStudio_releases/releases/download/v1/Setup.exe',
    'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/download/v1/Setup.exe?email=private',
    'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/download/v1/SHA256SUMS.txt']) {
    assert.equal(link('release', 'release-latest', href, 'windows'), undefined)
  }
})
