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
  // With the title hidden, the search box lines up with the top of the page.
  const tops = await page.evaluate(() => [document.querySelector('#toc .search').getBoundingClientRect().top, document.querySelector('#page').getBoundingClientRect().top]);
  assert.ok(Math.abs(tops[0] - tops[1]) <= 1, `search ${tops[0]}, page ${tops[1]}`);
});
