export const statisticsPreferenceKey = 'writersstudio.websiteStatistics'
export const statisticsEndpoint = 'https://telemetry.writersstudio.app/api/telemetry/landing-events'
export const statisticsOrigin = 'https://writersstudio.app'
const releaseRoot = '/TrinkieYinkie/WritersStudio_releases/releases'
const downloadPlacements = ['header', 'hero', 'final', 'navigation', 'footer']
const releasePlacements = ['release-latest', 'release-older']
const destinations = {
  'github-releases': ['release-latest', 'release-older', 'release-notes', 'footer'],
  'github-release-notes': ['release-notes'],
  'github-feedback': ['footer'],
  'support-email': ['footer'],
  terms: ['download-legal', 'footer'],
  privacy: ['download-legal', 'footer', 'statistics']
}

const exactKeys = (value, keys) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|')

export function isStatisticsEvent(event) {
  if (!event || event.page !== 'home') return false
  if (event.name === 'landing_page_viewed') return exactKeys(event, ['name', 'page'])
  if (event.name === 'landing_download_clicked') {
    if (!exactKeys(event, ['name', 'page', 'action', 'placement', 'platform'])) return false
    return event.action === 'open-download-section'
      ? event.platform === 'unspecified' && downloadPlacements.includes(event.placement)
      : event.action === 'request-installer' && ['windows', 'macos'].includes(event.platform)
        && releasePlacements.includes(event.placement)
  }
  return event.name === 'landing_outbound_clicked'
    && exactKeys(event, ['name', 'page', 'destination', 'placement'])
    && Object.hasOwn(destinations, event.destination)
    && destinations[event.destination].includes(event.placement)
}

// Only explicitly annotated links can emit events. URL strings never enter a payload.
export function statisticsEventForLink({ kind, placement, platform, href }, origin) {
  let url
  try { url = new URL(href, origin) } catch { return undefined }
  if (url.username || url.password || url.search) return undefined
  const download = (action, selectedPlatform) => ({
    name: 'landing_download_clicked', page: 'home', action, placement, platform: selectedPlatform
  })
  const outbound = destination => ({ name: 'landing_outbound_clicked', page: 'home', destination, placement })
  let event
  const github = url.origin === 'https://github.com'
  const releases = github && url.pathname === releaseRoot && !url.hash
  if (kind === 'download-section' && url.origin === origin && ['/', '/index.html'].includes(url.pathname)
      && url.hash === '#download') event = download('open-download-section', 'unspecified')
  if (kind === 'release') {
    const extension = platform === 'windows' ? /\.(?:exe|msi|msix|zip)$/iu : /\.(?:dmg|pkg|zip)$/iu
    const parts = url.pathname.slice(`${releaseRoot}/download/`.length).split('/')
    if (github && !url.hash && url.pathname.startsWith(`${releaseRoot}/download/`)
        && parts.length === 2 && parts.every(Boolean) && extension.test(parts[1])) {
      event = download('request-installer', platform)
    } else if (releases) event = outbound('github-releases')
  }
  if (kind === 'release-notes') {
    if (releases) event = outbound('github-releases')
    else if (github && !url.hash && url.pathname.startsWith(`${releaseRoot}/tag/`)
      && url.pathname.slice(`${releaseRoot}/tag/`.length).match(/^[^/]+$/u)) event = outbound('github-release-notes')
  }
  if (kind === 'releases' && releases) event = outbound('github-releases')
  if (kind === 'feedback' && url.href === 'https://github.com/TrinkieYinkie/WritersStudio_releases/issues/new') {
    event = outbound('github-feedback')
  }
  if (kind === 'support' && url.href === 'mailto:support@writersstudio.app') event = outbound('support-email')
  if (['terms', 'privacy'].includes(kind) && url.origin === origin && !url.hash
      && new RegExp(`^/${kind}/(?:ru/|es/)?$`, 'u').test(url.pathname)) event = outbound(kind)
  return isStatisticsEvent(event) ? event : undefined
}

// All dependencies are explicit so tests exercise sending without network or storage access.
export function createWebsiteStatistics({ config, origin, storage, privacySignal, fetch: send,
  setTimeout: schedule = setTimeout, clearTimeout: cancel = clearTimeout }) {
  const active = new Map()
  let memoryOff = false
  let storageUnavailable = false
  let attempted = 0
  let pageCounted = false
  let disposed = false

  const configured = config.enabled === true && origin === statisticsOrigin
    && config.origin === statisticsOrigin && config.endpoint === statisticsEndpoint
  function excluded() {
    try {
      const value = storage.getItem(statisticsPreferenceKey)
      storageUnavailable = false
      return memoryOff || value !== null
    } catch {
      storageUnavailable = true
      return true
    }
  }
  function abort() {
    for (const [controller, timeout] of active) {
      controller.abort()
      cancel(timeout)
    }
    active.clear()
  }
  function status() {
    const off = excluded()
    if (disposed) return 'unavailable'
    if (privacySignal()) return 'browser'
    if (storageUnavailable) return 'storage'
    if (off) return 'excluded'
    return configured ? 'active' : 'unavailable'
  }
  function synchronize() {
    const current = status()
    if (current !== 'active') abort()
    return current
  }
  function exclude(value) {
    // Persist only an opt-out flag. Never persist an ID, opt-in token or event data.
    if (value) memoryOff = true
    try {
      if (value) storage.setItem(statisticsPreferenceKey, 'off')
      else storage.removeItem(statisticsPreferenceKey)
      memoryOff = false
    } catch {
      // A failed write still excludes this document, including in other event handlers.
      memoryOff = true
    }
    return synchronize()
  }
  function record(event) {
    if (synchronize() !== 'active' || !isStatisticsEvent(event)
        || attempted >= 30 || active.size >= 4) return false
    const controller = new AbortController()
    const timeout = schedule(() => { controller.abort(); active.delete(controller) }, 3_000)
    active.set(controller, timeout)
    attempted += 1
    const body = JSON.stringify({ schemaVersion: 1, site: 'writersstudio', surface: 'landing', event })
    try {
      // No navigation delay, cookies, referrer, redirect following, retries or durable queue.
      Promise.resolve(send(statisticsEndpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        redirect: 'error', cache: 'no-store', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal
      })).catch(() => {}).finally(() => { cancel(timeout); active.delete(controller) })
    } catch {
      cancel(timeout)
      active.delete(controller)
    }
    return true
  }
  function pageView() {
    if (pageCounted) return false
    const accepted = record({ name: 'landing_page_viewed', page: 'home' })
    if (accepted) pageCounted = true
    return accepted
  }
  return Object.freeze({ record, pageView, status, synchronize, exclude,
    dispose() { disposed = true; abort() } })
}
