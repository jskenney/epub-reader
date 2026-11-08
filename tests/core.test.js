// Reading: layouts, search, documents, comics, the information panel.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

test('the sample book opens with its contents, and the information panel is hidden until I', async () => {
  const page = await h.newPage();
  await h.openReader(page);
  assert.equal(await h.title(page), 'Four Fables');
  assert.ok((await page.$$('#tocList a')).length >= 5);
  assert.equal(await page.isVisible('#infoSection'), false);
  await page.keyboard.press('i');
  assert.equal(await page.isVisible('#infoSection'), true);
  await page.keyboard.press('i');
  assert.equal(await page.isVisible('#infoSection'), false);
  assert.deepEqual(page.errors, []);
});

test('layouts: two columns, one column, scrolling (L), remembered', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  const cols = () => page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument, flow = d.querySelector('[id^="spine-flow-"]');
    return d.defaultView.getComputedStyle(flow).columnCount;
  });
  assert.equal(await cols(), '2');
  await page.keyboard.press('l'); await page.waitForTimeout(300);
  assert.equal(await cols(), '1');
  await page.keyboard.press('l'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('spine:layout'))), 'scroll');
  await page.keyboard.press('l');
});

test('search: across chapters, ignoring case, accents and curly quotes; Enter steps through matches', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  const status = () => page.textContent('#searchStatus');
  await page.keyboard.press('/');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'searchBox');
  await page.keyboard.type('cafe'); await page.waitForTimeout(800);
  assert.match(await status(), /1 of 1 match/);
  await page.fill('#searchBox', "don't think"); await page.waitForTimeout(800);
  assert.match(await status(), /1 of 1 match/);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page').contentWindow.CSS.highlights?.has('search-current'));
  const current = await page.evaluate(() => [...document.querySelector('#page').contentWindow.CSS.highlights.get('search-current')][0].toString());
  assert.equal(current, 'don’t think');
  assert.match(await page.textContent('#spinePos'), /spine 2\/3/);
  await page.fill('#searchBox', 'paragraph 1.'); await page.waitForTimeout(800);
  assert.match(await status(), /of 3 matches/);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#tocNav'), true);
});

test("a book element with the reader's own ids doesn't break page counting, and links to it still work (L-11)", async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/reader-ids.epub`);
  const pages = Number((await page.textContent('#spinePos')).match(/page \d+\/(\d+)/)[1]);
  assert.ok(pages > 2, `pages counted: ${pages}`);
  assert.match(await h.inFrame(page, doc => doc.getElementById('spine-end')?.textContent || ''), /Starts here/, "the book's own ids are left as they are");
  await h.inFrame(page, doc => doc.querySelector('#to-end').click());
  await page.waitForFunction(() => /page (\d+)\/\1\b/.test(document.querySelector('#spinePos').textContent), null, { timeout: 5000 });
});

test('single-key shortcuts can be turned off in the Aa menu; arrows still turn pages (L-17)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.keyboard.press('t');
  const toggled = await theme();
  assert.ok(toggled, 'T switches the theme');
  await page.click('#fontBtn');
  assert.equal(await page.getAttribute('#keysOpt', 'aria-checked'), 'true');
  await page.click('#keysOpt');
  assert.equal(await page.getAttribute('#keysOpt', 'aria-checked'), 'false');
  await page.keyboard.press('Escape');
  const state = () => page.evaluate(() => [document.querySelector('#tocBtn').getAttribute('aria-expanded'), document.querySelector('#layoutBtn').dataset.layout]);
  const before0 = await state();
  for (const k of ['t', 'c', 'l', '/']) await page.keyboard.press(k);
  assert.equal(await theme(), toggled, 'T does nothing now');
  assert.deepEqual(await state(), before0, 'C and L do nothing now');
  assert.equal(await page.isVisible('#searchPanel'), false, '/ does nothing now');
  const before = await page.textContent('#spinePos');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(b => document.querySelector('#spinePos').textContent !== b, before);
  // Remembered after a reload.
  await page.reload(); await h.waitForBook(page);
  await page.keyboard.press('t');
  assert.equal(await theme(), toggled);
});

test('"shortcuts": false in reader-config.json starts with single-key shortcuts off (L-17)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-keys/index.html?book=/reader/books/long.epub`);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const t0 = await theme();
  await page.keyboard.press('t');
  assert.equal(await theme(), t0);
  await page.click('#fontBtn');
  assert.equal(await page.getAttribute('#keysOpt', 'aria-checked'), 'false');
});

test('documents open as one continuous page with their headings in the contents', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/notes.md`);
  assert.deepEqual(await page.$$eval('#tocList a', as => as.map(a => a.textContent)), ['Notes', 'First', 'Later']);
  assert.match(await page.textContent('#spinePos'), /spine 1\/1/);
});

test('comics: spreads in two columns, ComicInfo metadata, and earlier sections release their images', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`);
  assert.equal(await h.title(page), 'Test Comic');
  const shown = () => page.evaluate(() => [...document.querySelector('#page').contentDocument.querySelectorAll('.cbz-page img')]
    .map(i => ({ src: i.src, alt: i.alt, ok: i.complete && i.naturalWidth > 0 })));
  const first = await shown();
  assert.equal(first.length, 40);
  assert.ok(first.slice(0, 2).every(i => i.ok));
  // Go to the second section: the first section's image copies are released.
  await page.click('#tocList a >> nth=1');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('.cbz-page img')?.alt === 'Page 41');
  await page.waitForTimeout(500);
  const released = await page.evaluate(async srcs => {
    const out = [];
    for (const s of srcs) { try { await fetch(s); out.push('alive'); } catch { out.push('released'); } }
    return out;
  }, first.slice(0, 3).map(i => i.src));
  assert.deepEqual(released, ['released', 'released', 'released']);
  assert.ok((await shown()).slice(0, 2).every(i => i.ok), 'the new section shows');
});

test('French books are not offered Pocket TTS, which has no French voices (E-12)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/french.epub`, { 'spine:ttsEngine': 'pocket' });
  await page.click('#ttsBtn');
  const pocket = await page.$eval('#ttsEngine option[value="pocket"]', o => ({ disabled: o.disabled, text: o.textContent }));
  assert.deepEqual(pocket, { disabled: true, text: 'Natural voice (Pocket TTS: en, de, it, pt, es)' });
  assert.equal(await page.inputValue('#ttsEngine'), 'device');
});
