const RELEASES_API = 'https://api.github.com/repos/TrinkieYinkie/WritersStudio_releases/releases?per_page=100'
const RELEASES_PAGE = 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases'
const GITHUB_HOSTS = new Set(['github.com', 'objects.githubusercontent.com'])
const LOCALES_URL = 'locales.json'
const LOCALE_STORAGE_KEY = 'writersstudio.locale'
const DEFAULT_LOCALE = 'en'
const localeState = {
  catalog: undefined,
  locale: DEFAULT_LOCALE,
  messages: Object.freeze({})
}
const releaseState = {
  count: 0,
  status: 'idle',
  platforms: {
    windows: [],
    macos: []
  }
}

const platformCopy = Object.freeze({
  windows: Object.freeze({
    labelKey: 'platform.windows',
    emptyTitleKey: 'release.windowsTitle',
    emptyVersionKey: 'dynamic.windowsEmptyVersion',
    emptyDetailKey: 'release.windowsDetail',
    downloadKey: 'dynamic.downloadWindows',
    releasesKey: 'release.windowsView',
    olderEmptyKey: 'release.windowsOlderEmpty'
  }),
  macos: Object.freeze({
    labelKey: 'platform.macos',
    emptyTitleKey: 'release.macosTitle',
    emptyVersionKey: 'release.macosVersion',
    emptyDetailKey: 'release.macosDetail',
    downloadKey: 'dynamic.downloadMacos',
    releasesKey: 'release.macosView',
    olderEmptyKey: 'release.macosOlderEmpty'
  })
})

const fallbackMessages = Object.freeze({
  'dynamic.apiUnavailable': 'GitHub release data is unavailable right now. The official Releases page remains available.',
  'dynamic.downloadMacos': 'Download for macOS',
  'dynamic.downloadWindows': 'Download for Windows',
  'dynamic.getVersion': 'Get {version}',
  'dynamic.latestBeta': 'Latest public beta',
  'dynamic.latestStable': 'Latest stable release',
  'dynamic.loadedMany': 'Loaded directly from the official GitHub repository · {count} public releases',
  'dynamic.loadedOne': 'Loaded directly from the official GitHub repository · 1 public release',
  'dynamic.macosEmptyVersion': 'Not published yet',
  'dynamic.noPublicBuild': 'No public build is published yet',
  'dynamic.noPublicReleases': 'No public releases yet. This page will update automatically when the first one is published.',
  'dynamic.officialRelease': 'Official {platform} release',
  'dynamic.releaseUnavailable': 'Could not reach GitHub · try the official releases page',
  'dynamic.windowsEmptyVersion': 'First public build coming soon',
  'nav.getFree': 'Get it free',
  'platform.macos': 'macOS',
  'platform.windows': 'Windows',
  'release.macosDetail': 'The page is ready for the first official macOS build.',
  'release.macosOlderEmpty': 'No macOS releases are published yet.',
  'release.macosTitle': 'WritersStudio for macOS',
  'release.macosVersion': 'Not published yet',
  'release.macosView': 'View macOS releases',
  'release.windowsDetail': '64-bit Windows · installer from GitHub Releases',
  'release.windowsOlderEmpty': 'No older Windows releases are published yet.',
  'release.windowsTitle': 'Windows public beta',
  'release.windowsView': 'View Windows releases'
})

function translate(key, values = {}) {
  const template = localeState.messages[key] ?? fallbackMessages[key] ?? key
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  )
}

export function selectInitialLocale({
  storedLocale,
  deviceLocales = [],
  supportedLocales = ['en', 'ru', 'es'],
  defaultLocale = DEFAULT_LOCALE
}) {
  const supported = new Set(supportedLocales.map((locale) => locale.toLowerCase()))
  const normalize = (value) => typeof value === 'string' ? value.toLowerCase().split('-')[0] : undefined
  const stored = normalize(storedLocale)
  if (stored && supported.has(stored)) return stored
  for (const candidate of deviceLocales) {
    const normalized = normalize(candidate)
    if (normalized && supported.has(normalized)) return normalized
  }
  const normalizedDefault = normalize(defaultLocale)
  return normalizedDefault && supported.has(normalizedDefault) ? normalizedDefault : supportedLocales[0]
}

function safeGithubUrl(value, fallback = RELEASES_PAGE) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && GITHUB_HOSTS.has(url.hostname) ? url.href : fallback
  } catch {
    return fallback
  }
}

function assetExtension(name) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/u)
  return match?.[0] ?? ''
}

function assetArchitecture(name) {
  const normalized = name.toLowerCase()
  if (/\b(?:universal|universal2)\b/u.test(normalized)) return 'Universal'
  if (/\b(?:arm64|aarch64|apple[ -]?silicon)\b/u.test(normalized)) return 'Apple silicon'
  if (/\b(?:x64|x86_64|amd64)\b/u.test(normalized)) return '64-bit'
  return undefined
}

function isSupportingAsset(name) {
  return /(?:\.blockmap|\.ya?ml|\.json|\.sha(?:256|512)?|checksums?|latest|\.sig|\.asc|\.txt)$/iu.test(name)
}

export function classifyReleaseAsset(asset) {
  if (!asset || typeof asset.name !== 'string' || isSupportingAsset(asset.name)) return undefined

  const name = asset.name.toLowerCase()
  const extension = assetExtension(name)
  const windows = ['.exe', '.msi', '.msix'].includes(extension)
    || (extension === '.zip' && /(?:^|[-_. ])(?:win|windows)(?:[-_. ]|$)/u.test(name))
  const macos = ['.dmg', '.pkg'].includes(extension)
    || (extension === '.zip' && /(?:^|[-_. ])(?:mac|macos|darwin|osx)(?:[-_. ]|$)/u.test(name))

  if (!windows && !macos) return undefined

  return Object.freeze({
    architecture: assetArchitecture(name),
    name: asset.name,
    platform: windows ? 'windows' : 'macos',
    size: Number.isFinite(asset.size) && asset.size >= 0 ? asset.size : undefined,
    url: safeGithubUrl(asset.browser_download_url)
  })
}

function assetPreference(asset) {
  const name = asset.name.toLowerCase()
  let score = 0
  if (name.endsWith('.dmg') || name.endsWith('.exe')) score += 30
  if (name.endsWith('.pkg') || name.endsWith('.msi') || name.endsWith('.msix')) score += 20
  if (/(?:setup|installer)/u.test(name)) score += 12
  if (/(?:universal|x64|x86_64|amd64)/u.test(name)) score += 5
  if (/(?:portable|debug|symbols)/u.test(name)) score -= 8
  return score
}

export function collectPlatformReleases(releases, platform) {
  if (!Array.isArray(releases) || !(platform in platformCopy)) return []

  return releases
    .filter((release) => release && release.draft !== true && Array.isArray(release.assets))
    .map((release) => {
      const assets = release.assets
        .map(classifyReleaseAsset)
        .filter((asset) => asset?.platform === platform)
        .sort((left, right) => assetPreference(right) - assetPreference(left))

      if (assets.length === 0) return undefined

      const publishedAt = typeof release.published_at === 'string' ? release.published_at : ''
      const tag = typeof release.tag_name === 'string' && release.tag_name.trim()
        ? release.tag_name.trim()
        : 'Release'

      return Object.freeze({
        assets,
        name: typeof release.name === 'string' && release.name.trim() ? release.name.trim() : tag,
        prerelease: release.prerelease === true,
        publishedAt,
        tag,
        url: safeGithubUrl(release.html_url)
      })
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return undefined
  const megabytes = value / (1024 * 1024)
  return `${megabytes >= 100 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return undefined
  const dateLocales = { en: 'en', ru: 'ru', es: 'es' }
  return new Intl.DateTimeFormat(dateLocales[localeState.locale] ?? 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function releaseDetail(release, asset) {
  const parts = [asset.architecture, formatBytes(asset.size), formatDate(release.publishedAt)].filter(Boolean)
  return parts.length > 0
    ? parts.join(' · ')
    : translate('dynamic.officialRelease', { platform: translate(platformCopy[asset.platform].labelKey) })
}

function createReleaseMenuItem(release, asset) {
  const link = document.createElement('a')
  link.href = asset.url
  link.setAttribute('role', 'menuitem')

  const version = document.createElement('strong')
  version.textContent = release.tag
  const size = document.createElement('span')
  size.textContent = formatBytes(asset.size) ?? translate(platformCopy[asset.platform].labelKey)
  const detail = document.createElement('span')
  detail.textContent = [asset.architecture, formatDate(release.publishedAt), asset.name].filter(Boolean).join(' · ')

  link.append(version, size, detail)
  return link
}

function renderPlatform(panel, platform, releases) {
  const copy = platformCopy[platform]
  const statusLine = panel.querySelector('.release-status')
  const status = panel.querySelector('[data-release-status]')
  const title = panel.querySelector('[data-release-title]')
  const version = panel.querySelector('[data-release-version]')
  const detail = panel.querySelector('[data-release-detail]')
  const download = panel.querySelector('[data-release-download]')
  const downloadText = download?.querySelector('span')
  const notes = panel.querySelector('[data-release-notes]')
  const menu = panel.querySelector('[data-release-menu]')
  const menuButton = panel.querySelector('[data-release-menu-button]')
  const latest = releases[0]

  if (!latest) {
    statusLine?.classList.remove('is-ready')
    if (status) status.textContent = translate('dynamic.noPublicBuild')
    if (title) title.textContent = translate(copy.emptyTitleKey)
    if (version) version.textContent = translate(copy.emptyVersionKey)
    if (detail) detail.textContent = translate(copy.emptyDetailKey)
    if (download) download.href = RELEASES_PAGE
    if (downloadText) downloadText.textContent = translate(copy.releasesKey)
    if (notes) notes.href = RELEASES_PAGE
  } else {
    const primaryAsset = latest.assets[0]
    statusLine?.classList.add('is-ready')
    if (status) status.textContent = translate(latest.prerelease ? 'dynamic.latestBeta' : 'dynamic.latestStable')
    if (title) title.textContent = `${translate(copy.labelKey)} ${latest.tag}`
    if (version) version.textContent = latest.name === latest.tag ? latest.tag : latest.name
    if (detail) detail.textContent = releaseDetail(latest, primaryAsset)
    if (download) download.href = primaryAsset.url
    if (downloadText) downloadText.textContent = translate(copy.downloadKey)
    if (notes) notes.href = latest.url
  }

  if (!menu || !menuButton) return
  menu.replaceChildren()
  const older = releases.slice(1)
  if (older.length === 0) {
    const empty = document.createElement('p')
    empty.dataset.releaseMenuEmpty = ''
    empty.textContent = translate(copy.olderEmptyKey)
    menu.append(empty)
    menuButton.disabled = true
    menuButton.setAttribute('aria-disabled', 'true')
    return
  }

  menuButton.disabled = false
  menuButton.removeAttribute('aria-disabled')
  for (const release of older) {
    for (const asset of release.assets) menu.append(createReleaseMenuItem(release, asset))
  }
}

function storedLocale() {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return undefined
  }
}

function persistLocale(locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The selected language still applies for this page when storage is unavailable.
  }
}

function renderReleaseState() {
  const apiStatus = document.querySelector('[data-api-status]')
  const heroDownload = document.querySelector('[data-hero-download]')
  const headerDownload = document.querySelector('[data-header-download]')

  if (releaseState.status === 'idle') return

  for (const platform of Object.keys(releaseState.platforms)) {
    const panel = document.querySelector(`[data-platform-panel="${platform}"]`)
    if (panel) renderPlatform(panel, platform, releaseState.platforms[platform])
  }

  if (releaseState.status === 'error') {
    if (apiStatus) apiStatus.textContent = translate('dynamic.apiUnavailable')
    for (const panel of document.querySelectorAll('[data-platform-panel]')) {
      const status = panel.querySelector('[data-release-status]')
      if (status) status.textContent = translate('dynamic.releaseUnavailable')
    }
  } else if (apiStatus) {
    apiStatus.textContent = releaseState.count === 0
      ? translate('dynamic.noPublicReleases')
      : translate(releaseState.count === 1 ? 'dynamic.loadedOne' : 'dynamic.loadedMany', {
          count: releaseState.count
        })
  }

  const current = releaseState.platforms[detectedPlatform()][0]
  if (current) {
    const primaryAsset = current.assets[0]
    if (heroDownload) heroDownload.href = primaryAsset.url
    if (headerDownload) {
      headerDownload.href = primaryAsset.url
      headerDownload.textContent = translate('dynamic.getVersion', { version: current.tag })
    }
  } else {
    if (heroDownload) heroDownload.href = '#download'
    if (headerDownload) {
      headerDownload.href = '#download'
      headerDownload.textContent = translate('nav.getFree')
    }
  }
}

function applyLocale(locale, { persist = false } = {}) {
  const entry = localeState.catalog?.locales?.[locale]
  if (!entry) return

  localeState.locale = locale
  localeState.messages = entry.messages
  document.documentElement.lang = locale
  document.title = entry.pageTitle
  const description = document.querySelector('meta[name="description"]')
  if (description) description.content = entry.pageDescription

  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = translate(element.dataset.i18n)
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel))
  }
  for (const element of document.querySelectorAll('[data-i18n-alt]')) {
    element.setAttribute('alt', translate(element.dataset.i18nAlt))
  }

  const code = document.querySelector('[data-language-code]')
  if (code) code.textContent = entry.shortLabel
  for (const option of document.querySelectorAll('[data-language-option]')) {
    option.setAttribute('aria-checked', String(option.dataset.languageOption === locale))
  }
  if (persist) persistLocale(locale)
  renderReleaseState()
}

async function loadLocaleCatalog() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(LOCALES_URL, { signal: controller.signal })
    if (!response.ok) throw new Error(`Locales returned ${response.status}.`)
    const catalog = await response.json()
    if (!catalog || typeof catalog !== 'object' || !catalog.locales) throw new TypeError('Locales catalog is invalid.')
    return catalog
  } finally {
    window.clearTimeout(timeout)
  }
}

function closeLanguageMenu({ returnFocus = false } = {}) {
  const button = document.querySelector('[data-language-button]')
  const menu = document.querySelector('[data-language-menu]')
  if (!button || !menu) return
  button.setAttribute('aria-expanded', 'false')
  menu.hidden = true
  if (returnFocus) button.focus()
}

function initializeLanguagePicker() {
  const picker = document.querySelector('[data-language-picker]')
  const button = picker?.querySelector('[data-language-button]')
  const menu = picker?.querySelector('[data-language-menu]')
  const options = [...(picker?.querySelectorAll('[data-language-option]') ?? [])]
  if (!picker || !button || !menu || options.length === 0) return

  const open = ({ focusSelected = false } = {}) => {
    button.setAttribute('aria-expanded', 'true')
    menu.hidden = false
    if (focusSelected) {
      options.find((option) => option.dataset.languageOption === localeState.locale)?.focus()
    }
  }

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-expanded') === 'true') closeLanguageMenu()
    else open()
  })
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    open({ focusSelected: true })
  })

  options.forEach((option, index) => {
    option.addEventListener('click', () => {
      applyLocale(option.dataset.languageOption, { persist: true })
      closeLanguageMenu({ returnFocus: true })
    })
    option.addEventListener('keydown', (event) => {
      let nextIndex
      if (event.key === 'ArrowDown') nextIndex = (index + 1) % options.length
      if (event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = options.length - 1
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLanguageMenu({ returnFocus: true })
        return
      }
      if (nextIndex === undefined) return
      event.preventDefault()
      options[nextIndex].focus()
    })
  })

  document.addEventListener('pointerdown', (event) => {
    if (!picker.contains(event.target)) closeLanguageMenu()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      closeLanguageMenu({ returnFocus: true })
    }
  })
}

async function initializeLocalization() {
  const button = document.querySelector('[data-language-button]')
  try {
    localeState.catalog = await loadLocaleCatalog()
    const locale = selectInitialLocale({
      storedLocale: storedLocale(),
      deviceLocales: navigator.languages ?? [navigator.language],
      supportedLocales: localeState.catalog.supportedLocales,
      defaultLocale: localeState.catalog.defaultLocale ?? DEFAULT_LOCALE
    })
    applyLocale(locale)
    initializeLanguagePicker()
  } catch {
    if (button) button.disabled = true
    document.documentElement.lang = DEFAULT_LOCALE
  }
}

function detectedPlatform() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent
  return /mac/i.test(platform) ? 'macos' : 'windows'
}

function selectPlatform(platform, { focus = false } = {}) {
  const tabs = [...document.querySelectorAll('[data-platform-tab]')]
  for (const tab of tabs) {
    const active = tab.dataset.platformTab === platform
    tab.classList.toggle('is-active', active)
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
    if (active && focus) tab.focus()
  }

  for (const panel of document.querySelectorAll('[data-platform-panel]')) {
    panel.hidden = panel.dataset.platformPanel !== platform
  }
}

function initializePlatformTabs() {
  const tabs = [...document.querySelectorAll('[data-platform-tab]')]
  if (tabs.length === 0) return
  selectPlatform(detectedPlatform())

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPlatform(tab.dataset.platformTab))
    tab.addEventListener('keydown', (event) => {
      let nextIndex
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = tabs.length - 1
      if (nextIndex === undefined) return
      event.preventDefault()
      selectPlatform(tabs[nextIndex].dataset.platformTab, { focus: true })
    })
  })
}

function closeReleaseMenu(picker, { returnFocus = false } = {}) {
  const button = picker.querySelector('[data-release-menu-button]')
  const menu = picker.querySelector('[data-release-menu]')
  if (!button || !menu) return
  button.setAttribute('aria-expanded', 'false')
  menu.hidden = true
  if (returnFocus) button.focus()
}

function initializeReleaseMenus() {
  const pickers = [...document.querySelectorAll('[data-release-picker]')]

  for (const picker of pickers) {
    const button = picker.querySelector('[data-release-menu-button]')
    const menu = picker.querySelector('[data-release-menu]')
    if (!button || !menu) continue

    const open = ({ focusFirst = false } = {}) => {
      if (button.disabled) return
      for (const other of pickers) if (other !== picker) closeReleaseMenu(other)
      button.setAttribute('aria-expanded', 'true')
      menu.hidden = false
      if (focusFirst) menu.querySelector('[role="menuitem"]')?.focus()
    }

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-expanded') === 'true') closeReleaseMenu(picker)
      else open()
    })

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown') return
      event.preventDefault()
      open({ focusFirst: true })
    })

    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('[role="menuitem"]')]
      const current = items.indexOf(document.activeElement)
      if (event.key === 'Escape') {
        event.preventDefault()
        closeReleaseMenu(picker, { returnFocus: true })
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0) return
      event.preventDefault()
      let next = current
      if (event.key === 'ArrowDown') next = (current + 1) % items.length
      if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
      if (event.key === 'Home') next = 0
      if (event.key === 'End') next = items.length - 1
      items[next]?.focus()
    })
  }

  document.addEventListener('pointerdown', (event) => {
    for (const picker of pickers) if (!picker.contains(event.target)) closeReleaseMenu(picker)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    for (const picker of pickers) closeReleaseMenu(picker)
  })
}

function setStory(index) {
  for (const visual of document.querySelectorAll('[data-story-visual]')) {
    const active = Number(visual.dataset.storyVisual) === index
    visual.classList.toggle('is-active', active)
    visual.setAttribute('aria-hidden', String(!active))
  }
  for (const step of document.querySelectorAll('[data-story-step]')) {
    step.classList.toggle('is-active', Number(step.dataset.storyStep) === index)
  }
  for (const control of document.querySelectorAll('[data-story-control]')) {
    const active = Number(control.dataset.storyControl) === index
    control.classList.toggle('is-active', active)
    control.setAttribute('aria-pressed', String(active))
  }
}

function initializeStory() {
  const steps = [...document.querySelectorAll('[data-story-step]')]
  if (steps.length === 0) return

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
    if (visible) setStory(Number(visible.target.dataset.storyStep))
  }, { rootMargin: '-30% 0px -42% 0px', threshold: [0, 0.2, 0.5, 0.8] })

  steps.forEach((step) => observer.observe(step))
  for (const control of document.querySelectorAll('[data-story-control]')) {
    control.addEventListener('click', () => {
      const index = Number(control.dataset.storyControl)
      setStory(index)
      steps[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}

function initializeReveal() {
  const elements = [...document.querySelectorAll('.reveal')]
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((element) => element.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

  elements.forEach((element) => observer.observe(element))
}

function initializeHeader() {
  const header = document.querySelector('[data-site-header]')
  if (!header) return
  let scheduled = false
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 72)
    scheduled = false
  }
  window.addEventListener('scroll', () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(update)
  }, { passive: true })
  update()
}

async function loadReleases() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`)
    const releases = await response.json()
    if (!Array.isArray(releases)) throw new TypeError('GitHub releases response is not an array.')

    releaseState.platforms = {
      windows: collectPlatformReleases(releases, 'windows'),
      macos: collectPlatformReleases(releases, 'macos')
    }
    releaseState.count = releases.filter((release) => release?.draft !== true).length
    releaseState.status = 'loaded'
  } catch {
    releaseState.count = 0
    releaseState.status = 'error'
    releaseState.platforms = {
      windows: [],
      macos: []
    }
  } finally {
    window.clearTimeout(timeout)
    renderReleaseState()
  }
}

async function initializePage() {
  document.querySelector('[data-current-year]').textContent = String(new Date().getFullYear())
  initializeHeader()
  initializePlatformTabs()
  initializeReleaseMenus()
  initializeStory()
  initializeReveal()
  await initializeLocalization()
  void loadReleases()
}

if (typeof document !== 'undefined') void initializePage()
