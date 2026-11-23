// Round 40 review: hostile files that froze or crashed the tab (H-59, H-60, M-216), marked's notice (L-461), Refresh
// on the default book shown after a failed address (L-460), and a book on another site read in place (D-44).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const frameText = page => h.inFrame(page, doc => doc.body.textContent);
// A function of the reader's, taken from index.html, to try on its own.
const readerFn = (start, name) => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const i = src.indexOf(start), j = src.indexOf('\n}\n', i) + 3;
  return new Function(src.slice(i, j) + `; return ${name};`)();
};

test('a Markdown list item followed by 100,000 lines without a blank one opens in good time (round 40 review, H-59)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/long-list.md`);
  assert.ok(Date.now() - t0 < 12000, `took ${Date.now() - t0} ms`);
  assert.equal(await h.title(page), 'Long list');
  // (A document this long is shown in parts: the first holds the list.)
  assert.ok(await h.waitFor(async () => /^\s*Long list\s*a\s+b\s+b/.test(await frameText(page)), 10000), 'the list');
});

test('an SVG <use> fan-out inline, as a data: picture, in a style and as the cover opens, without its copies (round 40 review, H-60)', async () => {
  for (const [book, title, after] of [['use-fanout.html', 'Fan-out', 'After the picture'], ['use-data.html', 'Fan-out data', 'After the data picture'],
    ['svg-cover-fanout.epub', 'SVG Cover Fan-out', 'fan-out cover']]) {
    const page = await h.newPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(Date.now() - t0 < 15000, `${book}: took ${Date.now() - t0} ms`);
    assert.equal(await h.title(page), title);
    assert.ok(await h.waitFor(async () => new RegExp(after).test(await frameText(page)), 10000), book);
    assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 0, `${book}: no <use> left inline`);
    if (book === 'use-data.html') {
      // The data: pictures were cleaned into pictures of their own: the harmless one kept, the fan-out without <use>.
      const srcs = await h.inFrame(page, doc => [...doc.images].map(i => i.getAttribute('src') || ''));
      assert.ok(srcs.every(s => !s.startsWith('data:image/svg')), srcs.join(' '));
      assert.ok(await h.inFrame(page, doc => doc.images[1].complete && doc.images[1].naturalWidth > 0), 'the harmless data: SVG still shows');
    }
    // The page still answers.
    assert.equal(await page.evaluate(() => 1 + 1), 2);
    await page.close();
  }
});

test('a picture of 20,000 by 20,000 pixels, as the cover and in a page, is left out without crashing the tab (round 40 review, M-216)', async () => {
  const page = await h.newPage();
  const warned = [];
  page.on('console', m => { if (/too large to show/.test(m.text())) warned.push(m.text()); });
  await h.openReader(page, `${h.READER}?book=books/huge-picture.epub`);
  assert.equal(await h.title(page), 'Huge Picture');
  assert.ok(await h.waitFor(async () => /After the huge picture/.test(await frameText(page)), 10000));
  await page.waitForTimeout(1500);   // (time for the tab icon from the cover, which decoded it before)
  assert.equal(await page.evaluate(() => 1 + 1), 2, 'the tab still answers');
  const imgs = await h.inFrame(page, doc => [...doc.images].map(i => [i.alt, !!i.getAttribute('src')]));
  assert.deepEqual(imgs, [['huge', false], ['fine', true]]);
  assert.ok(warned.some(w => /20000 × 20000/.test(w)), warned.join(' | '));
});

test('Markdown nested too deeply says so, without marked\'s "Please report this" (round 40 review, L-461)', async () => {
  const page = await h.newPage();
  await page.goto(`${h.READER}?book=books/deep-nest.md`);
  const n = await h.noticeLike(page, /nested too deeply/, 20000);
  assert.match(n, /nested too deeply/);
  assert.doesNotMatch(n, /Please report|github\.com\/markedjs/);
});

test('Refresh on the default book shown after an address that failed asks for the default (round 40 review, L-460)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-a/?book=typo.epub`);
  assert.equal(await h.title(page), 'Folder A Book');
  const asked = [];
  page.on('request', r => asked.push(r.url()));
  await page.click('#refreshBtn');
  await h.waitForBook(page);
  await page.waitForTimeout(500);
  assert.equal(await h.title(page), 'Folder A Book');
  assert.ok(!asked.some(u => /typo\.epub/.test(u)), asked.join(' '));
  assert.ok(asked.some(u => /folder-a\/default\.epub/.test(u)), asked.join(' '));
});

test('an EPUB on another site is downloaded whole, even where that site shows its ranges (round 40 review, D-44)', async () => {
  const page = await h.newPage();
  const ranged = [];
  page.on('request', r => { if (r.url().startsWith(h.SOFT) && r.headers().range) ranged.push(`${r.url()} ${r.headers().range}`); });
  await h.openReader(page, `${h.PLAIN}/reader/index.html?get=${encodeURIComponent(`${h.SOFT}/reader/books/long.epub?expose=1`)}`);
  assert.ok((await h.title(page)).length > 0);
  assert.deepEqual(ranged, [], 'no range requests to the other site');
});

// Round 41: the round 40 fixes' bypasses and regressions.
test('Markdown lists in block quotes, and after a line taken for a fence, open in good time (round 41)', async () => {
  for (const [book, title] of [['quote-list.md', 'Quoted list'], ['fence-trick.md', 'Fence trick']]) {
    const page = await h.newPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(Date.now() - t0 < 12000, `${book}: took ${Date.now() - t0} ms`);
    assert.equal(await h.title(page), title);
    // (A real fence is still one: the pre-pass leaves a code block of fewer lines whole.)
    const mdUnstick = readerFn('const MD_ITEM_LINES', 'mdUnstick');
    const md = '- a\n```\n' + 'x\n'.repeat(1500) + '```\n' + 'b\n'.repeat(1500), u = mdUnstick(md);
    assert.deepEqual([u.added.length, u.text.split('\n').slice(2, 1502).every(l => l === 'x')], [1, true]);
    await page.close();
  }
});

test('a page using a sprite\'s big group many times opens without the copies; small icons used many times stay (round 41)', async () => {
  let page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/sprite-fanout.epub`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => /After the sprites/.test(await frameText(page)), 10000));
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 0);
  await page.close();
  page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/sprite-icons.epub`);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 50, 'the icons kept');
  await page.close();
  page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/many-glyphs.html`);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 54000, 'MathJax-like glyph uses kept');
});

test('a data: SVG with a space before its type is cleaned too; one with a % shows (round 41)', async () => {
  let page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/data-space.html`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => /After the spaced picture/.test(await frameText(page)), 10000));
  assert.ok((await h.inFrame(page, doc => [...doc.images].map(i => i.getAttribute('src') || ''))).every(s => !/^data:/i.test(s)));
  await page.close();
  page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/data-percent.html`);
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => doc.images[0].complete && doc.images[0].naturalWidth === 10), 10000), 'the picture with a % shows');
});

test('huge pictures as data: in a page and in an SVG, typed oddly, unlisted, or a GIF frame larger than its screen, are left out (round 41)', async () => {
  for (const book of ['data-huge.html', 'huge-other.epub']) {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(await h.waitFor(async () => /After the (data|huge) picture/.test(await frameText(page)), 10000), book);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => 1 + 1), 2, `${book}: the tab still answers`);
    const imgs = await h.inFrame(page, doc => [...doc.images].map(i => [i.alt, !!i.getAttribute('src')]));
    for (const [alt, has] of imgs) assert.equal(has, alt === 'fine' || alt === 'svg', `${book}: ${alt}`);
    if (book === 'huge-other.epub') assert.equal(await h.inFrame(page, doc => doc.images[2].naturalWidth), 10, 'the SVG still shows, its huge picture taken out');
    await page.close();
  }
  // An OS/2 BMP's 16-bit sizes, and a GIF's frame, read right.
  const pictureSize = readerFn('function pictureSize(b){', 'pictureSize');
  assert.deepEqual((() => {
    const bmp = new Uint8Array(26); bmp.set([0x42, 0x4d]); new DataView(bmp.buffer).setUint32(14, 12, true); new DataView(bmp.buffer).setUint16(18, 100, true); new DataView(bmp.buffer).setUint16(20, 50, true);
    const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 0x20, 0x4e, 0x20, 0x4e, 0, 2, 2, 0x4c, 1, 0, 0x3b]);
    return [pictureSize(bmp), pictureSize(gif)];
  })(), [[100, 50], [20000, 20000]]);
});
