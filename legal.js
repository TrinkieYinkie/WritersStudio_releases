const themeKey = 'writersstudio.theme'
const root = document.documentElement
const button = document.querySelector('[data-legal-theme-toggle]')
const preference = window.matchMedia('(prefers-color-scheme: dark)')

function savedTheme() {
  try {
    const value = window.localStorage.getItem(themeKey)
    return value === 'light' || value === 'dark' ? value : undefined
  } catch {
    return undefined
  }
}

let choice = savedTheme()

function applyTheme(theme) {
  root.dataset.theme = theme
  root.style.colorScheme = theme
  if (button) {
    button.setAttribute('aria-label', theme === 'dark' ? button.dataset.toLight : button.dataset.toDark)
    button.dataset.nextTheme = theme === 'dark' ? 'light' : 'dark'
  }
}

applyTheme(choice ?? (preference.matches ? 'dark' : 'light'))
if (button) {
  button.hidden = false
  button.addEventListener('click', () => {
    choice = root.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(choice)
    try { window.localStorage.setItem(themeKey, choice) } catch {
      // Keep the explicit choice for this page when storage is unavailable.
    }
  })
}
preference.addEventListener('change', event => {
  if (!choice) applyTheme(event.matches ? 'dark' : 'light')
})
window.addEventListener('storage', event => {
  if (event.key !== null && event.key !== themeKey) return
  choice = savedTheme()
  applyTheme(choice ?? (preference.matches ? 'dark' : 'light'))
})
