// The contents, the bottom bar and the top bar (SHOW_CONTENTS, SHOW_PROGRESS, SHOW_TOPBAR): shown by default, turned
// off in Settings, by C, P and N (kept), or by a folder's reader-config.json, which can lock them.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const shown = page => page.evaluate(() => ({
  bar: getComputedStyle(document.querySelector('.bar')).display !== 'none',
  foot: getComputedStyle(document.querySelector('.foot')).display !== 'none',
  toc: !document.querySelector('#toc').classList.contains('collapsed') && getComputedStyle(document.querySelector('#toc')).display !== 'none',
  corner: !document.querySelector('#barCorner').hidden,
}));
const saved = (page, name) => page.evaluate(n => localStorage.getItem(`spine:set:${n}`), name);

test('all three are shown by default; P and N hide and show the bars, C the contents, each kept for next time (layout settings)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, LONG);
  assert.deepEqual(await shown(page), { bar: true, foot: true, toc: true, corner: false });
  const stage = () => page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().height);
  const h0 = await stage();
  await page.keyboard.press('p');
  assert.equal((await shown(page)).foot, false);
  await page.keyboard.press('n');
  assert.deepEqual(await shown(page), { bar: false, foot: false, toc: true, corner: true });
  assert.ok(await h.waitFor(async () => await stage() > h0 + 60, 3000), 'the page takes the room');
  await page.keyboard.press('c');
  assert.equal((await shown(page)).toc, false);
  assert.deepEqual([await saved(page, 'SHOW_PROGRESS'), await saved(page, 'SHOW_TOPBAR'), await saved(page, 'SHOW_CONTENTS')], ['false', 'false', 'false']);
  // Kept across a reload.
  await page.reload(); await h.waitForBook(page);
  assert.deepEqual(await shown(page), { bar: false, foot: false, toc: false, corner: true });
  // A tap at the top right corner brings the top bar back; P and C the others.
  await page.mouse.click(1270, 10);
  assert.equal((await shown(page)).bar, true);
  assert.equal(await saved(page, 'SHOW_TOPBAR'), 'true');
  await page.keyboard.press('p'); await page.keyboard.press('c');
  assert.deepEqual(await shown(page), { bar: true, foot: true, toc: true, corner: false });
});

test('the three are in Settings, with the others; Restore defaults shows them again (layout settings)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, LONG);
  await page.click('#setBtn'); await page.waitForFunction(() => document.querySelector('#setDialog').open);
  for (const n of ['SHOW_CONTENTS', 'SHOW_PROGRESS', 'SHOW_TOPBAR']) {
    assert.equal(await page.isChecked(`[data-set="${n}"]`), true, n);
    await page.uncheck(`[data-set="${n}"]`);
  }
  assert.deepEqual(await shown(page), { bar: false, foot: false, toc: false, corner: true });
  await page.click('#setReset');
  assert.deepEqual(await shown(page), { bar: true, foot: true, toc: true, corner: false });
});

test('a folder\'s reader-config.json turns them off, or locks one; a narrow screen starts with the contents closed (layout settings)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.SITE}/folder-bare/index.html?book=/reader/books/long.epub`);
  assert.deepEqual(await shown(page), { bar: false, foot: false, toc: false, corner: true });
  await page.keyboard.press('n');
  assert.equal((await shown(page)).bar, true, 'a reader can still show it');
  await h.openReader(page, `${h.SITE}/folder-barelock/index.html?book=/reader/books/long.epub`);
  assert.deepEqual(await shown(page), { bar: false, foot: true, toc: true, corner: false });
  await page.keyboard.press('n');
  assert.equal((await shown(page)).bar, false);
  assert.match(await page.textContent('#noticeText'), /This site sets whether the top bar is shown/);
  await page.setViewportSize({ width: 420, height: 800 });
  await h.openReader(page, LONG);
  assert.equal(await page.evaluate(() => document.querySelector('#toc').classList.contains('open')), false);
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => document.querySelector('#toc').classList.contains('open')), true);
  assert.equal(await saved(page, 'SHOW_CONTENTS'), null, 'on a narrow screen C only opens them');
});
