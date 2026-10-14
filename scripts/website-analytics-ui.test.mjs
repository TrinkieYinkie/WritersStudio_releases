import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { initializeWebsiteStatistics } from '../website-analytics-ui.js'
import { websiteAnalyticsConfig } from '../website-analytics-config.js'
import { statisticsPreferenceKey } from '../website-analytics.js'

class Surface {
  handlers = new Map()
  attributes = new Map()
  hidden = true
  disabled = false
  dataset = {}
  addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler) }
  removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler) }
  fire(type, detail = {}) { for (const handler of this.handlers.get(type) ?? []) handler({ type, ...detail }) }
  setAttribute(key, value) { this.attributes.set(key, value) }
  getAttribute(key) { return this.attributes.get(key) ?? null }
}
function page({ hidden = false, signal = false, enabled = true } = {}) {
  const doc = new Surface(), win = new Surface(), button = new Surface()
  const states = ['active','excluded','unavailable','browser','storage'].map(state => {
    const node = new Surface(); node.dataset.statisticsState = state; return node
  })
  const values = new Map(), requests = []
  doc.visibilityState = hidden ? 'hidden' : 'visible'
  doc.querySelector = () => button
  doc.querySelectorAll = () => states
  win.navigator = { globalPrivacyControl: signal }
  win.location = { origin: 'https://writersstudio.app' }
  win.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  win.setTimeout = setTimeout
  win.clearTimeout = clearTimeout
  win.fetch = (_, options) => { requests.push(options); return Promise.resolve({ ok: true }) }
  const owner = initializeWebsiteStatistics({doc,win,config:{...websiteAnalyticsConfig,enabled}})
  const selected = () => states.filter(node => !node.hidden).map(node => node.dataset.statisticsState)
  return {doc,win,button,values,requests,owner,selected}
}

test('disabled deployment has an honest state and supports saving an opt-out in advance', () => {
  const p = page({enabled:false})
  assert.deepEqual(p.selected(), ['unavailable'])
  assert.equal(p.button.hidden, false)
  p.button.fire('click')
  assert.equal(p.values.get(statisticsPreferenceKey),'off')
  assert.equal(p.button.getAttribute('aria-pressed'),'true')
  assert.deepEqual(p.selected(), ['excluded'])
  p.button.fire('click')
  assert.deepEqual(p.selected(), ['unavailable'])
  assert.equal(p.requests.length,0)
  p.owner.dispose()
})

test('view waits for visibility; pageshow, locale changes and re-inclusion do not duplicate it', () => {
  const p = page({hidden:true})
  assert.equal(p.requests.length,0)
  p.doc.visibilityState='visible'
  p.doc.fire('visibilitychange')
  p.win.fire('pageshow',{persisted:true})
  p.doc.fire('visibilitychange')
  p.button.fire('click')
  p.button.fire('click')
  assert.equal(p.requests.length,1)
  assert.equal(JSON.parse(p.requests[0].body).event.name,'landing_page_viewed')
  p.owner.dispose()
})

test('browser privacy and cross-tab preference changes update status and suppress clicks', () => {
  const browser = page({signal:true})
  assert.deepEqual(browser.selected(), ['browser'])
  assert.equal(browser.button.disabled,true)
  assert.equal(browser.requests.length,0)
  browser.owner.dispose()
  const p=page()
  p.values.set(statisticsPreferenceKey,'off')
  p.win.fire('storage',{key:statisticsPreferenceKey})
  assert.equal(p.button.getAttribute('aria-pressed'),'true')
  assert.deepEqual(p.selected(), ['excluded'])
  p.owner.dispose()
  assert.equal([...p.doc.handlers.values()].every(set=>set.size===0),true)
  assert.equal([...p.win.handlers.values()].every(set=>set.size===0),true)
})

test('trusted primary/keyboard and middle clicks emit once without intercepting navigation', async () => {
  const p=page()
  const link={href:'https://writersstudio.app/#download',dataset:{statisticsLink:'download-section',statisticsPlacement:'hero'}}
  const target={closest:()=>link}
  const click={target,button:0,isTrusted:true,defaultPrevented:false,preventDefault:()=>assert.fail('Navigation intercepted')}
  await new Promise(resolve=>setImmediate(resolve))
  p.doc.fire('click',click)
  p.doc.fire('auxclick',{...click,button:1})
  p.doc.fire('auxclick',{...click,button:2})
  p.doc.fire('click',{...click,isTrusted:false})
  p.doc.fire('click',{...click,defaultPrevented:true})
  assert.equal(p.requests.length,3)
  assert.equal(JSON.parse(p.requests[1].body).event.action,'open-download-section')
  p.button.fire('click')
  p.doc.fire('click',click)
  assert.equal(p.requests.length,3)
  p.owner.dispose()
})

test('all download and external/legal owners are annotated; generated older releases use same route', async () => {
  const root=new URL('../',import.meta.url)
  const html=await readFile(new URL('index.html',root),'utf8')
  const app=await readFile(new URL('app.js',root),'utf8')
  for(const match of html.matchAll(/<a\b[^>]+>/gu)) {
    const tag=match[0]
    if(/href="(?:#download|https:\/\/github\.com\/TrinkieYinkie|mailto:support@writersstudio|terms\/|privacy\/)/u.test(tag)) {
      assert.match(tag,/data-statistics-link=/u,tag)
      assert.match(tag,/data-statistics-placement=/u,tag)
    }
  }
  assert.match(app,/link\.dataset\.statisticsPlacement = 'release-older'/u)
  assert.match(app,/import\('\.\/website-analytics-ui\.js'\)[\s\S]*?\.catch\(\(\) => \{\}\)/u)
  assert.match(html,/href="#website-statistics"/u)
  assert.doesNotMatch(html,/<(?:dialog|select|progress)\b/u)
})
