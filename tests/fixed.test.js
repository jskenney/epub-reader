// Fixed-layout (pre-paginated) EPUBs (REVIEW.md E-15).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const FIXED = `${h.READER}?book=books/fixed.epub`;
const shown = page => page.evaluate(() => {
  const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow;
  // (Rectangles include the zoom, as browsers now apply CSS zoom.)
  const b = d.body.getBoundingClientRect(), z = Number(getComputedStyle(d.body).zoom) || 1;
  return { fxl: d.documentElement.getAttribute('data-spine-fxl'), zoom: z, left: b.left, top: b.top, width: b.width, height: b.height,
    vw: w.innerWidth, vh: w.innerHeight, columns: getComputedStyle(d.querySelector('[id^="spine-flow-"]')).columnCount,
    cap: d.querySelector('.cap') && (() => { const r = d.querySelector('.cap').getBoundingClientRect(); return { left: r.left, top: r.top }; })() };
});

test('a fixed-layout page is shown whole at its own size, scaled to fit and centred, with its own positions (E-15)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED);
  const s = await shown(page);
  assert.equal(s.fxl, '600 800');
  assert.ok(s.height <= s.vh && s.height > s.vh * 0.8, `fits the height: ${s.height} of ${s.vh}`);
  assert.ok(Math.abs(s.width / s.height - 0.75) < 0.01, 'keeps its shape');
  assert.ok(Math.abs(s.left + s.width / 2 - s.vw / 2) < 2, 'centred');
  // (Its caption at 700 px of 800, as the book placed it.)
  assert.ok(Math.abs((s.cap.top - s.top) / s.height - 700 / 800) < 0.02, JSON.stringify(s));
  // One page per screen: the next page is the next file.
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  // The SVG page is sized by its viewBox.
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
  assert.equal((await shown(page)).fxl, '400 300');
  // A page marked reflowable is reflowed in columns.
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
  const r = await shown(page);
  assert.equal(r.fxl, null); assert.equal(r.columns, '2');
});

test('a fixed-layout page refits when the window changes, and in the scroll layout fills the width (E-15)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED);
  await page.setViewportSize({ width: 500, height: 900 }); await page.waitForTimeout(500);
  const n = await shown(page);
  assert.ok(n.width <= n.vw && n.width > n.vw * 0.85, `fits the width: ${n.width} of ${n.vw}`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#layoutBtn'); await page.click('#layoutBtn'); await page.waitForTimeout(500);   // (two → one → scroll)
  const sc = await shown(page);
  assert.ok(sc.width > sc.vw * 0.85, `the width: ${sc.width} of ${sc.vw}`);
  // The text of a fixed page can still be searched and read aloud.
  await page.fill('#searchBox', 'Fixed page'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchStatus'), /of 2 matches/);
});
