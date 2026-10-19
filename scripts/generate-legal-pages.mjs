import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(resolve(root, 'legal/documents.json'), 'utf8'))
const presentation = JSON.parse(await readFile(resolve(root, 'legal/presentation.json'), 'utf8'))
assert.match(data.version, /^\d{4}-\d{2}-\d{2}$/u)
assert.deepEqual(Object.keys(data.locales).sort(), ['en', 'es', 'ru'])
assert.deepEqual(Object.keys(presentation).sort(), Object.keys(data.locales).sort())
const check = process.argv.includes('--check')
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
let count = 0

for (const kind of ['terms', 'privacy']) {
  for (const [locale, copy] of Object.entries(data.locales)) {
    const ui = presentation[locale]
    for (const versioned of [false, true]) {
      const suffix = locale === 'en' ? '' : `${locale}/`
      const route = `${kind}/${versioned ? `${data.version}/` : ''}${suffix}`
      const output = resolve(root, route, 'index.html')
      const base = `${relative(dirname(output), root).replaceAll('\\', '/')}/`
      const title = copy[`${kind}Title`]
      const canonical = `https://writersstudio.app/${kind}/${data.version}/${suffix}`
      const languageLinks = Object.entries(data.locales).map(([code, item]) => `<a href="${base}${kind}/${data.version}/${code === 'en' ? '' : `${code}/`}" lang="${code}" hreflang="${code}"${code === locale ? ' aria-current="page"' : ''}>${escape(item.label)}</a>`).join('\n        ')
      const documentLinks = ['terms', 'privacy'].map(document => `<a href="${base}${document}/${data.version}/${suffix}"${document === kind ? ' aria-current="page"' : ''}>${escape(copy[`${document}Title`])}</a>`).join('\n        ')
      const contents = copy[kind].map(([heading], index) => `<li><a href="#section-${index + 1}"><span class="legal-section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escape(heading)}</a></li>`).join('\n              ')
      const sections = copy[kind].map(([heading, paragraphs], index) => {
        assert.equal(typeof heading, 'string')
        assert(paragraphs.length > 0)
        return `<section aria-labelledby="section-${index + 1}"><h2 id="section-${index + 1}"><span class="legal-section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escape(heading)}</h2>${paragraphs.map(text => `<p>${escape(text)}</p>`).join('\n')}</section>`
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
    <script type="module" src="${base}legal.js"></script>
    <title>${escape(title)} · WritersStudio</title>
  </head>
  <body class="legal-page">
    <a class="skip-link" href="#main-content">${escape(ui.skip)}</a>
    <header class="legal-header">
      <a class="brand" href="${base}index.html" aria-label="${escape(copy.home)}"><img src="${base}assets/writersstudio-icon.png" alt="" width="40" height="40" /><span>WritersStudio</span></a>
      <div class="legal-tools">
        <nav aria-label="${escape(ui.language)}">${languageLinks}</nav>
        <button class="theme-toggle" type="button" data-legal-theme-toggle data-to-dark="${escape(ui.toDark)}" data-to-light="${escape(ui.toLight)}" aria-label="${escape(ui.toDark)}" hidden>
          <svg class="theme-icon theme-icon-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.6A8.2 8.2 0 0 1 8.4 4a8.5 8.5 0 1 0 11.6 11.6Z" /></svg>
          <svg class="theme-icon theme-icon-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6m11 11 1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6m11-11 1.6-1.6" /></svg>
        </button>
      </div>
    </header>
    <main id="main-content" class="legal-main">
      <nav class="legal-document-nav" aria-label="${escape(ui.navigation)}">${documentLinks}</nav>
      <div class="legal-hero">
        <p class="legal-kicker">WritersStudio / ${escape(ui.documents)}</p>
        <h1>${escape(title)}</h1>
        <p class="legal-intro">${escape(ui[`${kind}Intro`])}</p>
        <div class="legal-meta">
          <p class="legal-version">${escape(copy.version)} <time datetime="${data.version}">${data.version}</time></p>
          <a href="${base}${kind}/${data.version}/${suffix}">${escape(copy.permalink)}</a>
        </div>
      </div>
      <div class="legal-layout">
        <aside class="legal-contents">
          <nav aria-label="${escape(ui.contents)}">
            <p class="legal-contents-title">${escape(ui.contents)}</p>
            <ol>${contents}</ol>
          </nav>
          <div class="legal-contact"><p>${escape(ui.questions)}</p><a href="mailto:${escape(data.contact)}">${escape(data.contact)}</a></div>
        </aside>
        <article class="legal-document" aria-label="${escape(title)}">
          ${sections}
          ${kind === 'privacy' ? `<nav class="legal-providers" aria-label="${escape(ui.providers)}"><a href="https://www.hetzner.com/legal/privacy-policy/">Hetzner · Privacy</a><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub · Privacy</a></nav>` : ''}
        </article>
      </div>
    </main>
    <footer class="legal-footer">
      <a href="${base}index.html">WritersStudio</a>
      <a href="${base}terms/${suffix}">${escape(copy.termsTitle)}</a>
      <a href="${base}privacy/${suffix}">${escape(copy.privacyTitle)}</a>
      <a href="mailto:${escape(data.contact)}">${escape(data.contact)}</a>
    </footer>
  </body>
</html>
`.replace(/^[\t ]+$/gmu, '')
      if (check) assert.equal(await readFile(output, 'utf8'), html, `Generated legal page is stale: ${route}`)
      else { await mkdir(dirname(output), { recursive: true }); await writeFile(output, html) }
      count += 1
    }
  }
}
console.log(`${check ? 'Verified' : 'Generated'} ${count} legal pages for policy ${data.version}.`)
