import { landingAnalyticsConfig } from './landing-analytics-config.js'
import { createLandingAnalytics, landingActionForLink, consentCategories } from './landing-analytics.js'

const owners = new WeakMap()
export function initializeWebsiteStatistics({ doc = document, win = window, config = landingAnalyticsConfig } = {}) {
  if (owners.has(doc)) return owners.get(doc)
  const dialog = doc.querySelector('[data-statistics-dialog]')
  const openers = [...doc.querySelectorAll('[data-statistics-open]')]
  const states = [...doc.querySelectorAll('[data-statistics-state]')]
  const accept = doc.querySelector('[data-statistics-accept]')
  const reject = doc.querySelector('[data-statistics-reject]')
  const configure = doc.querySelector('[data-statistics-configure]')
  const save = doc.querySelector('[data-statistics-save]')
  const settings = doc.querySelector('[data-statistics-settings]')
  const title = doc.querySelector('[data-statistics-title]')
  const choices = [...doc.querySelectorAll('[data-statistics-category]')]
  if (!dialog || typeof dialog.showModal !== 'function' || !accept || !reject || !configure
    || !save || !settings || !title || choices.length !== consentCategories.length) return undefined
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
  let prompted = false
  function refresh(syncChoices = false) {
    const state = client.synchronize()
    for (const element of states) element.hidden = element.dataset.statisticsState !== state
    const forced = state === 'browser' || state === 'storage'
    accept.disabled = forced
    save.disabled = forced
    const selected = client.preferences()
    for (const choice of choices) {
      choice.disabled = forced
      if (syncChoices) choice.checked = selected[choice.dataset.statisticsCategory] === true
    }
    return state
  }
  function open(event) {
    event?.preventDefault()
    prompted = true
    refresh(true)
    delete dialog.dataset.configuring
    settings.hidden = true
    configure.hidden = false
    save.hidden = true
    if (!dialog.open) dialog.showModal()
    title.focus()
  }
  function viewWhenVisible() {
    const state = refresh()
    if (doc.visibilityState !== 'visible' || doc.prerendering) return
    if (state === 'pending' && !prompted) open()
    client.pageView()
  }
  function choose(categories) {
    client.setConsent(categories)
    dialog.close()
    viewWhenVisible()
  }
  function allow() { choose(Object.fromEntries(consentCategories.map(key => [key, true]))) }
  function decline() { choose(Object.fromEntries(consentCategories.map(key => [key, false]))) }
  function customize() { dialog.dataset.configuring = 'true'; settings.hidden = false; configure.hidden = true; save.hidden = false; (choices[0].disabled ? title : choices[0]).focus() }
  function saveChoices() { choose(Object.fromEntries(choices.map(choice => [choice.dataset.statisticsCategory, choice.checked]))) }
  function cancel(event) { event.preventDefault(); dialog.close(); refresh() }
  function onStorage(event) {
    if (event.key === config.preferenceKey || event.key === config.preferenceKey + '.consent.v1' || event.key === null) {
      refresh(true)
      viewWhenVisible()
    }
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
  const listeners = [[accept, 'click', allow], [reject, 'click', decline], [configure, 'click', customize],
    [save, 'click', saveChoices], [dialog, 'cancel', cancel], ...openers.map(node => [node, 'click', open]),
    [doc, 'click', onLink], [doc, 'auxclick', onLink], [doc, 'visibilitychange', viewWhenVisible],
    [doc, 'prerenderingchange', viewWhenVisible], [win, 'storage', onStorage],
    [win, 'pageshow', onPageShow], [win, 'pagehide', onPageHide]]
  for (const [node, event, handler] of listeners) node.addEventListener(event, handler)
  for (const opener of openers) opener.hidden = false
  const owner = Object.freeze({ dispose() {
    for (const [node, event, handler] of listeners) node.removeEventListener(event, handler)
    if (dialog.open) dialog.close()
    client.dispose()
  } })
  owners.set(doc, owner)
  viewWhenVisible()
  return owner
}
