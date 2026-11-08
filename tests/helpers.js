// Shared helpers for the reader's browser tests (node --test with Playwright). See tests/run.sh.
const { chromium } = require('playwright');

const SITE = 'http://localhost:8790';     // the test site, with the mock Breeze API at /tts/
const SOFT = 'http://localhost:8791';     // the same site, answering missing files with a 200 "not found" page
const REMOTE = 'http://localhost:8792';   // "another site": records every request a book makes to it
const READER = `${SITE}/reader/index.html`;

let browser;
async function launch() {
  browser ??= await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  return browser;
}
async function close() { await browser?.close(); browser = null; }

/* A page that can only reach the test servers: every other request (CDNs, Google Fonts, Hugging Face) is
   blocked and listed in page.blocked, so tests also prove nothing leaves the site. */
async function newPage({ allow = [], viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await (await launch()).newContext({ viewport });
  const page = await ctx.newPage();
  page.blocked = [];
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || allow.some(h => u.hostname.endsWith(h))) return route.continue();
    page.blocked.push(u.href);
    return route.abort();
  });
  return page;
}

// Open the reader at url with fresh storage (plus any settings given), and wait for the book to show.
async function openReader(page, url = READER, settings = {}) {
  const origin = new URL(url).origin;
  await page.goto(`${origin}/reader/index.html?book=none-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
    return new Promise(res => { const rq = indexedDB.deleteDatabase('spine-voice-audio'); rq.onsuccess = rq.onerror = rq.onblocked = res; });
  }, settings);
  await page.goto(url);
  await waitForBook(page);
}
async function waitForBook(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector('#bookTitle')?.textContent;
    return t && t !== 'Loading…' && document.querySelector('#status')?.hidden;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(300);
}

const title = page => page.textContent('#bookTitle');
const notice = async page => (await page.isVisible('#notice')) ? (await page.textContent('#noticeText')).trim() : '';
const inFrame = (page, fn, arg) => page.evaluate(([src, a]) => {
  const doc = document.querySelector('#page').contentDocument;
  return new Function('doc', 'arg', `return (${src})(doc, arg)`)(doc, a);
}, [fn.toString(), arg]);

async function remoteLog() { return (await fetch(`${REMOTE}/__log`)).json(); }
async function clearRemoteLog() { await fetch(`${REMOTE}/__log`, { method: 'DELETE' }); }
async function breezeLog() { return (await fetch(`${SITE}/__breeze`)).json(); }
async function clearBreezeLog() { await fetch(`${SITE}/__breeze`, { method: 'DELETE' }); }

// The word read-aloud is highlighting, or ''.
const spokenWord = page => page.evaluate(() => {
  const h = document.querySelector('#page').contentWindow.CSS.highlights?.get('tts-word');
  return h ? [...h][0].toString() : '';
});
async function waitFor(fn, ms = 20000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, step)); }
  return null;
}

module.exports = { SITE, SOFT, REMOTE, READER, launch, close, newPage, openReader, waitForBook, title, notice, inFrame,
  remoteLog, clearRemoteLog, breezeLog, clearBreezeLog, spokenWord, waitFor };
