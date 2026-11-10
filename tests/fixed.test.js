// Fixed-layout (pre-paginated) EPUBs (REVIEW.md E-15, E-20). In the page layouts each page is a frame of its own
// size, scaled to fit the stage (with the facing page beside it in a two-page spread); in the scroll layout the page
// is zoomed inside the reader's frame to fill its width.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const FIXED = `${h.READER}?book=books/fixed.epub`;
const book = name => `${h.READER}?book=books/${name}.epub`;
// Turn to another section and wait for it to be shown (a key pressed while a section loads is passed over).
async function turn(page, key = 'ArrowRight') {
  await page.evaluate(() => { document.querySelector('#page').contentDocument.__old = true; });
  // (In the scroll layout the key first scrolls through the page: pressed again until the next one shows.)
  const isNew = () => page.evaluate(() => { const d = document.querySelector('#page').contentDocument; return !!d && !d.__old && d.readyState === 'complete' && d.body?.childElementCount > 0; });
  for (let k = 0; k < 12 && !(await isNew()); k++) { await page.keyboard.press(key); await h.waitFor(isNew, 1500, 100); }
  assert.ok(await isNew(), 'the next page shows');
  await page.waitForTimeout(400);
}
// The page frame (and the facing page's) as shown on the stage, in the reader's coordinates, and things inside.
const shown = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const f = document.querySelector('#page'), f2 = document.querySelector('#page2'), d = f.contentDocument, w = f.contentWindow, st = document.querySelector('#stage');
  const flow = d.querySelector('[id^="spine-flow-"]'), cap = d.querySelector('.cap');
  return { fxl: d.documentElement.getAttribute('data-spine-fxl'), page: box(f), stage: box(st), vw: w.innerWidth, vh: w.innerHeight,
    facing: !f2.hidden && box(f2), facingText: !f2.hidden && f2.contentDocument?.body?.innerText.trim(), text: d.body.innerText.trim(),
    fxlStage: st.classList.contains('fxl'), columns: flow && getComputedStyle(flow).columnCount, visible: getComputedStyle(d.body).visibility,
    cap: cap && { left: cap.getBoundingClientRect().left, top: cap.getBoundingClientRect().top } };
});
const colours = page => page.evaluate(() => {
  const f = document.querySelector('#page'), d = f.contentDocument, w = f.contentWindow;
  return { html: w.getComputedStyle(d.documentElement).backgroundColor, body: w.getComputedStyle(d.body).backgroundColor, text: w.getComputedStyle(d.querySelector('p')).color,
    frame: getComputedStyle(f).backgroundColor, stage: getComputedStyle(document.querySelector('#stage')).backgroundColor, visible: w.getComputedStyle(d.body).visibility,
    css: [...d.querySelectorAll('style')].map(s => s.textContent).join('') };
});

test('a fixed-layout page is a frame of its own size, scaled to fit and centred, with its own positions (E-15, E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'one' });
  const s = await shown(page);
  assert.equal(s.fxl, '600 800');
  assert.equal(s.fxlStage, true);
  assert.deepEqual([s.vw, s.vh], [600, 800], 'the frame is the page: its own viewport');
  assert.equal(s.visible, 'visible');
  assert.ok(s.page.height <= s.stage.height && s.page.height > s.stage.height * 0.75, `fits the height: ${JSON.stringify(s)}`);
  assert.ok(Math.abs(s.page.width / s.page.height - 0.75) < 0.01, 'keeps its shape');
  assert.ok(Math.abs((s.page.left + s.page.right) / 2 - (s.stage.left + s.stage.right) / 2) < 2, 'centred');
  assert.ok(Math.abs(s.cap.top - 700) < 2, `the caption where the book put it, in the page's own coordinates: ${JSON.stringify(s.cap)}`);
  // One page per screen in the single-column layout: the next page is the next file; the SVG page is sized by its viewBox.
  await turn(page);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  await turn(page);
  assert.equal((await shown(page)).fxl, '400 300');
  // A page marked reflowable is reflowed in columns, in the reader's usual frame.
  await turn(page);
  const r = await shown(page);
  assert.equal(r.fxl, null); assert.equal(r.fxlStage, false); assert.equal(r.columns, '1');
});

test('vw and vh units and fixed positions measure the page, not the reader (E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, book('fixed-units'));
  const r = await page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument;
    const half = d.querySelector('#half').getBoundingClientRect(), pin = d.querySelector('#pin').getBoundingClientRect();
    return { half: [half.width, half.height], pin: [pin.right, pin.bottom] };
  });
  assert.deepEqual(r, { half: [300, 80], pin: [600, 800] });
});

test('two-page spreads: the cover alone, then pairs side by side; turning goes a spread at a time; the facing page can be clicked (E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'two' });
  assert.equal((await shown(page)).facing, false, 'the cover alone');
  await turn(page);
  let s = await shown(page);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  assert.ok(s.facing, 'a spread');
  assert.ok(s.page.right <= s.facing.left + 1, 'page 2 on the left, page 3 on its right');
  assert.match(s.facingText, /Drawn page/);
  assert.ok(Math.abs((s.page.left + s.facing.right) / 2 - (s.stage.left + s.stage.right) / 2) < 2, 'the spread centred');
  // Past the spread: the reflowable page 4; back: the spread again, from its first page.
  await turn(page);
  assert.match(await page.textContent('#spinePos'), /spine 4\/4/);
  assert.equal((await shown(page)).facing, false);
  await turn(page, 'ArrowLeft');
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  // A click on the facing page goes to it.
  await page.evaluate(() => { document.querySelector('#page').contentDocument.__old = true; });
  await page.locator('#page2').click();
  await page.waitForFunction(() => /spine 3\/4/.test(document.querySelector('#spinePos').textContent));
  // One column, or a narrow window: one page at a time.
  await page.click('#layoutBtn'); await page.waitForTimeout(800);
  assert.equal((await shown(page)).facing, false);
});

test('spreads follow the pages\' own sides (page-spread-left/right/center) (E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, book('fixed-sides'), { 'spine:layout': 'two' });
  let s = await shown(page);
  assert.ok(s.facing && /Page 2/.test(s.facingText), 'pages 1 (left) and 2 (right) together, no lone cover');
  await turn(page);
  s = await shown(page);
  assert.match(s.text, /Page 3/); assert.equal(s.facing, false, 'a centre page alone');
});

test('a right-to-left fixed-layout book: spreads read right to left, and the left arrow goes on (E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, book('fixed-rtl'), { 'spine:layout': 'two' });
  await turn(page, 'ArrowLeft');
  const s = await shown(page);
  assert.match(s.text, /Page 2/);
  assert.ok(s.facing && /Page 3/.test(s.facingText) && s.facing.right <= s.page.left + 1, 'page 3 on the left of page 2');
  await turn(page, 'ArrowRight');
  assert.match((await shown(page)).text, /Page 1/);
});

test('EPUB 2 fixed layout: a fixed-layout meta, or Apple\'s display options (E-20)', async () => {
  const page = await h.newPage();
  for (const name of ['fixed-epub2', 'fixed-apple']) {
    await h.openReader(page, book(name), { 'spine:layout': 'one' });
    assert.equal((await shown(page)).fxl, '600 800', name);
  }
});

test('a fixed-layout page refits when the window changes, and in the scroll layout fills the width (E-15)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'one' });
  await page.setViewportSize({ width: 500, height: 900 }); await page.waitForTimeout(600);
  const n = await shown(page);
  assert.ok(n.page.width <= n.stage.width && n.page.width > n.stage.width * 0.85, `fits the width: ${JSON.stringify(n)}`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#layoutBtn'); await page.click('#layoutBtn'); await page.waitForTimeout(600);   // (one → scroll → two)
  await page.click('#layoutBtn'); await page.waitForTimeout(600);   // (two → one)
  await page.evaluate(() => localStorage.setItem('spine:layout', '"scroll"'));
  await page.reload(); await h.waitForBook(page);
  const sc = await page.evaluate(() => { const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow; return { width: d.body.getBoundingClientRect().width, vw: w.innerWidth }; });
  assert.ok(sc.width > sc.vw * 0.85, `the width: ${JSON.stringify(sc)}`);
  await page.fill('#searchBox', 'Fixed page');
  await page.waitForFunction(() => /of 2 matches/.test(document.querySelector('#searchStatus').textContent), null, { timeout: 10000 });
});

test('a fixed-layout page\'s place is saved: after a page turn and a reload it reopens there (round 22 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, FIXED, { 'spine:layout': 'one' });
  await turn(page);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
  await page.reload(); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 2\/4/);
});

test('a fixed-layout page keeps its own styles: html sizing, "body >" selectors, colours, in a dark theme (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/fixed-styled.epub`, { 'spine:theme': 'black', 'spine:layout': 'one' });
  const r = await page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow, cap = d.querySelector('.cap'), plain = d.querySelector('.plain');
    return { capPos: w.getComputedStyle(cap).position, capColour: w.getComputedStyle(cap).color, plainColour: w.getComputedStyle(plain).color,
      plainFont: w.getComputedStyle(plain).fontFamily, htmlBg: w.getComputedStyle(d.documentElement).backgroundColor };
  });
  assert.equal(r.capPos, 'absolute', '"body > p.cap" matches');
  assert.equal(r.capColour, 'rgb(204, 0, 0)');
  assert.equal(r.plainColour, 'rgb(0, 0, 0)', 'uncoloured text stays dark on its page, not the theme\'s ink');
  assert.doesNotMatch(r.plainFont, /Literata/);
  assert.equal(r.htmlBg, 'rgb(255, 221, 221)', 'the book\'s html colour');
  await page.fill('#searchBox', 'Plain words');
  await page.waitForFunction(() => /1 of 1 match/.test(document.querySelector('#searchStatus').textContent), null, { timeout: 10000 });
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

test('in the page layouts the read-aloud bar doesn\'t cover the page (E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'one' });
  await page.keyboard.press('r'); await page.waitForTimeout(600); await page.keyboard.press(' ');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ bottom: document.querySelector('#page').getBoundingClientRect().bottom, barTop: document.querySelector('#tts').getBoundingClientRect().top }));
  assert.ok(r.bottom <= r.barTop + 1, JSON.stringify(r));
});

test('a vertically written fixed page is centred, and reachable when scrolling (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/fixed-styled.epub`, { 'spine:theme': 'black', 'spine:layout': 'one' });
  await turn(page);
  let s = await shown(page);
  assert.ok(Math.abs((s.page.left + s.page.right) / 2 - (s.stage.left + s.stage.right) / 2) < 2, `centred: ${JSON.stringify(s)}`);
  await page.click('#layoutBtn'); await page.waitForTimeout(800);   // (one → scroll)
  await page.evaluate(() => { document.querySelector('#page').contentDocument.scrollingElement.scrollTop = 0; });
  const b = await page.evaluate(() => { const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow; const r = d.body.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, vw: w.innerWidth }; });
  assert.ok(b.top >= 0, `its top can be reached: ${JSON.stringify(b)}`);
  assert.ok(Math.abs((b.left + b.right) / 2 - b.vw / 2) < 2, `centred when scrolling: ${JSON.stringify(b)}`);
});

test('the theme colours the stage around fixed pages; a page with no colour of its own is white with dark text; highlights are light ones (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/fixed-plain.epub`, { 'spine:theme': 'black', 'spine:layout': 'one' });
  const c = await colours(page);
  assert.equal(c.stage, 'rgb(0, 0, 0)', 'the theme around the page');
  assert.equal(c.frame, 'rgb(255, 255, 255)', 'the page white');
  assert.equal(c.text, 'rgb(0, 0, 0)');
  assert.match(c.css, /::highlight\(tts-sentence\)\{background-color:#F0DCDF;color:#1a1408\}/i);
  // The same in the scroll layout, where the page is inside the reader's frame.
  await page.click('#layoutBtn'); await page.waitForTimeout(800);   // (one → scroll)
  const sc = await colours(page);
  assert.deepEqual([sc.html, sc.body, sc.text, sc.visible], ['rgb(0, 0, 0)', 'rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'visible']);
});

test('a fixed page coloured on its html, or by bgcolor, keeps its colours, in every theme and layout (round 22 review)', async () => {
  for (const [theme, lay] of [['light', 'one'], ['black', 'one'], ['black', 'scroll']]) {
    const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
    await h.openReader(page, `${h.READER}?book=books/fixed-colours.epub`, { 'spine:theme': theme, 'spine:layout': lay });
    let c = await colours(page);
    assert.equal(c.visible, 'visible');
    assert.equal(c.html, 'rgb(0, 51, 102)', `${theme} ${lay}: the page's navy`);
    assert.equal(c.text, 'rgb(255, 255, 255)');
    await turn(page);
    c = await colours(page);
    assert.equal(c.body, 'rgb(0, 0, 0)', `${theme} ${lay}: bgcolor kept`);
    assert.equal(c.text, 'rgb(255, 255, 255)');
    await turn(page);
    c = await colours(page);
    assert.ok(lay === 'scroll' ? c.body === 'rgb(255, 255, 255)' : c.frame === 'rgb(255, 255, 255)', `${theme} ${lay}: a page with no colour of its own is white: ${JSON.stringify(c)}`);
    assert.equal(c.text, 'rgb(0, 0, 0)');
  }
});

test('a fixed-layout book reaches 100% on its last page (round 22 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/fixed-colours.epub`, { 'spine:layout': 'one' });
  await turn(page); await turn(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
  assert.equal(await page.textContent('#pct'), '100%');
});

test('a page coloured black on its html stays black with white text in the black theme, and after a theme change (round 22 review)', async () => {
  for (const lay of ['one', 'scroll']) {
    const page = await h.newPage();
    await h.openReader(page, book('fixed-black'), { 'spine:theme': 'black', 'spine:layout': lay });
    const c = async () => { const x = await colours(page); return [x.html, x.text]; };
    assert.deepEqual(await c(), ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'], lay);
    await page.click('#themeBtn'); await page.waitForTimeout(500);   // (to a light theme)
    assert.deepEqual(await c(), ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'], `${lay}: still the book's black`);
  }
});

test('a fixed page switched into the scroll layout, or reopened in it, starts at its top; the time left shows in page layouts (round 22 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, FIXED, { 'spine:layout': 'one', 'spine:set:TIME_LEFT': true });
  await page.waitForFunction(() => document.querySelector('#timeLeft').textContent.trim(), null, { timeout: 10000 });
  await page.click('#layoutBtn'); await page.waitForTimeout(800);   // (one → scroll)
  assert.equal(await page.evaluate(() => document.querySelector('#page').contentDocument.scrollingElement.scrollTop), 0);
  await page.evaluate(() => localStorage.setItem('spine:layout', '"one"'));
  await page.reload(); await h.waitForBook(page);
  await page.evaluate(() => localStorage.setItem('spine:layout', '"scroll"'));
  await page.reload(); await h.waitForBook(page);
  assert.equal(await page.evaluate(() => document.querySelector('#page').contentDocument.scrollingElement.scrollTop), 0);
});

test('a fixed page coloured by a stylesheet that arrives late is shown in its colours; a media query sees the page (round 22 final review, E-20)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('http://localhost:8792/late.css', async route => { await new Promise(r => setTimeout(r, 1500)); await route.fulfill({ contentType: 'text/css', body: 'html{background:#036;color:#fff}' }); });
  await h.openReader(page, `${h.PLAIN}/reader/index.html?book=books/fixed-late.epub`, { 'spine:theme': 'black', 'spine:layout': 'scroll', 'spine:set:ALLOW_REMOTE_CONTENT': true });
  const c = async () => { const x = await colours(page); return [x.html, x.body, x.text, x.visible].join(' | '); };
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('p')?.textContent === 'Late sheet words');
  assert.ok(await h.waitFor(async () => (await c()) === 'rgb(0, 51, 102) | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | visible', 8000), await c());
  // A media query: while scrolling the page is in the reader's frame, which is wide: navy; narrower: a white page.
  await turn(page);
  assert.ok(await h.waitFor(async () => (await c()).startsWith('rgb(0, 51, 102)'), 5000), await c());
  await page.setViewportSize({ width: 800, height: 800 });
  assert.ok(await h.waitFor(async () => (await c()) === 'rgb(0, 0, 0) | rgb(255, 255, 255) | rgb(0, 0, 0) | visible', 5000), await c());
  // In the page layouts the page's frame is the page (600 wide): the query doesn't apply, whatever the window.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#layoutBtn'); await page.waitForTimeout(800);   // (scroll → two)
  const x = await colours(page);
  assert.equal(x.html, 'rgba(0, 0, 0, 0)'); assert.equal(x.text, 'rgb(0, 0, 0)');
});
