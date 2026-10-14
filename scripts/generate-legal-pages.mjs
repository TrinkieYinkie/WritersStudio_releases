import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(resolve(root, 'legal/documents.json'), 'utf8'))
assert.match(data.version, /^\d{4}-\d{2}-\d{2}$/u)
assert.deepEqual(Object.keys(data.locales).sort(), ['en', 'es', 'ru'])
const check = process.argv.includes('--check')
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
let count = 0
for (const kind of ['terms', 'privacy']) {
  for (const [locale, copy] of Object.entries(data.locales)) {
    for (const versioned of [false, true]) {
      const suffix = locale === 'en' ? '' : `${locale}/`
      const route = `${kind}/${versioned ? `${data.version}/` : ''}${suffix}`
      const output = resolve(root, route, 'index.html')
      const base = `${relative(dirname(output), root).replaceAll('\\', '/')}/`
      const title = copy[`${kind}Title`]
      const canonical = `https://writersstudio.app/${kind}/${data.version}/${suffix}`
      const languageLinks = Object.entries(data.locales).map(([code, item]) => `<a href="${base}${kind}/${data.version}/${code === 'en' ? '' : `${code}/`}" lang="${code}" hreflang="${code}"${code === locale ? ' aria-current="page"' : ''}>${escape(item.label)}</a>`).join('\n        ')
      const sections = copy[kind].map(([heading, paragraphs], index) => {
        assert.equal(typeof heading, 'string')
        assert(paragraphs.length > 0)
        return `<section aria-labelledby="section-${index + 1}"><h2 id="section-${index + 1}">${escape(heading)}</h2>${paragraphs.map(text => `<p>${escape(text)}</p>`).join('\n')}</section>`
      }).join('\n')
      const html = `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escape(title)} — WritersStudio. ${escape(copy.version)} ${data.version}." />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="${base}assets/writersstudio-icon.png" />
    <script>
      (() => {
        let saved
        try { saved = localStorage.getItem('writersstudio.theme') } catch { saved = undefined }
        const theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        document.documentElement.dataset.theme = theme
        document.documentElement.style.colorScheme = theme
      })()
    </script>
    <link rel="stylesheet" href="${base}styles.css" />
    <link rel="stylesheet" href="${base}legal.css" />
    <title>${escape(title)} · WritersStudio</title>
  </head>
  <body class="legal-page">
    <header class="legal-header">
      <a class="brand" href="${base}index.html" aria-label="${escape(copy.home)}"><img src="${base}assets/writersstudio-icon.png" alt="" width="40" height="40" /><span>WritersStudio</span></a>
      <nav aria-label="Language">${languageLinks}</nav>
    </header>
    <main id="main-content" class="legal-document">
      <p class="legal-version">${escape(copy.version)} ${data.version}</p>
      <h1>${escape(title)}</h1>
      <p class="legal-permalink"><a href="${base}${kind}/${data.version}/${suffix}">${escape(copy.permalink)}</a></p>
      ${sections}
      ${kind === 'privacy' ? '<p class="legal-providers"><a href="https://www.hetzner.com/legal/privacy-policy/">Hetzner · Privacy</a><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub · Privacy</a></p>' : ''}
    </main>
    <footer class="legal-footer">
      <a href="${base}index.html">WritersStudio</a>
      <a href="${base}terms/${suffix}">${escape(copy.termsTitle)}</a>
      <a href="${base}privacy/${suffix}">${escape(copy.privacyTitle)}</a>
      <a href="mailto:${data.contact}">${data.contact}</a>
    </footer>
  </body>
</html>
`
      if (check) assert.equal(await readFile(output, 'utf8'), html, `Generated legal page is stale: ${route}`)
      else { await mkdir(dirname(output), { recursive: true }); await writeFile(output, html) }
      count += 1
    }
  }
}
console.log(`${check ? 'Verified' : 'Generated'} ${count} legal pages for policy ${data.version}.`)
