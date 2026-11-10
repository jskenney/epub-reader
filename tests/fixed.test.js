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
    vw: w.innerWidth, vh: w.innerHeight, columns: d.querySelector('[id^="spine-flow-"]') && getComputedStyle(d.querySelector('[id^="spine-flow-"]')).columnCount,
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

test('a fixed-layout page\'s place is saved: after a page turn and a reload it reopens there (round 22 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, FIXED);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  await page.reload(); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
});

test('a fixed-layout page keeps its own styles: html sizing, body padding, "body >" selectors, colours, in a dark theme (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/fixed-styled.epub`, { 'spine:theme': 'black' });
  const s = await page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow;
    const b = d.body.getBoundingClientRect(), cap = d.querySelector('.cap'), plain = d.querySelector('.plain');
    return { left: b.left, top: b.top, width: b.width, height: b.height, vw: w.innerWidth, vh: w.innerHeight,
      capPos: getComputedStyle(cap).position, capColour: getComputedStyle(cap).color, plainColour: getComputedStyle(plain).color,
      plainFont: getComputedStyle(plain).fontFamily, htmlBg: getComputedStyle(d.documentElement).backgroundColor };
  });
  assert.ok(Math.abs(s.left + s.width / 2 - s.vw / 2) < 2, `centred: ${JSON.stringify(s)}`);
  assert.ok(s.top >= -1 && s.top + s.height <= s.vh + 1, `fits, padding included: ${JSON.stringify(s)}`);
  assert.ok(Math.abs(s.width / s.height - 0.75) < 0.01, 'its shape, padding inside it');
  assert.equal(s.capPos, 'absolute', '"body > p.cap" matches');
  assert.equal(s.capColour, 'rgb(204, 0, 0)');
  assert.equal(s.plainColour, 'rgb(0, 0, 0)', 'uncoloured text stays dark on its white page, not the theme\'s ink');
  assert.doesNotMatch(s.plainFont, /Literata/);
  assert.equal(s.htmlBg, 'rgb(255, 221, 221)', 'the book\'s html colour');
  // Its text is still found and read: search finds it.
  await page.fill('#searchBox', 'Plain words'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchStatus'), /1 of 1 match/);
});

test('in the scroll layout with the read-aloud bar open, the bottom of a fixed page can be scrolled into view (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'scroll' });
  await page.keyboard.press('r'); await page.waitForTimeout(500); await page.keyboard.press(' ');
  const r = await page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument, se = d.scrollingElement;
    se.scrollTop = se.scrollHeight;
    const bar = document.querySelector('#tts').getBoundingClientRect(), fr = document.querySelector('#page').getBoundingClientRect();
    return { bottom: d.body.getBoundingClientRect().bottom + fr.top, barTop: bar.top };
  });
  assert.ok(r.bottom <= r.barTop + 1, JSON.stringify(r));
});
