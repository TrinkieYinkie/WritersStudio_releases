import { websiteAnalyticsConfig } from './website-analytics-config.js'
import { createWebsiteStatistics, statisticsEventForLink, statisticsPreferenceKey } from './website-analytics.js'

export function initializeWebsiteStatistics({ doc = document, win = window,
  config = websiteAnalyticsConfig } = {}) {
  const control = doc.querySelector('[data-statistics-toggle]')
  const states = [...doc.querySelectorAll('[data-statistics-state]')]
  if (!control || states.length === 0) return undefined
  const client = createWebsiteStatistics({
    config, origin: win.location.origin,
    storage: {
      getItem: key => win.localStorage.getItem(key),
      setItem: (key, value) => win.localStorage.setItem(key, value),
      removeItem: key => win.localStorage.removeItem(key)
    },
    privacySignal: () => win.navigator.globalPrivacyControl === true
      || win.navigator.doNotTrack === '1' || win.doNotTrack === '1',
    fetch: (url, options) => win.fetch(url, options),
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
    return state
  }
  function viewWhenVisible() {
    if (doc.visibilityState === 'visible' && !doc.prerendering) client.pageView()
  }
  function toggle() {
    client.exclude(control.getAttribute('aria-pressed') !== 'true')
    refresh()
    viewWhenVisible()
  }
  function onStorage(event) {
    if (event.key === statisticsPreferenceKey || event.key === null) {
      refresh()
      viewWhenVisible()
    }
  }
  function onLink(event) {
    if (!event.isTrusted || event.defaultPrevented || doc.visibilityState !== 'visible'
        || (event.type === 'click' ? event.button !== 0 : event.button !== 1)) return
    const link = event.target?.closest?.('a[data-statistics-link]')
    if (!link) return
    const metric = statisticsEventForLink({ kind: link.dataset.statisticsLink,
      placement: link.dataset.statisticsPlacement, platform: link.dataset.statisticsPlatform,
      href: link.href }, win.location.origin)
    if (metric) client.record(metric)
  }
  function onPageHide() { client.synchronize() }
  control.addEventListener('click', toggle)
  doc.addEventListener('click', onLink)
  doc.addEventListener('auxclick', onLink)
  doc.addEventListener('visibilitychange', viewWhenVisible)
  doc.addEventListener('prerenderingchange', viewWhenVisible)
  win.addEventListener('storage', onStorage)
  win.addEventListener('pageshow', refresh)
  win.addEventListener('pagehide', onPageHide)
  refresh()
  viewWhenVisible()
  return Object.freeze({
    dispose() {
      control.removeEventListener('click', toggle)
      doc.removeEventListener('click', onLink)
      doc.removeEventListener('auxclick', onLink)
      doc.removeEventListener('visibilitychange', viewWhenVisible)
      doc.removeEventListener('prerenderingchange', viewWhenVisible)
      win.removeEventListener('storage', onStorage)
      win.removeEventListener('pageshow', refresh)
      win.removeEventListener('pagehide', onPageHide)
      client.dispose()
    }
  })
}
