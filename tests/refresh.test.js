// Refresh (E-49): a book from the site read again from where it came from, past the browser's cache, at the same
// place, without reloading the page; not for a file from this computer, nor while editing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const BOOKS = path.join(__dirname, 'site', 'reader', 'books');
const pageNo = async page => Number(/page (\d+)/.exec(await page.textContent('#spinePos'))[1]);
const chapterText = page => h.inFrame(page, doc => doc.body.textContent);
// (The server lets the browser keep files for an hour, as a site may: only reading past its cache gets the new one.)
const old = (file, year) => { const t = new Date(`${year}-01-01`) / 1000; fs.utimesSync(file, t, t); };
const cached = async on => fetch(`${h.SITE}/__cache?on=${on ? 1 : 0}`);
// (A page whose requests aren't intercepted: Playwright turns the browser's cache off for those that are.)
async function cachingPage(opts = {}) {
  const ctx = await (await h.launch()).newContext(opts);
  test.after(() => ctx.close().catch(() => {}));
  return ctx.newPage();
}

test('Refresh is shown for a book from the site, between Edit and Open, and not for one from this computer (E-49)', async () => {
  const page = await h.newPage({ viewport: { width: 1400, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.equal(await page.isVisible('#refreshBtn'), true);
  assert.deepEqual(await page.evaluate(() => { const r = document.querySelector('#refreshBtn'); return [r.previousElementSibling.id, r.nextElementSibling.id]; }), ['editPick', 'openBtn']);
  await page.setInputFiles('#fileInput', path.join(BOOKS, 'abc.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'ABC');
  assert.equal(await page.isHidden('#refreshBtn'), true, 'a file from this computer');
  await page.click('#setBtn'); await page.click('#setText');
  assert.equal(await page.isHidden('#txtRefreshRow'), true);
});

test('Refresh reads a changed document again, at the same page, without reloading the page; a book that can\'t be read now stays (E-49)', async () => {
  const file = path.join(BOOKS, 'refresh-me.md');
  const paras = word => '# Refresh me\n\n' + Array.from({ length: 60 }, (_, i) => `Paragraph ${i} ${word} ` + 'filler words go here '.repeat(20)).join('\n\n') + '\n';
  fs.writeFileSync(file, paras('before')); old(file, 2020);
  await cached(true);
  try {
    const page = await cachingPage({ viewport: { width: 1200, height: 800 } });
    await h.openReader(page, `${h.READER}?book=books/refresh-me.md`, { 'spine:layout': 'one' });
    for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
    const at = await pageNo(page);
    assert.ok(at >= 3);
    await page.evaluate(() => { window.notReloaded = true; });
    fs.writeFileSync(file, paras('after')); old(file, 2021);
    await page.click('#refreshBtn');
    assert.ok(await h.waitFor(async () => /Paragraph \d+ after/.test(await chapterText(page)), 10000), 'the new text');
    await h.waitForBook(page);
    assert.equal(await pageNo(page), at, 'the same page');
    assert.equal(await page.evaluate(() => window.notReloaded), true, 'the page itself not reloaded');
    // Gone from the site: says why, and the book shown stays.
    fs.rmSync(file);
    await page.click('#refreshBtn');
    assert.match(await h.noticeLike(page, /Nothing was found/), /Nothing was found/);
    assert.equal(await page.textContent('#bookTitle'), 'Refresh me');
    assert.match(await chapterText(page), /Paragraph \d+ after/);
  } finally { await cached(false); fs.rmSync(file, { force: true }); }
});

test('Refresh reads an EPUB again past the browser\'s cache; it is in Text settings too; hidden while editing and by SHOW_REFRESH_BUTTON (E-49)', async () => {
  const file = path.join(BOOKS, 'refresh-me.epub');
  fs.copyFileSync(path.join(BOOKS, 'abc.epub'), file); old(file, 2020);
  await cached(true);
  try {
    const page = await cachingPage();
    await h.openReader(page, `${h.READER}?book=books/refresh-me.epub`);
    assert.equal(await page.textContent('#bookTitle'), 'ABC');
    fs.copyFileSync(path.join(BOOKS, 'two-langs.epub'), file); old(file, 2021);
    await page.click('#setBtn'); await page.click('#setText');
    assert.equal(await page.isVisible('#txtRefreshRow'), true);
    await page.click('#txtRefresh');
    await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Two langs', null, { timeout: 10000 });
    // While editing: hidden.
    await h.openReader(page, `${h.READER}?book=books/notes.md`);
    assert.equal(await page.isVisible('#refreshBtn'), true);
    await page.click('#editBtn'); await page.click('#editThis');
    await page.waitForSelector('#editBar:not([hidden])');
    assert.equal(await page.isVisible('#refreshBtn'), false, 'hidden while editing');
  } finally { await cached(false); fs.rmSync(file, { force: true }); }
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-notools/index.html?book=/reader/books/long.epub`);
  assert.equal(await page.isHidden('#refreshBtn'), true, 'SHOW_REFRESH_BUTTON: false');
});

test('Refresh of a ?get= book that was redirected keeps its place and its one record of it (round 39 review, M-210)', async () => {
  const page = await h.newPage();
  const url = `${h.PLAIN}/reader/index.html?get=/redirect/${new URL(h.SITE).port}/reader/books/long.epub`;
  await h.openReader(page, url, { 'spine:layout': 'one' });
  await page.click('#nextBtn'); await page.waitForTimeout(300);
  const before = await page.textContent('#spinePos');
  await page.click('#refreshBtn');
  await h.waitForBook(page);
  assert.equal(await page.textContent('#spinePos'), before);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('spine:pos:get:')));
  assert.equal(keys.length, 1, keys.join(' '));
});

test('Refresh of a folder book reads it again and keeps its name as written; an EPUB served whole comes past the cache (round 39 review, L-445, T-64)', async () => {
  const opf = path.join(BOOKS, 'folder book', 'OEBPS', 'content.opf'), was = fs.readFileSync(opf, 'utf8');
  try {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=${encodeURIComponent('books/folder book/')}`);
    assert.equal(await page.textContent('#bookTitle'), 'ABC');
    fs.writeFileSync(opf, was.replace('<dc:title>ABC</dc:title>', '<dc:title>ABC again</dc:title>'));
    await page.click('#refreshBtn');
    await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'ABC again', null, { timeout: 10000 });
    await page.click('#editBtn'); await page.click('#editThis');
    await page.waitForFunction(() => /folder book\.epub/.test(document.querySelector('#editName').textContent), null, { timeout: 10000 });
  } finally { fs.writeFileSync(opf, was); }
  const file = path.join(BOOKS, 'refresh-whole.epub');
  fs.copyFileSync(path.join(BOOKS, 'abc.epub'), file); old(file, 2020);
  await cached(true);
  try {
    const page = await cachingPage();
    await h.openReader(page, `${h.NORANGE}/reader/index.html?book=books/refresh-whole.epub`);
    fs.copyFileSync(path.join(BOOKS, 'two-langs.epub'), file); old(file, 2021);
    await page.click('#refreshBtn');
    await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Two langs', null, { timeout: 10000 });
  } finally { await cached(false); fs.rmSync(file, { force: true }); }
});

test('Refresh reaches a document\'s stylesheet past the cache; unsaved changes are kept if the book can\'t be read again (round 39 review, L-443, L-444)', async () => {
  const html = path.join(BOOKS, 'refresh-style.html'), css = path.join(BOOKS, 'refresh-style.css');
  fs.writeFileSync(html, '<!DOCTYPE html><html><head><title>Styled</title><link rel="stylesheet" href="refresh-style.css"></head><body><p id="p">Styled text.</p></body></html>');
  fs.writeFileSync(css, '#p{color:rgb(200, 0, 0)}'); old(html, 2020); old(css, 2020);
  await cached(true);
  try {
    const page = await cachingPage();
    await h.openReader(page, `${h.READER}?book=books/refresh-style.html`);
    assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.getElementById('p')).color), 'rgb(200, 0, 0)');
    fs.writeFileSync(css, '#p{color:rgb(0, 0, 200)}'); old(css, 2021);
    await page.click('#refreshBtn');
    assert.ok(await h.waitFor(() => h.inFrame(page, doc => getComputedStyle(doc.getElementById('p')).color === 'rgb(0, 0, 200)'), 10000), 'the new stylesheet');
  } finally { await cached(false); }
  // Changes kept by Done, unsaved; the file gone from the site: Refresh asks, can't read it, and the changes stay.
  try {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/refresh-style.html`, { 'spine:editMode': 'raw' });
    await page.click('#editBtn'); await page.click('#editThis');
    await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
    await page.evaluate(() => { const c = document.querySelector('.CodeMirror'); if (c) c.CodeMirror.replaceRange(' More.', c.CodeMirror.posFromIndex(c.CodeMirror.getValue().indexOf('</p>'))); else { const t = document.querySelector('.edit-plain'); t.value = t.value.replace('</p>', ' More.</p>'); t.dispatchEvent(new Event('input')); } });
    await page.waitForTimeout(500);
    await page.click('#editDone');
    await page.waitForSelector('#editBar', { state: 'hidden' });
    fs.rmSync(html);
    const asked = [];
    page.on('dialog', d => { asked.push(d.message()); d.accept(); });
    await page.click('#refreshBtn');
    assert.match(await h.noticeLike(page, /Nothing was found/), /Nothing was found/);
    assert.match(asked[0] || '', /unsaved changes\. Refresh the book and lose them\?/);
    await page.click('#refreshBtn');
    await page.waitForTimeout(500);
    assert.equal(asked.length, 2, 'still asked: the changes are kept');
  } finally { fs.rmSync(html, { force: true }); fs.rmSync(css, { force: true }); }
});
