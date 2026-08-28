import assert from 'node:assert/strict'
import { classifyReleaseAsset, collectPlatformReleases, selectInitialLocale } from '../app.js'

const githubAsset = (name, size = 42_000_000) => ({
  browser_download_url: `https://github.com/TrinkieYinkie/WritersStudio_releases/releases/download/v1.2.0/${name}`,
  name,
  size
})

assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0-Setup.exe')).platform, 'windows')
assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0-x64.msi')).platform, 'windows')
assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0-universal.dmg')).platform, 'macos')
assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0-macos-arm64.zip')).platform, 'macos')
assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0.zip')), undefined)
assert.equal(classifyReleaseAsset(githubAsset('latest.yml')), undefined)
assert.equal(classifyReleaseAsset(githubAsset('WritersStudio-1.2.0.exe.blockmap')), undefined)
assert.equal(classifyReleaseAsset(githubAsset('SHA256SUMS.txt')), undefined)

const releases = [
  {
    assets: [githubAsset('WritersStudio-1.1.0-Setup.exe')],
    draft: false,
    html_url: 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/tag/v1.1.0',
    name: 'First beta',
    prerelease: true,
    published_at: '2026-08-01T12:00:00Z',
    tag_name: 'v1.1.0'
  },
  {
    assets: [
      githubAsset('latest.yml'),
      githubAsset('WritersStudio-1.2.0-Windows-x64.zip'),
      githubAsset('WritersStudio-1.2.0-Setup.exe'),
      githubAsset('WritersStudio-1.2.0-universal.dmg')
    ],
    draft: false,
    html_url: 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/tag/v1.2.0',
    name: 'Second beta',
    prerelease: true,
    published_at: '2026-08-20T12:00:00Z',
    tag_name: 'v1.2.0'
  },
  {
    assets: [githubAsset('WritersStudio-9.0.0-Setup.exe')],
    draft: true,
    html_url: 'https://github.com/TrinkieYinkie/WritersStudio_releases/releases/tag/v9.0.0',
    name: 'Draft',
    published_at: '2030-01-01T00:00:00Z',
    tag_name: 'v9.0.0'
  }
]

const windows = collectPlatformReleases(releases, 'windows')
const macos = collectPlatformReleases(releases, 'macos')
assert.deepEqual(windows.map((release) => release.tag), ['v1.2.0', 'v1.1.0'])
assert.equal(windows[0].assets[0].name, 'WritersStudio-1.2.0-Setup.exe')
assert.deepEqual(macos.map((release) => release.tag), ['v1.2.0'])
assert.equal(collectPlatformReleases([], 'windows').length, 0)
assert.equal(collectPlatformReleases(releases, 'linux').length, 0)

assert.equal(selectInitialLocale({ storedLocale: 'es', deviceLocales: ['ru-RU'] }), 'es')
assert.equal(selectInitialLocale({ deviceLocales: ['ru-RU', 'en-US'] }), 'ru')
assert.equal(selectInitialLocale({ deviceLocales: ['es-MX'] }), 'es')
assert.equal(selectInitialLocale({ deviceLocales: ['de-DE', 'fr-FR'] }), 'en')
assert.equal(selectInitialLocale({ storedLocale: 'de', deviceLocales: ['es-ES'] }), 'es')

console.log('Release parser fixtures passed · platforms, drafts, metadata, ordering, empty states, and locale selection.')
