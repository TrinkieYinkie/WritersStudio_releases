const RELEASES_API = 'https://api.github.com/repos/TrinkieYinkie/WritersStudio_releases/releases?per_page=100'
const RELEASES_PAGE = 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases'
const GITHUB_HOSTS = new Set(['github.com', 'objects.githubusercontent.com'])

const platformCopy = Object.freeze({
  windows: Object.freeze({
    label: 'Windows',
    emptyTitle: 'Windows public beta',
    emptyVersion: 'First public build coming soon',
    emptyDetail: '64-bit Windows · installer from GitHub Releases',
    downloadLabel: 'Download for Windows',
    releasesLabel: 'View Windows releases',
    olderEmpty: 'No older Windows releases are published yet.'
  }),
  macos: Object.freeze({
    label: 'macOS',
    emptyTitle: 'WritersStudio for macOS',
    emptyVersion: 'Not published yet',
    emptyDetail: 'The page is ready for the first official macOS build.',
    downloadLabel: 'Download for macOS',
    releasesLabel: 'View macOS releases',
    olderEmpty: 'No macOS releases are published yet.'
  })
})

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
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function releaseDetail(release, asset) {
  const parts = [asset.architecture, formatBytes(asset.size), formatDate(release.publishedAt)].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : `Official ${platformCopy[asset.platform].label} release`
}

function createReleaseMenuItem(release, asset) {
  const link = document.createElement('a')
  link.href = asset.url
  link.setAttribute('role', 'menuitem')

  const version = document.createElement('strong')
  version.textContent = release.tag
  const size = document.createElement('span')
  size.textContent = formatBytes(asset.size) ?? platformCopy[asset.platform].label
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
    if (status) status.textContent = 'No public build is published yet'
    if (title) title.textContent = copy.emptyTitle
    if (version) version.textContent = copy.emptyVersion
    if (detail) detail.textContent = copy.emptyDetail
    if (download) download.href = RELEASES_PAGE
    if (downloadText) downloadText.textContent = copy.releasesLabel
    if (notes) notes.href = RELEASES_PAGE
  } else {
    const primaryAsset = latest.assets[0]
    statusLine?.classList.add('is-ready')
    if (status) status.textContent = latest.prerelease ? 'Latest public beta' : 'Latest stable release'
    if (title) title.textContent = `${copy.label} ${latest.tag}`
    if (version) version.textContent = latest.name === latest.tag ? latest.tag : latest.name
    if (detail) detail.textContent = releaseDetail(latest, primaryAsset)
    if (download) download.href = primaryAsset.url
    if (downloadText) downloadText.textContent = copy.downloadLabel
    if (notes) notes.href = latest.url
  }

  if (!menu || !menuButton) return
  menu.replaceChildren()
  const older = releases.slice(1)
  if (older.length === 0) {
    const empty = document.createElement('p')
    empty.dataset.releaseMenuEmpty = ''
    empty.textContent = copy.olderEmpty
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
  const status = document.querySelector('[data-api-status]')
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

    const platformReleases = {
      windows: collectPlatformReleases(releases, 'windows'),
      macos: collectPlatformReleases(releases, 'macos')
    }

    for (const platform of Object.keys(platformReleases)) {
      const panel = document.querySelector(`[data-platform-panel="${platform}"]`)
      if (panel) renderPlatform(panel, platform, platformReleases[platform])
    }

    if (status) {
      const count = releases.filter((release) => release?.draft !== true).length
      status.textContent = count === 0
        ? 'No public releases yet. This page will update automatically when the first one is published.'
        : `Loaded directly from the official GitHub repository · ${count} public ${count === 1 ? 'release' : 'releases'}`
    }

    const current = platformReleases[detectedPlatform()][0]
    if (current) {
      const primaryAsset = current.assets[0]
      for (const link of document.querySelectorAll('[data-hero-download], [data-header-download]')) {
        link.href = primaryAsset.url
        if (link.matches('[data-header-download]')) link.textContent = `Get ${current.tag}`
      }
    }
  } catch {
    if (status) {
      status.textContent = 'GitHub release data is unavailable right now. The official Releases page remains available.'
    }
    for (const panel of document.querySelectorAll('[data-platform-panel]')) {
      const releaseStatus = panel.querySelector('[data-release-status]')
      if (releaseStatus) releaseStatus.textContent = 'Could not reach GitHub · try the official releases page'
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

function initializePage() {
  document.querySelector('[data-current-year]').textContent = String(new Date().getFullYear())
  initializeHeader()
  initializePlatformTabs()
  initializeReleaseMenus()
  initializeStory()
  initializeReveal()
  void loadReleases()
}

if (typeof document !== 'undefined') initializePage()
