// Reading progress sent to the site (REVIEW.md E-22): for a book opened from a web address, where the reader is
// goes to API_PROGRESS (default /api/progress) a moment after the pages stop turning, and the first time the end
// is reached, API_COMPLETE (default /api/complete) is told. An address that doesn't answer with JSON is taken to
// be no API until the page is reloaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
// The API answered by the test: each request's JSON body listed; reply: { status, type, body }.
async function api(page, path = '**/api/progress', reply = { status: 200, type: 'application/json', body: '{"ok":true}' }) {
  const got = [];
  await page.route(path, route => {
    const r = route.request();
    got.push({ url: r.url(), method: r.method(), body: JSON.parse(r.postData() || 'null'), type: r.headers()['content-type'] });
    return route.fulfill({ status: reply.status, contentType: reply.type, body: reply.body });
  });
  return got;
}
// A page whose site knows no places (API_START answers nulls, as for a book it doesn't know); a test's own route
// for /api/position, added later, is used instead.
async function apiPage() {
  const page = await h.newPage();
  await api(page, '**/api/position', { status: 200, type: 'application/json', body: '{"section":null,"section_percentage":null,"book_percentage":null}' });
  return page;
}
const turn = (page, n = 1) => (async () => { for (let k = 0; k < n; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80); } })();

test('turning pages sends where the reader is, once they stop, with what identifies the book; opening sends nothing (E-22)', async () => {
  const page = await apiPage();
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await page.waitForTimeout(2600);
  assert.equal(got.length, 0, 'opening a book is not a page turn');
  await page.click('#nextBtn'); await turn(page, 2);
  await h.waitFor(() => got.length >= 1);
  await page.waitForTimeout(2600);
  assert.equal(got.length, 1, 'quick page turns send one update');
  const b = got[0].body;
  assert.equal(got[0].method, 'POST');
  assert.match(got[0].type, /application\/json/);
  const size = fs.statSync(`${__dirname}/site/reader/books/long.epub`).size;
  assert.deepEqual({ ...b, fingerprint: typeof b.fingerprint, section_percentage: typeof b.section_percentage, book_percentage: typeof b.book_percentage }, {
    identifier: 'urn:long', fingerprint: 'string', path: '/reader/books/long.epub', url: `${h.SITE}/reader/books/long.epub`,
    kind: 'epub', file_name: 'long.epub', size, title: 'The Long Book', section: 0, section_percentage: 'number', book_percentage: 'number' });
  assert.ok(b.section_percentage > 0 && b.section_percentage <= 100);
  assert.ok(b.book_percentage > 0 && b.book_percentage < b.section_percentage, 'the book is more than its first chapter');
  assert.equal('time' in b, false);
});

test('scrolling sends once the page has moved a screen or more from the last place sent (E-22)', async () => {
  const page = await apiPage();
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'scroll' });
  const scrollBy = y => h.inFrame(page, (doc, y) => { doc.scrollingElement.scrollTop += y; }, y);
  await scrollBy(40); await page.waitForTimeout(2800);
  assert.equal(got.length, 0, 'a little scrolling sends nothing');
  const screen = await h.inFrame(page, doc => doc.scrollingElement.clientHeight);
  await scrollBy(screen + 20);
  await h.waitFor(() => got.length === 1);
  assert.equal(got[0].body.section, 0);
  assert.ok(got[0].body.section_percentage > 0);
});

test('book_percentage counts each chapter by its size: the start of the last, short chapter is past two thirds; the bar shows the same (E-22)', async () => {
  const page = await apiPage();
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await page.focus('#ribbon'); await page.keyboard.press('End');
  await h.waitFor(() => got.length >= 1);
  const b = got.at(-1).body;
  assert.equal(b.section, 2);
  assert.ok(b.book_percentage > 75, `the last chapter is short: ${b.book_percentage}`);
  assert.equal(await page.textContent('#pct'), `${Math.round(b.book_percentage)}%`);
});

test('an address that doesn\'t answer with JSON is taken to be no API until the page is reloaded (E-22)', async () => {
  for (const reply of [{ status: 200, type: 'text/html', body: '<!DOCTYPE html><title>Not found</title>' }, { status: 404, type: 'application/json', body: '{}' }, { status: 200, type: 'application/json', body: '' }]) {
    const page = await apiPage();
    const got = await api(page, '**/api/progress', reply);
    await h.openReader(page, LONG, { 'spine:layout': 'one' });
    await page.click('#nextBtn');
    await h.waitFor(() => got.length === 1);
    await turn(page, 3); await page.waitForTimeout(2800);
    await page.click('#prevBtn'); await page.waitForTimeout(2800);
    assert.equal(got.length, 1, `not tried again after ${reply.status} ${reply.type} ${JSON.stringify(reply.body)}`);
    await page.reload(); await h.waitForBook(page);
    await page.click('#nextBtn');
    assert.ok(await h.waitFor(() => got.length === 2, 8000), 'tried again after a reload');
  }
});

test('books from this computer and the sample send nothing; an empty address sends nothing (E-22)', async () => {
  const page = await apiPage();
  const all = await api(page, '**/api/**'), got = { get length(){ return all.filter(r => !r.url.endsWith('/api/position')).length; } };
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await page.setInputFiles('#fileInput', `${__dirname}/site/reader/books/long.epub`);
  await page.waitForFunction(() => document.querySelector('#status').hidden);
  await page.click('#nextBtn'); await turn(page, 2); await page.waitForTimeout(2800);
  assert.equal(got.length, 0);
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:set:API_PROGRESS': '' });
  await page.click('#nextBtn'); await page.waitForTimeout(2800);
  assert.equal(got.length, 0);
});

test('reaching the end tells API_COMPLETE once; it isn\'t told again when the book is opened another time (E-22)', async () => {
  const page = await apiPage();
  const done = await api(page, '**/api/complete');
  await h.openReader(page, LONG, { 'spine:layout': 'scroll' });
  await page.focus('#ribbon'); await page.keyboard.press('End');
  await page.waitForTimeout(500);
  assert.equal(done.length, 0, 'the start of the last chapter isn\'t the end');
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await h.waitFor(() => done.length === 1);
  const b = done[0].body;
  assert.equal(b.completed, true);
  assert.equal(b.identifier, 'urn:long');
  assert.equal(b.path, '/reader/books/long.epub');
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = 0; });
  await page.waitForTimeout(400);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await page.waitForTimeout(800);
  assert.equal(done.length, 1, 'once');
  await page.reload(); await h.waitForBook(page);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = 0; });
  await page.waitForTimeout(400);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await page.waitForTimeout(800);
  assert.equal(done.length, 1, 'not again in another visit');
});

test('a comic sends its kind and size; a document opened by ?get= from this site, all on one page, is finished as it opens (E-22)', async () => {
  const page = await apiPage();
  const got = await api(page), done = await api(page, '**/api/complete');
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': 'one' });
  await page.click('#nextBtn');
  await h.waitFor(() => got.length === 1);
  assert.equal(got[0].body.kind, 'cbz');
  assert.equal(got[0].body.size, fs.statSync(`${__dirname}/site/reader/books/comic.cbz`).size);
  assert.equal(got[0].body.identifier, null);
  assert.equal(typeof got[0].body.fingerprint, 'string');
  assert.equal(done.length, 0);
  await h.openReader(page, `${h.READER}?get=books/notes.md`);
  await h.waitFor(() => done.length === 1);
  const b = done[0].body;
  assert.deepEqual([b.kind, b.file_name, b.path, b.size, b.title, b.completed], ['markdown', 'notes.md', '/reader/books/notes.md', 75, 'Notes', true]);
});

test('a place not yet sent goes as the page is left (E-22)', async () => {
  // (Sent with keepalive as the page goes, which the browser finishes on its own: the test server records it.)
  const log = async () => (await fetch(`${h.SITE}/__api`)).json();
  await fetch(`${h.SITE}/__api`, { method: 'DELETE' });
  const page = await apiPage();
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:set:API_PROGRESS': '/api-log/progress', 'spine:set:API_START': '/api-log/position' });
  await page.click('#nextBtn'); await page.waitForTimeout(200);
  const progress = async () => (await log()).filter(r => r.path === '/api-log/progress');
  assert.equal((await progress()).length, 0);
  await page.goto(`${h.SITE}/reader/books/notes.md`);
  const got = await h.waitFor(async () => { const l = await progress(); return l.length ? l : null; }, 5000);
  assert.equal(got?.length, 1);
  assert.equal(got[0].path, '/api-log/progress');
  assert.match(got[0].type, /application\/json/);
  assert.equal(got[0].body.identifier, 'urn:long');
  assert.ok(got[0].body.section_percentage > 0);
});

test('API_PROGRESS set in Settings, and in Generate config; an address on another site is refused (E-22)', async () => {
  const page = await apiPage();
  const got = await api(page, '**/elsewhere/progress');
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:set:API_PROGRESS': '/elsewhere/progress' });
  await page.click('#nextBtn');
  await h.waitFor(() => got.length === 1);
  await page.click('#setBtn');
  assert.equal(await page.inputValue('#set-API_PROGRESS'), '/elsewhere/progress');
  assert.match(await page.textContent('#set-API_PROGRESS >> xpath=ancestor::div[1]'), /this site's default is \/api\/progress/);
  await page.fill('#set-API_PROGRESS', 'https://example.com/progress'); await page.press('#set-API_PROGRESS', 'Tab');
  assert.equal(await page.inputValue('#set-API_PROGRESS'), '/elsewhere/progress');
  assert.match(await page.textContent('#set-API_PROGRESS >> xpath=ancestor::div[1]'), /Not changed: https:\/\/example\.com\/progress isn't on this site/);
  await page.fill('#set-API_PROGRESS', ''); await page.press('#set-API_PROGRESS', 'Tab');
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:set:API_PROGRESS')), '""');
  await page.click('#setGenerate');
  const cfg = JSON.parse(await page.inputValue('#cfgText'));
  assert.equal(cfg.API_PROGRESS, '');
  assert.equal(cfg.API_COMPLETE, '/api/complete');
});

// API_START (E-22): asked as the book opens; its place is gone to.
const where = page => page.evaluate(() => [document.querySelector('#chapLabel').textContent, document.querySelector('#spinePos').textContent]);
test('API_START is asked with what identifies the book as it opens, and the book goes to the place it answers; that isn\'t sent back (E-22)', async () => {
  const page = await apiPage();
  const asked = await api(page, '**/api/position', { status: 200, type: 'application/json', body: '{"section":1,"section_percentage":50,"book_percentage":40}' });
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await page.waitForFunction(() => document.querySelector('#chapLabel').textContent === 'Chapter Two');
  assert.equal(asked.length, 1);
  const b = asked[0].body;
  assert.equal(asked[0].method, 'POST');
  assert.deepEqual(Object.keys(b).sort(), ['file_name', 'fingerprint', 'identifier', 'kind', 'path', 'size', 'title', 'url']);
  assert.equal(b.identifier, 'urn:long');
  const [, pos] = await where(page);
  const [, n, of] = /page (\d+)\/(\d+)/.exec(pos).map(Number);
  assert.ok(n > 1 && Math.abs((n - 1) / (of - 1) - 0.5) < 0.2, `halfway through Chapter Two: ${pos}`);
  await page.waitForTimeout(2600);
  assert.equal(got.length, 0, 'the place from the site isn\'t sent back to it');
  await page.click('#nextBtn');
  await h.waitFor(() => got.length === 1);
  assert.equal(got[0].body.section, 1);
});

test('API_START: nulls (a book the site doesn\'t know) leave the book where this browser had it; book_percentage alone is gone to (E-22)', async () => {
  const page = await apiPage();
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:pos:urn:long': { i: 1, f: 0, t: Date.now() } });
  await page.waitForTimeout(600);
  assert.equal((await where(page))[0], 'Chapter Two');
  await api(page, '**/api/position', { status: 200, type: 'application/json', body: '{"section":null,"section_percentage":null,"book_percentage":90}' });
  await page.reload(); await h.waitForBook(page);
  await page.waitForFunction(() => document.querySelector('#chapLabel').textContent === 'Chapter Three');
});

test('API_START answering with anything but JSON: progress isn\'t sent either, until the page is reloaded (E-22)', async () => {
  const page = await apiPage();
  const asked = await api(page, '**/api/position', { status: 200, type: 'text/html', body: '<!DOCTYPE html><title>Sign in</title>' });
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await h.waitFor(() => asked.length === 1);
  await page.click('#nextBtn'); await turn(page, 2); await page.waitForTimeout(2800);
  assert.equal(got.length, 0);
  assert.equal((await where(page))[0], 'Chapter One');
});

test('API_START: a place that comes after the reader has already turned a page is left alone (E-22)', async () => {
  const page = await apiPage();
  await page.route('**/api/position', async route => { await new Promise(r => setTimeout(r, 2500)); await route.fulfill({ status: 200, contentType: 'application/json', body: '{"section":2,"section_percentage":0,"book_percentage":80}' }); });
  await page.goto(`${h.SITE}/reader/index.html?book=none-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('spine:layout', '"one"'); });
  await page.goto(LONG);
  await page.waitForFunction(() => document.querySelector('#chapLabel')?.textContent === 'Chapter One');
  await page.click('#nextBtn');
  await page.waitForTimeout(3500);
  assert.equal((await where(page))[0], 'Chapter One');
});

// Round 25 review.
test('an EPUB from another site (?get=) keeps its own place and finished mark, apart from this site\'s copy with the same identifier (round 25 review, H-29)', async () => {
  const page = await apiPage();
  const done = await api(page, '**/api/complete');
  const reader = `${h.PLAIN}/reader/index.html`;
  await h.openReader(page, `${reader}?book=books/long.epub`, { 'spine:layout': 'scroll', 'spine:pos:urn:long': { i: 1, f: 0.5, t: Date.now() } });
  assert.equal((await where(page))[0], 'Chapter Two');
  await page.goto(`${reader}?get=${h.SOFT}/reader/books/long.epub`); await h.waitForBook(page);
  await page.focus('#ribbon'); await page.keyboard.press('End'); await page.waitForTimeout(300);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await h.waitFor(() => done.length === 1);
  assert.equal(done[0].body.path, null);
  const stored = await page.evaluate(() => [JSON.parse(localStorage.getItem('spine:pos:urn:long')), JSON.parse(localStorage.getItem(`spine:pos:get:${location.search.slice(5)}`))]);
  assert.deepEqual([stored[0].i, stored[0].f, stored[0].done], [1, 0.5, undefined], 'this site\'s copy keeps its place, not finished');
  assert.equal(stored[1].done, 1);
  await page.goto(`${reader}?book=books/long.epub`); await h.waitForBook(page);
  assert.equal((await where(page))[0], 'Chapter Two');
});

test('?edit= sends nothing for a new document, and doesn\'t report a short one finished as it opens for editing (round 25 review, M-115)', async () => {
  const page = await apiPage();
  const all = await api(page, '**/api/**');
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?edit=books/brand-new-r25.md`);
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  assert.deepEqual(all.map(r => r.url.split('/').pop()), []);
  await h.openReader(page, `${h.READER}?edit=books/notes.md`);
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  assert.deepEqual(all.map(r => r.url.split('/').pop()), ['position']);
});

test('a comic goes to the site\'s book_percentage, as its sections depend on COMIC_PART (round 25 review, M-116)', async () => {
  const page = await apiPage();
  await api(page, '**/api/position', { status: 200, type: 'application/json', body: '{"section":0,"section_percentage":0,"book_percentage":95}' });
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': 'one', 'spine:set:COMIC_PART': 10 });
  const n = await h.waitFor(async () => { const m = /spine (\d+)\/(\d+)/.exec((await where(page))[1]); return m && Number(m[1]) > 1 ? m : null; }, 5000);
  assert.ok(n && Number(n[1]) >= Number(n[2]) - 1, `near the end: ${n && n[0]}`);
});

test('leaving while an earlier place waits for its answer still sends the newest place (round 25 review, L-280)', async () => {
  const log = async () => (await (await fetch(`${h.SITE}/__api`)).json()).filter(r => r.path === '/api-log/progress');
  await fetch(`${h.SITE}/__api`, { method: 'DELETE' });
  const page = await apiPage();
  await page.route('**/api-log/progress', async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); });
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:set:API_PROGRESS': '/api-log/progress', 'spine:set:API_START': '/api-log/position' });
  await page.click('#nextBtn'); await page.waitForTimeout(2300);   // (the first place is on its way, held 4 s)
  await page.click('#nextBtn'); await page.click('#nextBtn'); await page.waitForTimeout(2300);   // (the newest waits for it)
  const newest = await page.evaluate(() => document.querySelector('#spinePos').textContent);
  await page.goto(`${h.SITE}/reader/books/notes.md`);
  // (The first, held one may be dropped with the page; the newest must arrive.)
  const [, at, of] = /page (\d+)\/(\d+)/.exec(newest).map(Number), want = (at - 1) / (of - 1) * 100;
  const got = await h.waitFor(async () => { const l = await log(); return l.some(r => Math.abs(r.body.section_percentage - want) < 0.2) ? l : null; }, 8000);
  assert.ok(got, `the newest place (${newest}) among ${JSON.stringify((await log()).map(r => r.body.section_percentage))}`);
});

// Round 25 review, loop 2.
test('?edit= of an EPUB at its last page isn\'t reported finished, and opens the editor where this browser left it whatever the site answers (round 25 review, L-295, L-296)', async () => {
  const page = await apiPage();
  const done = await api(page, '**/api/complete');
  await h.openReader(page, `${h.READER}?edit=books/long.epub`, { 'spine:pos:urn:long': { i: 2, f: 1, t: Date.now() } });
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  assert.equal(done.length, 0);
  await api(page, '**/api/position', { status: 200, type: 'application/json', body: '{"section":2,"section_percentage":0,"book_percentage":90}' });
  await h.openReader(page, `${h.READER}?edit=books/long.epub`, { 'spine:pos:urn:long': { i: 1, f: 0, t: Date.now() } });
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  assert.match(await page.textContent('#editName'), /c2\.xhtml/);
});

test('reaching the end in two pages, where the last section fits on one spread, sends 100% for the book, as the bar shows, and the section\'s start as its place (round 25 review, L-298 and loop 3)', async () => {
  const page = await apiPage();
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'two' });
  await page.focus('#ribbon'); await page.keyboard.press('End');
  await h.waitFor(() => got.length >= 1);
  assert.equal(got.at(-1).body.book_percentage, 100);
  assert.equal(got.at(-1).body.section_percentage, 0, 'where another device should open it: the start, not the end');
  assert.equal(await page.textContent('#pct'), '100%');
});

test('a book whose last chapter was edited keeps its finished mark through the looser record (round 25 review, L-282)', async () => {
  const page = await apiPage();
  const done = await api(page, '**/api/complete');
  await h.openReader(page, `${h.READER}?book=books/twin-a.epub`, { 'spine:layout': 'scroll' });
  await page.focus('#ribbon'); await page.keyboard.press('End'); await page.waitForTimeout(300);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await h.waitFor(() => done.length === 1);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = 0; }); await page.waitForTimeout(500);   // (saved again, with the mark)
  await page.goto(`${h.READER}?book=books/twin-a-last.epub`); await h.waitForBook(page);
  await page.focus('#ribbon'); await page.keyboard.press('End'); await page.waitForTimeout(300);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = doc.scrollingElement.scrollHeight; });
  await page.waitForTimeout(1000);
  assert.equal(done.length, 1);
});

test('opening another book sends the last book\'s place not yet sent (round 25 review, T-46)', async () => {
  const page = await apiPage();
  const got = await api(page);
  await h.openReader(page, LONG, { 'spine:layout': 'one' });
  await page.click('#nextBtn'); await page.waitForTimeout(300);
  assert.equal(got.length, 0);
  await page.setInputFiles('#fileInput', `${__dirname}/site/reader/books/notes.md`);
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Notes');
  assert.ok(await h.waitFor(() => got.length === 1, 3000), 'sent as the other book opened');
  assert.equal(got[0].body.title, 'The Long Book');
});
