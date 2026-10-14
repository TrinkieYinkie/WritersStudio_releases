import { landingAnalyticsConfig } from './landing-analytics-config.js'
import { createLandingAnalytics, landingActionForLink } from './landing-analytics.js'

const owners = new WeakMap()
export function initializeWebsiteStatistics({ doc = document, win = window, config = landingAnalyticsConfig } = {}) {
  if (owners.has(doc)) return owners.get(doc)
  const control = doc.querySelector('[data-statistics-toggle]')
  const states = [...doc.querySelectorAll('[data-statistics-state]')]
  if (!control || !states.length) return undefined
  const client = createLandingAnalytics({
    config, location: win.location,
    storage: {
      getItem: key => win.localStorage.getItem(key),
      setItem: (key, value) => win.localStorage.setItem(key, value),
      removeItem: key => win.localStorage.removeItem(key)
    },
    privacySignal: () => win.navigator.globalPrivacyControl === true
      || win.navigator.doNotTrack === '1' || win.doNotTrack === '1',
    context: () => ({ locale: doc.documentElement.lang, search: win.location.search, referrer: doc.referrer }),
    randomUUID: typeof win.crypto?.randomUUID === 'function' ? () => win.crypto.randomUUID() : undefined,
    fetch: typeof win.fetch === 'function' ? (url, options) => win.fetch(url, options) : undefined,
    setTimeout: (callback, duration) => win.setTimeout(callback, duration),
    clearTimeout: timer => win.clearTimeout(timer)
  })
  function refresh() {
    const state = client.synchronize()
    for (const element of states) element.hidden = element.dataset.statisticsState !== state
    const forced = state === 'browser' || state === 'storage'
    control.disabled = forced
    control.setAttribute('aria-pressed', String(forced || state === 'excluded'))
    control.hidden = false
  }
  function viewWhenVisible() {
    refresh()
    if (doc.visibilityState === 'visible' && !doc.prerendering) client.pageView()
  }
  function toggle() {
    client.exclude(control.getAttribute('aria-pressed') !== 'true')
    viewWhenVisible()
  }
  function onStorage(event) {
    if (event.key === config.preferenceKey || event.key === null) viewWhenVisible()
  }
  function onLink(event) {
    if (!event.isTrusted || event.defaultPrevented || doc.visibilityState !== 'visible' || doc.prerendering
      || (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return
    const anchor = event.target?.closest?.('a[data-statistics-link]')
    if (!anchor) return
    const action = landingActionForLink({ kind: anchor.dataset.statisticsLink,
      placement: anchor.dataset.statisticsPlacement, platform: anchor.dataset.statisticsPlatform,
      href: anchor.href }, config)
    if (action) client.record(action)
  }
  function onPageHide() { client.pageHide() }
  function onPageShow() { client.pageShow(); viewWhenVisible() }
  control.addEventListener('click', toggle)
  doc.addEventListener('click', onLink)
  doc.addEventListener('auxclick', onLink)
  doc.addEventListener('visibilitychange', viewWhenVisible)
  doc.addEventListener('prerenderingchange', viewWhenVisible)
  win.addEventListener('storage', onStorage)
  win.addEventListener('pageshow', onPageShow)
  win.addEventListener('pagehide', onPageHide)
  const owner = Object.freeze({ dispose() {
    control.removeEventListener('click', toggle)
    doc.removeEventListener('click', onLink)
    doc.removeEventListener('auxclick', onLink)
    doc.removeEventListener('visibilitychange', viewWhenVisible)
    doc.removeEventListener('prerenderingchange', viewWhenVisible)
    win.removeEventListener('storage', onStorage)
    win.removeEventListener('pageshow', onPageShow)
    win.removeEventListener('pagehide', onPageHide)
    client.dispose()
    // Keep the disposed owner registered: reinitialization must not count another view.
  } })
  owners.set(doc, owner)
  viewWhenVisible()
  return owner
}
