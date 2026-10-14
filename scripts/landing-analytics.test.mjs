import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createLandingAnalytics, classifyAttribution, landingActionForLink, isLandingAction } from '../landing-analytics.js'
import { landingAnalyticsConfig as config } from '../landing-analytics-config.js'
import { initializeWebsiteStatistics } from '../landing-analytics-ui.js'

const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }
const section = { eventName: 'landing_download_clicked', properties: { action: 'open-download-section', placement: 'hero', platform: 'unspecified' } }
function harness(options = {}) {
  let time = Date.parse('2026-10-14T12:00:00.000Z'), serial = 0, ids = 0, reads = 0
  const timers = new Map(), values = new Map(), requests = [], pending = []
  const schedule = (fn, delay) => { timers.set(++serial, { fn, due: time + delay }); return serial }
  const storage = {
    getItem: key => { if (options.storageError) throw Error('unreadable'); return values.get(key) ?? null },
    setItem: (key, value) => { if (options.writeError) throw Error('unwritable'); values.set(key, value) },
    removeItem: key => { if (options.writeError) throw Error('unwritable'); values.delete(key) }
  }
  if (options.excluded) values.set(config.preferenceKey, 'off')
  const activeConfig = { ...config, enabled: true, ...options.config }
  const client = createLandingAnalytics({ config: activeConfig,
    location: { origin: options.origin ?? config.origin, pathname: options.pathname ?? '/' },
    storage, privacySignal: () => options.privacy === true,
    context: () => { reads++; return { locale: options.locale ?? 'en', search: options.search ?? '', referrer: options.referrer ?? '' } },
    randomUUID: options.noCrypto ? undefined : () => `10000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    now: () => time, setTimeout: schedule, clearTimeout: id => timers.delete(id),
    fetch: (url, init) => {
      requests.push({ url, init, body: JSON.parse(init.body), time })
      if (options.pending) return new Promise((resolve, reject) => {
        pending.push(resolve); init.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })
      })
      if (options.networkError) return Promise.reject(Error('offline'))
      return Promise.resolve({ status: options.status ?? 204, headers: { get: () => options.retryAfter ?? null } })
    }
  })
  async function advance(ms) {
    const target = time + ms
    for (let guard = 0; guard < 500; guard++) {
      await settle()
      const next = [...timers].filter(([, item]) => item.due <= target).sort((a, b) => a[1].due - b[1].due)[0]
      if (!next) { time = target; await settle(); return }
      time = next[1].due; timers.delete(next[0]); next[1].fn()
    }
    assert.fail('Timer loop exceeded its bound')
  }
  return { client, values, requests, pending, timers, options, advance,
    identities: () => ids, contextReads: () => reads }
}
class Surface {
  handlers = new Map(); attributes = new Map(); hidden = true; disabled = false; dataset = {}
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn) }
  removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn) }
  fire(type, detail = {}) { for (const fn of this.handlers.get(type) ?? []) fn({ type, ...detail }) }
  setAttribute(key, value) { this.attributes.set(key, value) }
  getAttribute(key) { return this.attributes.get(key) ?? null }
}
function page(options = {}) {
  const doc = new Surface(), win = new Surface(), button = new Surface()
  const states = ['active', 'excluded', 'unavailable', 'browser', 'storage'].map(state => {
    const node = new Surface(); node.dataset.statisticsState = state; return node
  })
  const values = new Map(), requests = [], timers = new Map()
  let ids = 0
  doc.visibilityState = options.hidden ? 'hidden' : 'visible'; doc.prerendering = options.prerendering ?? false
  doc.documentElement = { lang: 'en' }; doc.referrer = ''
  doc.querySelector = () => button; doc.querySelectorAll = () => states
  win.navigator = { globalPrivacyControl: options.privacy ?? false }
  win.location = { origin: config.origin, pathname: '/', search: '' }
  win.crypto = { randomUUID: () => `20000000-0000-4000-8000-${String(++ids).padStart(12, '0')}` }
  win.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  win.setTimeout = (fn, delay) => { const key = {}; timers.set(key, { fn, delay }); return key }
  win.clearTimeout = key => timers.delete(key)
  win.fetch = (_, init) => { requests.push(init); return Promise.resolve({ status: 204 }) }
  const activeConfig = { ...config, enabled: options.enabled ?? true }
  const owner = initializeWebsiteStatistics({ doc, win, config: activeConfig })
  return { doc, win, button, values, requests, owner, timers, activeConfig,
    selected: () => states.filter(node => !node.hidden).map(node => node.dataset.statisticsState) }
}

export async function runLandingAnalyticsTests() {
  let count = 0
  async function check(name, run) { await run(); console.log('PASS ' + name); count++ }
  await check('production disabled, preview, privacy, storage and unsupported API gates create no ID or context', () => {
    for (const options of [{ config: { enabled: false } }, { origin: 'http://localhost:4173' }, { pathname: '/privacy/' },
      { config: { endpoint: config.endpoint + '/wrong' } }, { privacy: true }, { storageError: true }, { excluded: true }, { noCrypto: true }]) {
      const h = harness(options); h.client.pageView(); h.client.record(section)
      assert.equal(h.identities(), 0); assert.equal(h.contextReads(), 0); assert.equal(h.requests.length, 0); h.client.dispose()
    }
    assert.equal(config.enabled, false)
  })
  await check('exact versioned envelope, selected locale, privacy-safe transport and document-only identity', async () => {
    const h = harness({ locale: 'ru', search: '?utm_source=github&utm_campaign=launch&private=secret' })
    assert.equal(h.client.pageView(), true); await settle(); h.client.record(section)
    const { body, init } = h.requests[0]
    assert.deepEqual(Object.keys(body).sort(), ['contractVersion', 'events', 'schemaVersion'])
    assert.equal(body.contractVersion, 2); assert.equal(body.schemaVersion, 1)
    const event = body.events[0]
    assert.deepEqual(Object.keys(event).sort(), ['attribution','eventId','eventName','eventVersion','locale','occurredAt','page','pageViewId','properties','sequence','siteVersion'].sort())
    assert.equal(event.eventVersion, 2); assert.equal(event.locale, 'ru'); assert.equal(event.sequence, 1)
    assert.equal(h.requests[1].body.events[0].pageViewId, event.pageViewId)
    assert.equal(h.requests[1].body.events[0].sequence, 2)
    assert.notEqual(event.eventId, event.pageViewId); assert.equal(h.values.size, 0)
    assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer')
    assert.equal(init.redirect, 'error'); assert.equal(init.keepalive, true)
    assert.deepEqual(init.headers, { 'Content-Type': 'text/plain;charset=UTF-8' })
    assert.doesNotMatch(init.body, /secret|private|https:|installation|deletionSecret/u)
    h.client.dispose()
  })
  await check('attribution normalization, unknown/duplicate UTM, hostname boundaries and precedence', () => {
    assert.equal(classifyAttribution({ search: '?utm_source=github&utm_source=google' }).utmSource, 'other')
    assert.equal(classifyAttribution({ search: '?utm_campaign=&utm_medium=email' }).source, 'email')
    assert.equal(classifyAttribution({ search: '?utm_source=%20GOOGLE%20', referrer: 'https://github.com/private' }).source, 'search')
    assert.equal(classifyAttribution({ search: '?utm_source=none' }).utmSource, 'other')
    assert.equal(classifyAttribution({ referrer: 'https://github.com.evil.test/private' }).source, 'referral')
    assert.equal(classifyAttribution({ referrer: 'https://sub.google.com/secret' }).source, 'search')
    assert.equal(classifyAttribution({ referrer: config.origin, internalOrigins: [config.origin] }).source, 'internal')
    assert.equal(classifyAttribution({ search: '?utm_term=private&utm_content=private' }).source, 'direct')
  })
  await check('link actions distinguish section, releases and installer with exactly one event', () => {
    const classify = input => landingActionForLink(input, config)
    assert.deepEqual(classify({ kind: 'download-section', placement: 'hero', href: config.origin + '/?utm_source=github' + config.downloadSection }), section)
    const releases = 'https://github.com/' + config.releaseRepository + '/releases'
    assert.equal(classify({ kind: 'release', placement: 'release-latest', platform: 'windows', href: releases }).properties.action, 'open-releases')
    assert.equal(classify({ kind: 'release', placement: 'release-latest', platform: 'windows', href: releases + '/download/v1/setup.exe' }).properties.action, 'request-installer')
    assert.equal(classify({ kind: 'releases', placement: 'footer', href: releases }).eventName, 'landing_download_clicked')
    assert.equal(classify({ kind: 'release-notes', placement: 'release-notes', href: releases }).eventName, 'landing_link_clicked')
    for (const href of [releases + '?secret=value', releases + '/download/v1/file.txt', releases.replace('github.com', 'github.com.evil.test'), releases + '/download/v1/dir/setup.exe']) {
      assert.equal(classify({ kind: 'release', placement: 'release-latest', platform: 'windows', href }), undefined)
    }
    assert.equal(isLandingAction({ ...section, arbitrary: true }), false)
    assert.equal(isLandingAction({ ...section, properties: { ...section.properties, platform: 'windows' } }), false)
  })
  await check('retries preserve IDs and terminate after three attempts', async () => {
    for (const options of [{ status: 503 }, { status: 408 }, { networkError: true }]) {
      const h = harness(options); h.client.pageView(); await h.advance(20000)
      assert.equal(h.requests.length, 3); assert.equal(h.requests[0].init.body, h.requests[2].init.body)
      assert.equal(h.timers.size, 0); h.client.dispose()
    }
    for (const status of [204, 400, 403, 413]) {
      const h = harness({ status }); h.client.pageView(); await h.advance(20000)
      assert.equal(h.requests.length, 1); h.client.dispose()
    }
  })
  await check('Retry-After is honored and long/date values do not retry early', async () => {
    const h = harness({ status: 429, retryAfter: '10' }); h.client.pageView()
    await h.advance(9999); assert.equal(h.requests.length, 1)
    await h.advance(1); assert.equal(h.requests.length, 2); h.client.dispose()
    for (const retryAfter of ['31', 'Wed, 14 Oct 2026 12:00:00 GMT']) {
      const p = harness({ status: 429, retryAfter }); p.client.pageView(); await p.advance(60000)
      assert.equal(p.requests.length, 1); p.client.dispose()
    }
  })
  await check('concurrency, timeouts, batch/body bounds and document cap', async () => {
    const h = harness({ pending: true }); h.client.pageView()
    for (let i = 0; i < 60; i++) h.client.record(section)
    assert.equal(h.requests.length, 2)
    h.pending.splice(0).forEach(resolve => resolve({ status: 204 }))
    await h.advance(0)
    assert.equal(h.requests.length, 4)
    assert.ok(h.requests.every(request => request.body.events.length <= 8 && Buffer.byteLength(request.init.body) <= 16384))
    await h.advance(5000)
    assert.equal(h.requests[2].init.signal.aborted, true)
    h.client.exclude(true); await h.advance(60000)
    assert.equal(h.timers.size, 0); h.client.dispose()
    const capped = harness(); capped.client.pageView()
    for (let i = 0; i < 60; i++) { capped.client.record(section); await capped.advance(0) }
    assert.equal(capped.requests.flatMap(r => r.body.events).length, 32); capped.client.dispose()
  })
  await check('opt-out aborts requests, discards queue/retries and stale completions cannot restart sending', async () => {
    const h = harness({ pending: true }); h.client.pageView(); h.client.record(section); h.client.record(section)
    h.client.exclude(true); h.client.exclude(false); await h.advance(60000)
    assert.equal(h.requests.length, 2); assert.ok(h.requests.every(r => r.init.signal.aborted))
    assert.equal(h.values.size, 0); assert.equal(h.client.pageView(), false); h.client.dispose()
    const w = harness({ writeError: true }); w.client.pageView(); w.client.exclude(true)
    assert.equal(w.client.status(), 'excluded'); assert.equal(w.client.record(section), false); w.client.dispose()
  })
  await check('departure drops retries and BFCache does not create a second view', async () => {
    const h = harness({ status: 503 }); h.client.pageView(); h.client.pageHide()
    await h.advance(20000); h.client.pageShow(); h.client.pageView(); await h.advance(20000)
    assert.equal(h.requests.length, 1); h.client.dispose()
  })
  await check('shared UI saves opt-out while disabled and respects browser signals', () => {
    const p = page({ enabled: false }); assert.deepEqual(p.selected(), ['unavailable'])
    p.button.fire('click'); assert.equal(p.values.get(config.preferenceKey), 'off')
    assert.equal(p.button.getAttribute('aria-pressed'), 'true'); assert.deepEqual(p.selected(), ['excluded'])
    p.button.fire('click'); assert.deepEqual(p.selected(), ['unavailable']); assert.equal(p.requests.length, 0); p.owner.dispose()
    const g = page({ privacy: true }); assert.equal(g.button.disabled, true); assert.deepEqual(g.selected(), ['browser']); assert.equal(g.requests.length, 0); g.owner.dispose()
  })
  await check('UI visibility, prerender, BFCache, duplicate initialization and cross-tab exclusion', async () => {
    const p = page({ hidden: true, prerendering: true }); assert.equal(p.requests.length, 0)
    p.doc.visibilityState = 'visible'; p.doc.fire('visibilitychange'); assert.equal(p.requests.length, 0)
    p.doc.prerendering = false; p.doc.fire('prerenderingchange'); await settle()
    p.win.fire('pageshow', { persisted: true }); p.doc.fire('visibilitychange')
    assert.equal(initializeWebsiteStatistics({ doc: p.doc, win: p.win, config: p.activeConfig }), p.owner)
    assert.equal(p.requests.length, 1)
    p.values.set(config.preferenceKey, 'off'); p.win.fire('storage', { key: config.preferenceKey })
    assert.deepEqual(p.selected(), ['excluded']); p.owner.dispose()
    assert.ok([...p.doc.handlers.values(), ...p.win.handlers.values()].every(set => set.size === 0))
  })
  await check('trusted keyboard/modifier and middle clicks preserve native navigation', async () => {
    const p = page(); await settle()
    const anchor = { href: config.origin + '/' + config.downloadSection,
      dataset: { statisticsLink: 'download-section', statisticsPlacement: 'hero' } }
    const click = { target: { closest: () => anchor }, isTrusted: true, button: 0, defaultPrevented: false,
      preventDefault: () => assert.fail('Navigation intercepted') }
    p.doc.fire('click', click); await settle()
    p.doc.fire('auxclick', { ...click, button: 1 }); await settle()
    p.doc.fire('click', { ...click, isTrusted: false }); p.doc.fire('click', { ...click, defaultPrevented: true })
    p.doc.fire('auxclick', { ...click, button: 2 }); assert.equal(p.requests.length, 3)
    assert.ok(p.requests.slice(1).every(init => JSON.parse(init.body).events.length === 1))
    p.button.fire('click'); p.doc.fire('click', click); assert.equal(p.requests.length, 3); p.owner.dispose()
  })
  await check('published fixture and shared artifact digest prevent unnoticed contract drift', async () => {
    const fixture = JSON.parse(await readFile(new URL('../docs/contracts/landing-analytics-v2.example.json', import.meta.url)))
    assert.equal(fixture.contractVersion, 2)
    for (const event of fixture.events) assert.ok(isLandingAction({ eventName: event.eventName, properties: event.properties }))
    const manifest = JSON.parse(await readFile(new URL('../docs/contracts/landing-analytics-v2.artifacts.json', import.meta.url)))
    for (const [file, digest] of Object.entries(manifest)) {
      assert.equal(createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex'), digest, file)
    }
  })
  console.log(`Passed ${count} unified landing analytics suites.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runLandingAnalyticsTests()
