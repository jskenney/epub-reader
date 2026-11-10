// Comics: right-to-left manga (REVIEW.md E-9).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const MANGA = `${h.READER}?book=books/manga.cbz`;
// The pages on screen become these, waiting for them rather than a set time.
const sees = async (page, want) => {
  const ok = await h.waitFor(async () => JSON.stringify(await onScreen(page)) === JSON.stringify(want), 10000);
  assert.deepEqual(await onScreen(page), want, ok ? '' : 'not shown in time');
};
// The pages on screen, left to right.
const onScreen = page => page.evaluate(() => {
  const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow;
  return [...d.querySelectorAll('.cbz-page')].map(p => [p.getBoundingClientRect(), p.querySelector('img').alt])
    .filter(([r]) => r.right > 1 && r.left < w.innerWidth - 1).sort((a, b) => a[0].left - b[0].left).map(([, alt]) => alt);
});

test('right-to-left manga: each spread shows its later page on the left, and the left arrow goes on (E-9)', async () => {
  const page = await h.newPage();
  await h.openReader(page, MANGA, { 'spine:layout': 'two' });
  await sees(page, ['Page 2', 'Page 1']);
  await page.keyboard.press('ArrowLeft'); 
  await sees(page, ['Page 4', 'Page 3']);
  await page.keyboard.press('ArrowLeft'); 
  await sees(page, ['Page 5']);
  await page.keyboard.press('ArrowRight'); 
  await sees(page, ['Page 4', 'Page 3']);
  await page.keyboard.press('PageDown'); await page.waitForTimeout(300);   // (Page Down still goes on)
  await sees(page, ['Page 5']);
  // One column: pages in order, one at a time; and the order follows a layout change.
  await page.keyboard.press('Home').catch(() => {});
  await page.click('#layoutBtn'); await page.waitForTimeout(500);   // (two → one)
  const order = await page.evaluate(() => [...document.querySelector('#page').contentDocument.querySelectorAll('.cbz-page img')].map(i => i.alt));
  assert.deepEqual(order, ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5']);
  assert.match(await page.evaluate(() => document.querySelector('#infoList')?.textContent || ''), /Right to left/);
});

test('a left-to-right comic is unchanged: pages in order, the right arrow goes on', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': 'two' });
  await sees(page, ['Page 1', 'Page 2']);
  await page.keyboard.press('ArrowRight'); 
  await sees(page, ['Page 3', 'Page 4']);
});

test('right-to-left manga on a narrow screen (one column): pages in order (E-9)', async () => {
  const page = await h.newPage({ viewport: { width: 500, height: 800 } });
  await h.openReader(page, MANGA, { 'spine:layout': 'two' });
  await sees(page, ['Page 1']);
  await page.keyboard.press('ArrowLeft'); 
  await sees(page, ['Page 2']);
  // Wider again: back to right-to-left spreads, at the same place.
  await page.setViewportSize({ width: 1280, height: 800 }); 
  await sees(page, ['Page 2', 'Page 1']);
});

test('right-to-left manga: the place kept is the spread\'s first page (on the right), across a reload and a layout change (E-9)', async () => {
  const page = await h.newPage();
  await h.openReader(page, MANGA, { 'spine:layout': 'two' });
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(500);   // (pages 3 and 4)
  await page.reload(); await h.waitForBook(page);
  await sees(page, ['Page 4', 'Page 3']);
  await page.click('#layoutBtn'); await page.waitForTimeout(500);   // (one column)
  await sees(page, ['Page 3']);
});

test('a comic switched into the scroll layout opens at the page it was on (round 22 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': 'one' });
  for (let k = 0; k < 20; k++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const before = await onScreen(page);
  assert.deepEqual(before, ['Page 21']);
  await page.click('#layoutBtn'); await page.waitForTimeout(800);   // (one → scroll)
  const top = await page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument;
    return [...d.querySelectorAll('.cbz-page')].find(p => p.getBoundingClientRect().bottom > 40)?.querySelector('img').alt;
  });
  assert.equal(top, 'Page 21');
});

test('manga: a sideways trackpad swipe goes the same way as a touch swipe; a layout change right after scrolling keeps the page (round 22 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, MANGA, { 'spine:layout': 'two' });
  const frameBox = await page.locator('#page').boundingBox();
  await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
  await page.mouse.wheel(-120, 0);   // (a swipe to the right, as a finger moves: goes on in a manga)
  
  await sees(page, ['Page 4', 'Page 3']);
  // A comic scrolled and switched at once.
  const p2 = await h.newPage();
  await h.openReader(p2, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': 'scroll' });
  await p2.evaluate(() => { const se = document.querySelector('#page').contentDocument.scrollingElement; se.scrollTop = document.querySelector('#page').contentDocument.querySelector('#cbz-p20').offsetTop; se.dispatchEvent(new Event('scroll')); });
  await p2.waitForTimeout(800);
  await p2.evaluate(() => { const se = document.querySelector('#page').contentDocument.scrollingElement; se.scrollTop = document.querySelector('#page').contentDocument.querySelector('#cbz-p31').offsetTop; se.dispatchEvent(new Event('scroll')); });
  await p2.waitForTimeout(50);
  await p2.click('#layoutBtn'); await p2.waitForTimeout(800);   // (scroll → two, before the scroll's place is saved)
  const shown = await onScreen(p2);
  assert.ok(shown.includes('Page 31'), JSON.stringify(shown));
});
