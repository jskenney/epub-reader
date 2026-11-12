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

test('with the top bar hidden, the page goes up to the top, and its corner button covers none of the text (round 25 review, L-289)', async () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 400, height: 760 }]) {
    const page = await h.newPage({ viewport });
    await h.openReader(page, `${h.READER}?book=books/long.epub`);
    await page.keyboard.press('n'); await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const c = document.querySelector('#barCorner').getBoundingClientRect(), f = document.querySelector('#page'), fr = f.getBoundingClientRect();
      const first = f.contentDocument.querySelector('h1, p').getBoundingClientRect();
      return { cb: c.bottom, stage: document.querySelector('#stage').getBoundingClientRect().top, text: fr.top + first.top };
    });
    assert.ok(r.stage <= 20, `the page starts at ${r.stage} (${viewport.width})`);
    assert.ok(r.cb <= r.text, `corner bottom ${r.cb}, text top ${r.text} (${viewport.width})`);
    await page.click('#barCorner');
    assert.equal(await page.isVisible('#tocBtn'), true);
  }
});

test('in full screen with the top bar hidden, no empty strip is left above the page (round 25 review, L-290)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  await page.keyboard.press('f'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelector('.app').classList.contains('fs')), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.app')).paddingTop), '0px');
});

// Round 25 review, loop 5's review.
test('a right-to-left book (dir on the html element, or direction in its stylesheet) can be read page by page to the end of a chapter', async () => {
  for (const name of ['rtl-text.epub', 'rtl-css.epub']) {
    for (const lay of ['one', 'two']) {
      const page = await h.newPage();
      await h.openReader(page, `${h.READER}?book=books/${name}`, { 'spine:layout': lay });
      const pos = () => page.textContent('#spinePos');
      const n = Number(/page \d+\/(\d+)/.exec(await pos())[1]);
      assert.ok(n > 2, `${name} ${lay}: ${await pos()}`);
      const shown = id => h.inFrame(page, (doc, id) => { const r = doc.getElementById(id).getBoundingClientRect(), w = doc.defaultView.innerWidth; return r.right > 0 && r.left < w; }, id);
      assert.equal(await shown('p0'), true);
      for (let k = 1; k < n; k++) await page.click('#nextBtn');
      assert.match(await pos(), new RegExp(`page ${n}/${n}`));
      assert.equal(await shown('p59'), true, `${name} ${lay}: the last paragraph on the last page`);
      assert.equal(await shown('p0'), false);
    }
  }
});

test('a book in vertical text can be read to the end (laid out across, for now: E-29)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/vertical.epub`, { 'spine:layout': 'one' });
  const n = Number(/page \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
  assert.ok(n > 2, `pages: ${n}`);
  await h.openReader(page, `${h.READER}?book=books/vertical.epub`, { 'spine:layout': 'scroll' });
  assert.ok(await h.inFrame(page, doc => doc.scrollingElement.scrollHeight > doc.scrollingElement.clientHeight * 2), 'it scrolls');
});

test('a link given the focus on another page brings that page into view (round 25 review, M-142)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/far-link.epub`, { 'spine:layout': 'one' });
  assert.match(await page.textContent('#spinePos'), /page 1\//);
  await h.inFrame(page, doc => doc.getElementById('far').focus());
  await page.waitForTimeout(200);
  assert.ok(await h.inFrame(page, doc => { const r = doc.getElementById('far').getBoundingClientRect(); return r.right > 0 && r.left < doc.defaultView.innerWidth; }), 'the focused link is in sight');
  assert.doesNotMatch(await page.textContent('#spinePos'), /page 1\//);
});

test('an error stays in sight in full screen (round 25 review, L-333)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/nothing-here.epub`);
  assert.match(await h.notice(page), /couldn't be opened/);
  await page.keyboard.press('f'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector('.app').classList.contains('fs')), true);
  assert.equal(await page.isVisible('#notice'), true);
});

// The site's own top bar (reader-config.json).
test('CONTENTS_TITLE sets the contents button\'s word ("" for the icon alone, still named); NAVBAR_ICON shows a logo before it, as tall as the button and at most twice as wide, going to NAVBAR_LINK', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-brand/index.html?book=/reader/books/long.epub`);
  const r = await page.evaluate(() => {
    const btn = document.querySelector('#tocBtn'), logo = document.querySelector('#navLogo img'), a = document.querySelector('#navLogo a');
    const b = btn.getBoundingClientRect(), l = logo.getBoundingClientRect();
    return { text: btn.textContent.trim(), name: btn.getAttribute('aria-label'), h: l.height, w: l.width, bh: b.height, before: l.right <= b.left, href: a?.getAttribute('href'), label: a?.getAttribute('aria-label') };
  });
  assert.equal(r.text, '');
  assert.equal(r.name, 'Contents');
  assert.ok(r.h <= r.bh + 0.5 && r.w <= 2 * r.bh + 0.5 && r.w > 0, JSON.stringify(r));
  assert.ok(r.before, 'just left of the contents button');
  assert.equal(r.label, 'Go to /reader/books/notes.md');
  await Promise.all([page.waitForURL(/\/reader\/books\/notes\.md$/), page.click('#navLogo a')]);
});

test('CONTENTS_TITLE takes any text; a tall logo keeps within the bar; a link that isn\'t a web address is refused (the logo shows, without a link); by default, the word Contents and no logo', async () => {
  const page = await h.newPage();
  const warned = []; page.on('console', m => { if (/NAVBAR_LINK/.test(m.text())) warned.push(m.text()); });
  await h.openReader(page, `${h.SITE}/folder-brand2/index.html?book=/reader/books/long.epub`);
  assert.equal((await page.textContent('#tocBtn')).trim(), 'Chapters ✦');
  assert.equal(await page.getAttribute('#tocBtn', 'aria-label'), null);
  const r = await page.evaluate(() => { const l = document.querySelector('#navLogo img').getBoundingClientRect(); return { h: l.height, w: l.width, link: !!document.querySelector('#navLogo a') }; });
  assert.ok(r.h <= 34.5 && r.h > 30 && r.w <= 69, JSON.stringify(r));
  assert.equal(r.link, false);
  assert.ok(warned.some(w => /NAVBAR_LINK ignored/.test(w)), warned.join(' | '));
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.equal((await page.textContent('#tocBtn')).trim(), 'Contents');
  assert.equal(await page.isHidden('#navLogo'), true);
});

test('the contents show the book\'s title and authors only while the top bar is hidden (they are in the bar otherwise)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.equal(await page.isVisible('#bookTitle'), true);
  assert.equal(await page.isHidden('#metaTitle'), true);
  assert.equal(await page.isHidden('#metaAuthors'), true);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  assert.equal(await page.isVisible('#metaTitle'), true);
  assert.equal(await page.textContent('#metaTitle'), 'The Long Book');
  assert.equal(await page.isVisible('#metaAuthors'), true);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  assert.equal(await page.isHidden('#metaTitle'), true);
  // The contents keep their "Contents" heading, which names their navigation (round 26 review, M-151).
  assert.equal(await page.isVisible('#tocNav h2'), true);
  assert.equal(await page.evaluate(() => document.querySelectorAll('[id="tocHead"]').length), 1);
  assert.equal(await page.evaluate(() => document.getElementById(document.querySelector('#tocNav').getAttribute('aria-labelledby')).textContent.trim()), 'Contents');
  // With the title hidden, the search box lines up with the top of the page.
  const tops = await page.evaluate(() => [document.querySelector('#toc .search').getBoundingClientRect().top, document.querySelector('#page').getBoundingClientRect().top]);
  assert.ok(Math.abs(tops[0] - tops[1]) <= 1, `search ${tops[0]}, page ${tops[1]}`);
});

const BAR_TOOLS = ['#ttsBtn', '#fontPick', '#themeBtn', '#layoutBtn', '#fsBtn', '#sizeGroup', '#lineGroup', '#widthGroup', '#openBtn', '#setBtn'];

test('SHOW_READ_ALOUD, SHOW_FONT_MENU, SHOW_THEME_BUTTON, SHOW_LAYOUT_BUTTON, SHOW_FULLSCREEN_BUTTON, SHOW_TEXT_SIZE, SHOW_LINE_SPACING, SHOW_TEXT_WIDTH, SHOW_OPEN_BUTTON and SHOW_SETTINGS_BUTTON hide the top bar\'s buttons; all shown by default, with Text settings in Settings', async () => {
  const page = await h.newPage({ viewport: { width: 1400, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  for (const sel of BAR_TOOLS) assert.equal(await page.isVisible(sel), true, sel);
  await page.click('#setBtn');
  const order = await page.evaluate(() => [...document.querySelectorAll('#setDialog .ab-actions .btn:not([hidden])')].map(b => b.id));
  assert.deepEqual(order.slice(0, 2), ['setGenerate', 'setText'], 'Text settings is just right of Generate config');
  await h.openReader(page, `${h.SITE}/folder-notools/index.html?book=/reader/books/long.epub`);
  for (const sel of BAR_TOOLS) assert.equal(await page.isHidden(sel), true, sel);
  assert.equal(await page.isVisible('#tocBtn'), true);
  const cfg = JSON.parse(await page.evaluate(() => { document.querySelector('#setBtn').click(); document.querySelector('#setGenerate').click(); return document.querySelector('#cfgText').value; }));
  assert.equal(cfg.SHOW_SETTINGS_BUTTON, false); assert.equal(cfg.SHOW_TEXT_WIDTH, false);
});

test('Text settings does what the top bar does: reading font, theme, layout, text size, line spacing, text width, then read aloud, full screen and opening a book', async () => {
  const page = await h.newPage({ viewport: { width: 1400, height: 800 } });
  await h.openReader(page, `${h.SITE}/folder-notools/index.html?book=/reader/books/long.epub`);
  await page.evaluate(() => document.querySelector('#setBtn').click());   // (its button hidden here)
  await page.click('#setText');
  assert.equal(await page.isVisible('#txtDialog'), true);
  const fonts = await page.$$eval('#txtFont option', os => os.map(o => o.value));
  assert.ok(fonts.length > 3 && fonts.includes('lexend'), fonts.join());
  await page.selectOption('#txtFont', 'lexend');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('spine:face'))), 'lexend');
  await page.selectOption('#txtTheme', 'sepia');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'sepia');
  await page.selectOption('#txtLayout', 'scroll');
  assert.equal(await page.getAttribute('#layoutBtn', 'data-layout'), 'scroll');
  const size0 = await page.textContent('#txtSize');
  await page.click('#txtLarger');
  assert.equal(await page.textContent('#txtSize'), (parseInt(size0) + 10) + '%');
  assert.equal(await page.textContent('#fontPct'), await page.textContent('#txtSize'));
  const line0 = Number(await page.textContent('#txtLine'));
  await page.click('#txtLooser');
  assert.equal(Number(await page.textContent('#txtLine')), Math.round((line0 + 0.15) * 100) / 100);
  await page.click('#txtNarrower');
  assert.equal(await page.textContent('#txtWidth'), 'Narrow');
  assert.equal(await page.isDisabled('#txtNarrower'), true);
  assert.equal(await page.textContent('#widthVal'), 'Narrow');
  // Done goes back to Settings, which shows the theme chosen.
  await page.click('#txtDone');
  assert.equal(await page.isHidden('#txtDialog'), true);
  assert.equal(await page.isVisible('#setDialog'), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'setText');
  assert.equal(await page.isChecked('#setForm input[name="theme"][value="sepia"]'), true);
  // Read aloud, full screen and opening a book leave both dialogs for the page.
  await page.click('#setText'); await page.click('#txtRead');
  assert.equal(await page.isHidden('#setDialog'), true);
  assert.ok(await h.waitFor(() => page.isVisible('#tts'), 3000), 'the read-aloud bar opens');
  await page.evaluate(() => document.querySelector('#setBtn').click()); await page.click('#setText');
  await page.click('#txtFs');
  assert.ok(await h.waitFor(() => page.evaluate(() => document.querySelector('.app').classList.contains('fs')), 3000), 'full screen');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('#setBtn').click()); await page.click('#setText');
  await page.evaluate(() => { window.showOpenFilePicker = undefined; });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 3000 }), page.click('#txtOpen')]);
  assert.ok(chooser, 'the file picker opens');
});

test('page turns stay lined up with the text after dozens of pages, when the text width\'s margins come to a fraction of a pixel (two columns, Wide)', async () => {
  for (const width of [1915, 1731]) {
    const page = await h.newPage({ viewport: { width, height: 900 } });
    await h.openReader(page, `${h.READER}?book=books/drift.md`, { 'spine:width': 2, 'spine:layout': 'two' });
    const over = () => page.evaluate(() => {
      const d = document.querySelector('#page').contentDocument, flow = d.querySelector('[id^="spine-flow"]'), clip = flow.parentElement.getBoundingClientRect();
      const w = d.createTreeWalker(flow, NodeFilter.SHOW_TEXT), r = d.createRange(); let n, worst = 0;
      while ((n = w.nextNode())) { r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.right > clip.left && q.left < clip.right) worst = Math.max(worst, clip.left - q.left, q.right - clip.right); }
      return worst;
    });
    for (let k = 0; k < 40; k++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    assert.match(await page.textContent('#fsPos'), /^page 41\//, 'turned 40 pages');
    const worst = await over();
    assert.ok(worst < 1.5, `${width}px window: text ${worst.toFixed(1)}px past the edge after 40 page turns`);
    await page.close();
  }
});

// How far text on the page shown runs past the edges of the text area (0: none).
const overhang = page => page.evaluate(() => {
  const d = document.querySelector('#page').contentDocument, flow = d.querySelector('[id^="spine-flow"]'), clip = flow.parentElement.getBoundingClientRect();
  const w = d.createTreeWalker(flow, NodeFilter.SHOW_TEXT), r = d.createRange(); let n, worst = 0;
  while ((n = w.nextNode())) { r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.right > clip.left + 1 && q.left < clip.right - 1) worst = Math.max(worst, clip.left - q.left, q.right - clip.right); }
  return worst;
});
const hitShown = (page, text) => page.evaluate(t => {
  const d = document.querySelector('#page').contentDocument, flow = d.querySelector('[id^="spine-flow"]'), clip = flow.parentElement.getBoundingClientRect();
  const w = d.createTreeWalker(flow, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const i = n.data.indexOf(t); if (i >= 0) { const r = d.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); const q = r.getBoundingClientRect(); return q.left >= clip.left - 1 && q.right <= clip.right + 1; } }
  return null;
}, text);

test('hundreds of pages into a chapter, the page shown still lines up and a search hit there is on it (one column, a gap of a fraction of a pixel: round 26 review, M-150)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/pages-long.epub`, { 'spine:layout': 'one', 'spine:width': 3 });
  await page.fill('#searchBox', 'Paragraph 1200:'); await page.keyboard.press('Enter');
  assert.ok(await h.waitFor(async () => /^page (2\d\d|3\d\d)\//.test(await page.textContent('#fsPos')), 5000), await page.textContent('#fsPos'));
  await page.waitForTimeout(200);
  assert.equal(await hitShown(page, 'Paragraph 1200:'), true, 'the hit is on the page shown');
  assert.ok(await overhang(page) < 1.5, `text ${await overhang(page)}px past an edge`);
});

test('a book\'s CSS on the reader\'s column flow (border, padding, width, zoom, transform, even !important) doesn\'t move the pages (round 26 review, M-149)', async () => {
  for (const layout of ['two', 'one']) {
    const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
    await h.openReader(page, `${h.READER}?book=books/pages-styled.epub`, { 'spine:layout': layout, 'spine:width': 1 });
    for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    assert.match(await page.textContent('#fsPos'), /^page 13\//, layout);
    assert.ok(await overhang(page) < 1.5, `${layout}: text ${await overhang(page)}px past an edge`);
    await page.fill('#searchBox', 'Paragraph 900:'); await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    assert.equal(await hitShown(page, 'Paragraph 900:'), true, `${layout}: the hit is on the page shown`);
    await page.close();
  }
});

test('a link running onto the next page, clicked there, is followed (the page doesn\'t turn back first: round 25 review, M-146)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/split-link.epub`, { 'spine:layout': 'one' });
  // To a page holding a later part of the link, whose start is on a page before.
  const where = () => h.inFrame(page, doc => {
    const a = doc.getElementById('split'), w = doc.defaultView.innerWidth, rs = [...a.getClientRects()];
    const shown = rs.find(r => r.left >= 0 && r.right <= w && r.width > 20);
    return { startBefore: rs[0].right <= 0, shown: shown && { x: shown.left + shown.width / 2, y: shown.top + shown.height / 2 } };
  });
  let at = null;
  for (let k = 0; k < 12 && !at; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80); const w = await where(); if (w.startBefore && w.shown) at = w.shown; }
  assert.ok(at, 'a page with the rest of the link');
  const box = await page.locator('#page').boundingBox();
  await page.mouse.click(box.x + at.x, box.y + at.y);
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => { const r = doc.getElementById('target').getBoundingClientRect(); return r.left >= 0 && r.right <= doc.defaultView.innerWidth; }), 5000), 'the link was followed');
});

test('right-to-left text in a book that doesn\'t say its pages go right to left: the left arrow goes on, as the pages come in (round 25 review, L-342)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/rtl-text.epub`, { 'spine:layout': 'one' });
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
  assert.match(await page.textContent('#spinePos'), /page 2\//);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  assert.match(await page.textContent('#spinePos'), /page 1\//);
  // A left-to-right book: as before.
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:layout': 'one' });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  assert.match(await page.textContent('#spinePos'), /page 2\//);
});

test('in a horizontal book, a vertical table header and SVG text stay vertical; a vertical paragraph is still set across (round 25 review, L-341)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/vertical-bits.epub`);
  const wm = id => h.inFrame(page, (doc, id) => getComputedStyle(doc.getElementById(id)).writingMode, id);
  assert.equal(await wm('vth'), 'vertical-rl');
  assert.notEqual(await wm('vsvg'), 'horizontal-tb');
  assert.equal(await wm('vp'), 'horizontal-tb');
});

test('a book\'s CSS can\'t hide or move the end of the chapter, which the page count goes by (round 26 review, L-354)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:layout': 'one' });
  for (const name of ['end-hidden.epub', 'end-far.epub']) {
    await h.openReader(page, `${h.READER}?book=books/${name}`, { 'spine:layout': 'one' });
    const n = Number(/page \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
    assert.ok(n > 2 && n < 40, `${name}: ${n} pages`);
    for (let k = 1; k < n; k++) await page.click('#nextBtn');
    assert.equal(await h.inFrame(page, doc => { const r = doc.getElementById('last').getBoundingClientRect(); return r.right > 0 && r.left < doc.defaultView.innerWidth; }), true, `${name}: the last words on the last page`);
  }
});

test('the place saved is exact enough to come back to the same page in a section of thousands of pages (round 26 review, L-358)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/pages-long.epub`, { 'spine:layout': 'one', 'spine:width': 3 });
  for (let k = 0; k < 7; k++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const [p, n] = (await page.textContent('#spinePos')).match(/page (\d+)\/(\d+)/).slice(1).map(Number);
  const f = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('spine:pos:')).map(([, v]) => JSON.parse(v).f)[0]);
  // (Exact to well under half a page of a 5000-page section.)
  assert.ok(Math.abs(f - (p - 1) / (n - 1)) < 1e-4, `f ${f}, page ${p} of ${n}`);
});

test('a logo keeps the top bar two rows high on a phone; the title and authors can be read in full (their title); NAVBAR_LINK written without https:// is taken as the web address (round 26 review, L-351, L-352, L-353)', async () => {
  const page = await h.newPage({ viewport: { width: 400, height: 800 } });
  const barH = () => page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().height);
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  const plain = await barH();
  assert.equal(await page.getAttribute('#bookTitle', 'title'), 'The Long Book');
  assert.equal(await page.getAttribute('#bookAuthor', 'title'), 'Test Author');
  await h.openReader(page, `${h.SITE}/folder-brand3/index.html?book=/reader/books/long.epub`);
  await page.waitForFunction(() => document.querySelector('#navLogo img')?.complete);
  assert.ok(await barH() <= plain + 2, `${await barH()} with the logo, ${plain} without`);
  assert.equal(await page.getAttribute('#navLogo a', 'href'), 'https://www.example.com/home');
});

test('Read aloud from Text settings puts the focus on the read-aloud bar; closing the bar puts it on the page when the Read aloud button is hidden (round 26 review, L-355)', async () => {
  const page = await h.newPage({ viewport: { width: 1400, height: 800 } });
  await h.openReader(page, `${h.SITE}/folder-notools/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'server' });   // (the test site's voice)
  await page.evaluate(() => document.querySelector('#setBtn').click());
  await page.click('#setText'); await page.click('#txtRead');
  assert.ok(await h.waitFor(() => page.isVisible('#tts'), 3000));
  assert.ok(await h.waitFor(() => page.evaluate(() => document.activeElement?.id === 'ttsPlay'), 3000), 'on Play');
  assert.ok(await h.waitFor(() => h.spokenWord(page), 20000), 'reading, word by word (round 26 review, T-51)');
  await page.click('#ttsClose');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'page');
});

test('book CSS aimed at the reader\'s paging (--spine-x, @layer, the flow\'s height, html padding, body position, columns or grid, translate and scale, content-visibility) pages as a plain book does (round 27 review, H-36, H-37, M-155; round 28, H-38, H-39: the reader\'s layer name, @property, transitions; round 29, H-44, M-169, L-391: offset-path, html columns, column-span, the body\'s variables)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  const count = async () => Number(/page \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
  await h.openReader(page, `${h.READER}?book=books/hostile-plain.epub`, { 'spine:layout': 'one' });
  const n = await count();
  for (const k of ['varx', 'layer', 'layer2', 'height', 'htmlpad', 'bodypos', 'translate', 'bscale', 'bcols', 'grid', 'cv', 'samelayer', 'sublayer', 'prop', 'trans', 'offset', 'offset2', 'offset3', 'hcols', 'span', 'span3', 'vars', 'vars2']) {
    await h.openReader(page, `${h.READER}?book=books/hostile-${k}.epub`, { 'spine:layout': 'one' });
    assert.equal(await count(), n, `${k}: the page count`);
    for (let i = 1; i < n; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    assert.match(await page.textContent('#spinePos'), new RegExp(`page ${n}/${n}`), k);
    assert.ok(await overhang(page) < 1.5, `${k}: text ${await overhang(page)}px past an edge`);
    assert.equal(await h.inFrame(page, doc => { const r = doc.getElementById('hp239').getBoundingClientRect(); return r.right > 0 && r.left < doc.defaultView.innerWidth && r.top >= 0 && r.bottom <= doc.defaultView.innerHeight + 1; }), true, `${k}: the last paragraph on the last page`);
  }
});

test('a notice without an action of its own can be put away (OK); Read aloud is off for comics; the sample book\'s notice still offers to open a book (round 27 review, M-159)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/manga.cbz`);
  assert.equal(await page.isDisabled('#ttsBtn'), true);
  await page.keyboard.press('r');
  assert.match(await h.noticeLike(page, /no text to read aloud/, 3000), /no text to read aloud/);
  assert.equal((await page.textContent('#noticeAction')).trim(), 'OK');
  await page.click('#noticeAction');
  assert.equal(await page.isHidden('#notice'), true);
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.equal(await page.isDisabled('#ttsBtn'), false);
});

test('on phones 360 and 320 px wide every top-bar button is in sight, Settings, Edit and Open included (round 27 review, M-160)', async () => {
  for (const width of [360, 320]) {
    const page = await h.newPage({ viewport: { width, height: 700 } });
    await h.openReader(page, `${h.READER}?book=books/long.epub`);
    const out = await page.evaluate(() => ['ttsBtn', 'fontBtn', 'themeBtn', 'layoutBtn', 'fsBtn', 'smaller', 'larger', 'setBtn', 'editBtn', 'openBtn']
      .filter(id => { const e = document.getElementById(id); if (!e?.offsetParent) return id === 'setBtn' || id === 'openBtn'; const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < 0; }));
    assert.deepEqual(out, [], `${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'no sideways scrolling');
    await page.close();
  }
});

test('a document right to left by its body\'s style reads right to left; in right-to-left books the ribbon fills from the right, its arrows and the buttons\' names go the pages\' way (round 27 review, L-364, L-367)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/rtl-style.html`);
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.querySelector('[id^="spine-flow"]')).direction), 'rtl');
  await h.openReader(page, `${h.READER}?book=books/rtl-text.epub`, { 'spine:layout': 'one' });
  assert.equal(await page.evaluate(() => document.querySelector('#ribbon').classList.contains('rtl')), true);
  assert.match(await page.getAttribute('#nextBtn', 'title'), /Left arrow/);
  assert.match(await page.getAttribute('#prevBtn', 'title'), /Right arrow/);
  await page.focus('#ribbon'); await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => /spine 2\//.test(document.querySelector('#spinePos').textContent));
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.equal(await page.evaluate(() => document.querySelector('#ribbon').classList.contains('rtl')), false);
  assert.match(await page.getAttribute('#nextBtn', 'title'), /Right arrow/);
});

test('names and focus: the Aa button says what it is, the menu\'s check mark isn\'t read, NAVBAR_ALT names the logo, Escape in the contents with the top bar hidden leaves the focus on the page (round 27 review, L-368)', async () => {
  const page = await h.newPage({ viewport: { width: 400, height: 800 } });
  await h.openReader(page, `${h.SITE}/folder-brand3/index.html?book=/reader/books/long.epub`);
  assert.match(await page.getAttribute('#fontBtn', 'aria-label'), /^Reading font: /);
  assert.equal(await page.getAttribute('#navLogo a', 'aria-label'), 'Example Press');
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('#fontMenu .opt[aria-checked="true"] small'), '::before').content), /\/ ""/);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  await page.keyboard.press('c'); await page.waitForTimeout(300);
  await page.focus('#searchBox'); await page.keyboard.press('Tab');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'page');
});

test('the top bar\'s corner stays off the page scrolled down in the scroll layout, and off its scrollbar; a book\'s body style can\'t hold "!important" in escaped forms (round 27 review, L-369, L-370)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:layout': 'scroll', 'spine:set:SHOW_TOPBAR': false });
  const corner = () => page.evaluate(() => { const c = document.querySelector('#barCorner'); return getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().right; });
  const at = await corner();
  assert.ok(at && at <= 1280 - 16, `at the top, beside the scrollbar: ${at}`);
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = 600; });
  await page.waitForTimeout(200);
  assert.equal(await corner(), false, 'scrolled down: out of the way');
  await h.inFrame(page, doc => { doc.scrollingElement.scrollTop = 0; });
  await page.waitForTimeout(200);
  assert.ok(await corner());
  await h.openReader(page, `${h.READER}?book=books/body-escaped.epub`, { 'spine:layout': 'one' });
  const n = Number(/page \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
  assert.ok(n > 3, `${n} pages`);
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.body).overflow), 'hidden');
});

test('only the rules the pages depend on are the reader\'s beyond a book\'s reach: a book\'s own important colour stays its own in a dark theme, as before (round 28 review, L-376)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/own-colours.epub`, { 'spine:theme': 'dark', 'spine:layout': 'one' });
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.getElementById('red')).color), 'rgb(204, 0, 0)');
  assert.ok(Number(/page \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]) > 3);
});

test('line spacing leaves the bar only below 400 px, and stays when Settings isn\'t shown (round 28 review, L-378)', async () => {
  const shown = async (width, url) => {
    const page = await h.newPage({ viewport: { width, height: 700 } });
    await h.openReader(page, url);
    const v = await page.isVisible('#lineGroup');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${width} px: no sideways scrolling`);
    const r = await page.evaluate(() => document.querySelector('#lineGroup').getBoundingClientRect().right);
    assert.ok(r <= width, `in sight: ${r}`);
    await page.close(); return v;
  };
  assert.equal(await shown(400, `${h.READER}?book=books/long.epub`), true, '400 px');
  assert.equal(await shown(360, `${h.READER}?book=books/long.epub`), false, '360 px');
  assert.equal(await shown(360, `${h.SITE}/folder-noset/index.html?book=/reader/books/long.epub`), true, '360 px, no Settings');
});

test('right-to-left text without the book saying so: the information panel says right to left, the footer\'s chevrons point the pages\' way (round 28 review, L-379)', async () => {
  const page = await h.newPage();
  const flipped = () => page.evaluate(() => getComputedStyle(document.querySelector('#nextBtn svg')).transform !== 'none');
  await h.openReader(page, `${h.READER}?book=books/rtl-text.epub`, { 'spine:layout': 'one' });
  assert.equal(await flipped(), true);
  // (Next on the left, Previous on the right: each points away from the middle: round 29 review, M-177, T-57.)
  const side = () => page.evaluate(() => document.querySelector('#nextBtn').getBoundingClientRect().left < document.querySelector('#prevBtn').getBoundingClientRect().left);
  assert.equal(await side(), true, 'Next on the left');
  assert.match(await page.evaluate(() => document.querySelector('#infoList').textContent), /Right to left/);
  for (const b of ['rtl-doc.md', 'rtl-doc.html']) {   // (and documents, in the scroll layout: round 29 review, L-394)
    await h.openReader(page, `${h.READER}?book=books/${b}`, { 'spine:layout': 'scroll' });
    assert.match(await page.evaluate(() => document.querySelector('#infoList').textContent), /DirectionRight to left/, b);
  }
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:layout': 'one' });
  assert.equal(await flipped(), false);
  assert.equal(await side(), false, 'Next on the right');
  assert.match(await page.evaluate(() => document.querySelector('#infoList').textContent), /Left to right/);
});

test('in the scroll layout the top bar\'s corner, out of the way while reading down, comes back on scrolling up (round 28 review, L-383)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:layout': 'scroll', 'spine:set:SHOW_TOPBAR': false });
  const corner = () => page.evaluate(() => getComputedStyle(document.querySelector('#barCorner')).display !== 'none');
  const to = async y => { await h.inFrame(page, (doc, y) => { doc.scrollingElement.scrollTop = y; }, y); await page.waitForTimeout(200); };
  assert.equal(await corner(), true, 'at the top');
  await to(400); await to(900);
  assert.equal(await corner(), false, 'reading down');
  await to(600);
  assert.equal(await corner(), true, 'scrolled up a little');
  await to(1400);
  assert.equal(await corner(), false, 'down again');
});

test('right to left, a click near the ribbon\'s right end goes to the start, near its left end to the end (round 28 review, T-56)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/rtl-text.epub`, { 'spine:layout': 'one' });
  const box = await page.locator('#ribbon').boundingBox();
  await page.mouse.click(box.x + 3, box.y + box.height / 2);
  await page.waitForFunction(() => /spine 2\//.test(document.querySelector('#spinePos').textContent));
  await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
  await page.waitForFunction(() => /spine 1\//.test(document.querySelector('#spinePos').textContent));
});

test('phones 320 px wide: the bar wraps rather than run past the edge, with Settings hidden too; a 400-character notice is shown whole; a notice closed from the keyboard gives focus back; Text settings says why Read aloud is off (round 29 review, L-392, L-393, L-395, L-397)', async () => {
  for (const url of [`${h.READER}?book=books/long.epub`, `${h.SITE}/folder-noset/index.html?book=/reader/books/long.epub`]) {
    const page = await h.newPage({ viewport: { width: 320, height: 700 } });
    await h.openReader(page, url);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320, `${url}: no sideways scrolling`);
    const out = await page.evaluate(() => ['openBtn', 'editBtn', 'setBtn', 'ttsBtn'].filter(id => { const e = document.getElementById(id); if (!e?.offsetParent) return false; const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < 0; }));
    assert.deepEqual(out, [], url);
    await page.close();
  }
  const page = await h.newPage({ viewport: { width: 360, height: 700 } });
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.goto(`${h.READER}?book=${'a-very-long-missing-file-name-'.repeat(14)}.epub`);
  assert.ok(await h.waitFor(async () => (await h.notice(page) || '').length > 300, 10000), await h.notice(page));
  assert.equal(await page.evaluate(() => { const t = document.querySelector('#noticeText'); return t.scrollHeight <= t.clientHeight + 1; }), true, 'the whole notice in sight');
  await page.focus('#noticeAction'); await page.keyboard.press('Enter');
  assert.notEqual(await page.evaluate(() => document.activeElement?.localName), 'body');
  await h.openReader(page, `${h.READER}?book=books/manga.cbz`);
  assert.match(await page.textContent('#txtReadNote'), /Not available: a comic/);
});
