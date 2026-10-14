// Shared landing protocol v2. Keep this file identical in both public repositories.
export const contractVersion = 2
export const limits = Object.freeze({ events: 32, batch: 8, inFlight: 2, attempts: 3, timeout: 5000, bodyBytes: 16384 })
const placements = ['header', 'hero', 'navigation', 'platforms', 'free', 'final', 'footer', 'release-latest', 'release-older', 'release-notes', 'download-legal', 'statistics']
const downloadSections = ['header', 'hero', 'navigation', 'platforms', 'final', 'footer']
const releasePlacements = ['platforms', 'final', 'footer', 'release-latest', 'release-older', 'release-notes']
const linkPlacements = Object.freeze({
  'github-releases': ['release-notes'],
  'github-release-notes': ['release-notes'],
  'github-repository': ['footer'],
  'github-feedback': ['footer'],
  'support-email': ['footer'],
  terms: ['download-legal', 'footer'],
  privacy: ['download-legal', 'footer', 'statistics'],
  'web-app': ['header', 'hero', 'platforms', 'free', 'final', 'footer']
})
export const attributionCatalog = Object.freeze({
  source: ['direct', 'search', 'social', 'ai', 'github', 'email', 'internal', 'campaign', 'referral'],
  utmSource: ['none', 'other', 'google', 'bing', 'yandex', 'duckduckgo', 'github', 'telegram', 'reddit', 'youtube', 'x', 'linkedin', 'facebook', 'instagram', 'chatgpt', 'claude', 'perplexity', 'newsletter'],
  utmMedium: ['none', 'other', 'organic', 'cpc', 'paid_social', 'social', 'email', 'referral', 'partner'],
  utmCampaign: ['none', 'other', 'launch']
})
const groups = {
  search: ['google', 'bing', 'yandex', 'duckduckgo'],
  social: ['telegram', 'reddit', 'youtube', 'x', 'linkedin', 'facebook', 'instagram'],
  ai: ['chatgpt', 'claude', 'perplexity']
}
const referrers = {
  search: ['google.com', 'bing.com', 'yandex.ru', 'yandex.com', 'duckduckgo.com'],
  social: ['t.me', 'telegram.org', 'reddit.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'linkedin.com', 'facebook.com', 'instagram.com'],
  ai: ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'perplexity.ai'],
  github: ['github.com']
}
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|')

export function isLandingAction(action) {
  if (!exact(action, ['eventName', 'properties'])) return false
  const p = action.properties
  if (action.eventName === 'landing_page_viewed') return exact(p, [])
  if (action.eventName === 'landing_download_clicked') {
    if (!exact(p, ['action', 'placement', 'platform'])) return false
    if (p.action === 'open-download-section') return p.platform === 'unspecified' && downloadSections.includes(p.placement)
    if (p.action === 'open-releases') return p.platform === 'unspecified' && releasePlacements.includes(p.placement)
    return p.action === 'request-installer' && ['windows', 'macos', 'linux'].includes(p.platform)
      && ['release-latest', 'release-older'].includes(p.placement)
  }
  return action.eventName === 'landing_link_clicked' && exact(p, ['destination', 'placement'])
    && Object.hasOwn(linkPlacements, p.destination) && linkPlacements[p.destination].includes(p.placement)
}

export function classifyAttribution({ search = '', referrer = '', internalOrigins = [] }) {
  const params = new URLSearchParams(search)
  const result = {}
  for (const [key, query] of [['utmSource', 'utm_source'], ['utmMedium', 'utm_medium'], ['utmCampaign', 'utm_campaign']]) {
    const values = params.getAll(query)
    const value = values.length === 1 ? values[0].trim().toLowerCase() : ''
    result[key] = !values.length ? 'none' : attributionCatalog[key].slice(2).includes(value) ? value : 'other'
  }
  let source = 'direct'
  if (Object.values(result).some(value => value !== 'none')) {
    source = result.utmSource === 'github' ? 'github'
      : result.utmSource === 'newsletter' || result.utmMedium === 'email' ? 'email'
        : Object.keys(groups).find(group => groups[group].includes(result.utmSource)) || 'campaign'
  } else if (referrer) {
    source = 'referral'
    try {
      const url = new URL(referrer)
      if (['http:', 'https:'].includes(url.protocol)) {
        source = internalOrigins.includes(url.origin) ? 'internal'
          : Object.keys(referrers).find(group => referrers[group].some(domain =>
            url.hostname === domain || url.hostname.endsWith('.' + domain))) || 'referral'
      }
    } catch { /* Retain only the closed unknown-referral category. */ }
  }
  return Object.freeze({ source, ...result })
}

export function landingActionForLink({ kind, placement, platform, href }, config) {
  if (!placements.includes(placement)) return undefined
  let url
  try { url = new URL(href, config.origin) } catch { return undefined }
  if (url.username || url.password || (url.search && kind !== 'download-section')) return undefined
  const releaseRoot = '/' + config.releaseRepository + '/releases'
  const github = url.origin === 'https://github.com'
  const releases = github && url.pathname === releaseRoot && !url.hash
  const download = (action, selectedPlatform = 'unspecified') => ({
    eventName: 'landing_download_clicked', properties: { action, placement, platform: selectedPlatform }
  })
  const link = destination => ({ eventName: 'landing_link_clicked', properties: { destination, placement } })
  let action
  if (kind === 'download-section' && url.origin === config.origin
      && ['/', '/index.html'].includes(url.pathname) && url.hash === config.downloadSection) action = download('open-download-section')
  if (kind === 'release') {
    const extensions = { windows: /\.(?:exe|msi|msix|zip)$/iu, macos: /\.(?:dmg|pkg|zip)$/iu, linux: /\.(?:AppImage|deb|rpm|tar\.gz)$/iu }
    const parts = url.pathname.slice(`${releaseRoot}/download/`.length).split('/')
    if (github && !url.hash && url.pathname.startsWith(`${releaseRoot}/download/`)
        && parts.length === 2 && parts.every(Boolean) && extensions[platform]?.test(parts[1])) action = download('request-installer', platform)
    else if (releases) action = download('open-releases')
  }
  if (kind === 'releases' && releases) action = download('open-releases')
  if (kind === 'release-notes') {
    if (releases) action = link('github-releases')
    else if (github && !url.hash && url.pathname.startsWith(`${releaseRoot}/tag/`)
      && /^[^/]+$/u.test(url.pathname.slice(`${releaseRoot}/tag/`.length))) action = link('github-release-notes')
  }
  if (kind === 'repository' && url.href === `https://github.com/${config.releaseRepository}`) action = link('github-repository')
  if (kind === 'feedback' && url.href === `https://github.com/${config.releaseRepository}/issues/new`) action = link('github-feedback')
  if (kind === 'support' && url.href === 'mailto:' + config.supportEmail) action = link('support-email')
  if (kind === 'web-app' && config.webOrigin && url.href === config.webOrigin + '/') action = link('web-app')
  if (['terms', 'privacy'].includes(kind) && url.origin === config.origin && !url.hash
      && new RegExp(`^/${kind}/(?:ru/|es/)?$`, 'u').test(url.pathname)) action = link(kind)
  return isLandingAction(action) ? action : undefined
}

export function createLandingAnalytics({ config, location, storage, privacySignal,
  context, randomUUID, fetch: send, now = Date.now,
  setTimeout: schedule = setTimeout, clearTimeout: cancel = clearTimeout }) {
  const active = new Map()
  let memoryOff = false, storageUnavailable = false, disposed = false, departing = false
  let pageViewId, attribution, counted = false, sequence = 0, produced = 0, wake, generation = 0
  let queue = []
  const configured = config.enabled === true && location.origin === config.origin
    && /^https:\/\/[^/:?#]+$/u.test(config.origin)
    && config.endpoint === config.origin.replace('https://', 'https://telemetry.') + '/api/telemetry/landing/events'
    && ['/', '/index.html'].includes(location.pathname)
    && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(config.siteVersion)
    && typeof send === 'function' && typeof randomUUID === 'function'
  function excluded() {
    try { const value = storage.getItem(config.preferenceKey); storageUnavailable = false; return memoryOff || value !== null }
    catch { storageUnavailable = true; return true }
  }
  function status() {
    const off = excluded()
    if (disposed) return 'unavailable'
    if (privacySignal()) return 'browser'
    if (storageUnavailable) return 'storage'
    if (off) return 'excluded'
    return configured ? 'active' : 'unavailable'
  }
  function stopPending() {
    generation++
    cancel(wake)
    queue = []
    for (const [controller, timer] of active) { controller.abort(); cancel(timer) }
    active.clear()
  }
  function synchronize() {
    const current = status()
    if (current !== 'active') stopPending()
    return current
  }
  function exclude(value) {
    if (value) memoryOff = true
    try {
      if (value) storage.setItem(config.preferenceKey, 'off')
      else storage.removeItem(config.preferenceKey)
      memoryOff = false
    } catch { memoryOff = true }
    return synchronize()
  }
  function scheduleFlush() {
    cancel(wake)
    if (departing || !queue.length || active.size >= limits.inFlight || synchronize() !== 'active') return
    wake = schedule(flush, Math.max(0, Math.min(...queue.map(item => item.readyAt)) - now()))
  }
  function retryDelay(response, attempts) {
    const raw = response?.headers?.get('Retry-After')
    if (raw && !/^\d+$/u.test(raw)) return null
    const seconds = raw ? Number(raw) : NaN
    if (Number.isFinite(seconds) && seconds > 30) return null
    return Number.isFinite(seconds) ? Math.max(1000, seconds * 1000) : attempts * 1000
  }
  async function deliver(batch) {
    const epoch = generation
    const controller = new AbortController()
    const timer = schedule(() => controller.abort(), limits.timeout)
    active.set(controller, timer)
    for (const item of batch) item.attempts++
    let response, retry = false
    try {
      const body = JSON.stringify({ schemaVersion: 1, contractVersion, events: batch.map(item => item.event) })
      if (new TextEncoder().encode(body).byteLength > limits.bodyBytes) return
      response = await send(config.endpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', cache: 'no-store', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, signal: controller.signal
      })
      retry = response.status === 408 || response.status === 429 || response.status >= 500
    } catch { retry = true }
    finally { cancel(timer); active.delete(controller) }
    if (epoch !== generation || synchronize() !== 'active') return
    if (retry && !departing) {
      const delay = retryDelay(response, Math.max(...batch.map(item => item.attempts)))
      if (delay !== null) for (const item of batch) {
        if (item.attempts < limits.attempts) queue.push({ ...item, readyAt: now() + delay })
      }
    }
    scheduleFlush()
  }
  function flush() {
    cancel(wake)
    if (synchronize() !== 'active') return
    while (active.size < limits.inFlight) {
      const batch = queue.filter(item => item.readyAt <= now()).slice(0, limits.batch)
      if (!batch.length) break
      const selected = new Set(batch)
      queue = queue.filter(item => !selected.has(item))
      void deliver(batch)
    }
    scheduleFlush()
  }
  function record(action) {
    if (!counted || synchronize() !== 'active' || !isLandingAction(action)
      || produced >= limits.events || action.eventName === 'landing_page_viewed') return false
    return enqueue(action)
  }
  function enqueue(action) {
    try {
      const value = context()
      const event = Object.freeze({
        eventId: randomUUID(), eventName: action.eventName, eventVersion: 2,
        pageViewId, sequence: ++sequence, siteVersion: config.siteVersion,
        page: 'home', locale: ['en', 'ru', 'es'].includes(value.locale) ? value.locale : 'en',
        occurredAt: new Date(now()).toISOString(), attribution,
        properties: Object.freeze({ ...action.properties })
      })
      produced++
      queue.push({ event, attempts: 0, readyAt: 0 })
      flush()
      return true
    } catch { disposed = true; stopPending(); return false }
  }
  function pageView() {
    if (counted || synchronize() !== 'active') return false
    try {
      const value = context()
      pageViewId = randomUUID()
      attribution = classifyAttribution({ search: value.search, referrer: value.referrer,
        internalOrigins: [config.origin, ...(config.webOrigin ? [config.webOrigin] : [])] })
      counted = true
      return enqueue({ eventName: 'landing_page_viewed', properties: {} })
    } catch { disposed = true; stopPending(); return false }
  }
  return Object.freeze({ record, pageView, status, synchronize, exclude,
    pageHide() { departing = true; queue = queue.filter(item => item.attempts === 0); flush() },
    pageShow() { departing = false; scheduleFlush() },
    dispose() { disposed = true; stopPending(); pageViewId = undefined; attribution = undefined }
  })
}
