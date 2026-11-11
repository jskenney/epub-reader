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
    got.push({ method: r.method(), body: JSON.parse(r.postData() || 'null'), type: r.headers()['content-type'] });
    return route.fulfill({ status: reply.status, contentType: reply.type, body: reply.body });
  });
  return got;
}
const turn = (page, n = 1) => (async () => { for (let k = 0; k < n; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80); } })();

test('turning pages sends where the reader is, once they stop, with what identifies the book; opening sends nothing (E-22)', async () => {
  const page = await h.newPage();
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
  const page = await h.newPage();
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
  const page = await h.newPage();
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
    const page = await h.newPage();
    const got = await api(page, '**/api/progress', reply);
    await h.openReader(page, LONG, { 'spine:layout': 'one' });
    await page.click('#nextBtn');
    await h.waitFor(() => got.length === 1);
    await turn(page, 3); await page.waitForTimeout(2800);
    await page.click('#prevBtn'); await page.waitForTimeout(2800);
    assert.equal(got.length, 1, `not tried again after ${reply.status} ${reply.type} ${JSON.stringify(reply.body)}`);
    await page.reload(); await h.waitForBook(page);
    await page.click('#nextBtn');
    await h.waitFor(() => got.length === 2);
  }
});

test('books from this computer and the sample send nothing; an empty address sends nothing (E-22)', async () => {
  const page = await h.newPage();
  const got = await api(page, '**/api/**');
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
  const page = await h.newPage();
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
  const page = await h.newPage();
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
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:layout': 'one', 'spine:set:API_PROGRESS': '/api-log/progress' });
  await page.click('#nextBtn'); await page.waitForTimeout(200);
  assert.equal((await log()).length, 0);
  await page.goto(`${h.SITE}/reader/books/notes.md`);
  const got = await h.waitFor(async () => { const l = await log(); return l.length ? l : null; }, 5000);
  assert.equal(got?.length, 1);
  assert.equal(got[0].path, '/api-log/progress');
  assert.match(got[0].type, /application\/json/);
  assert.equal(got[0].body.identifier, 'urn:long');
  assert.ok(got[0].body.section_percentage > 0);
});

test('API_PROGRESS set in Settings, and in Generate config; an address on another site is refused (E-22)', async () => {
  const page = await h.newPage();
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
