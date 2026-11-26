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

// (Markdown marked would take too long over is shown as plain text once the worker's check runs out: round 42; the
// check given 2 s here.)

// (No nesting: nothing inside a mask, clip path, marker or pattern has an effect, as the browser computed it: round 48.)
const NESTED = doc => [...doc.querySelectorAll('mask *, clipPath *, marker *, pattern *')].filter(el => {
  const cs = getComputedStyle(el);
  return [cs.maskImage, cs.webkitMaskImage, cs.clipPath, cs.markerStart, cs.markerMid, cs.markerEnd].some(v => v && v !== 'none') || (!el.closest('mask') && cs.filter !== 'none');
}).length;
async function mdPage() { const p = await h.newPage(); await p.addInitScript(() => { window.SPINE_TEST = { mdProbeMs: 2000 }; }); return p; }
const SLOW_NOTE = /shown as plain text: its Markdown would take too long to lay out/;
test('Markdown marked would take minutes over opens in good time as plain text, with a note (round 40 review, H-59; round 42, H-66, H-67)', async () => {
  // (long-emphasis.md, read in time but too many pieces to lay out, is a block shown as its text on its own now, without
  // the note: round 45.)
  for (const book of ['long-list.md', 'quote-list.md', 'fence-trick.md', 'item-html.md']) {
    const page = await mdPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(Date.now() - t0 < 15000, `${book}: took ${Date.now() - t0} ms`);
    assert.ok(await h.waitFor(async () => SLOW_NOTE.test(await frameText(page)), 10000), `${book}: the note`);
    assert.equal(await page.evaluate(() => 1 + 1), 2);
    await page.close();
  }
  {
    const page = await mdPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/long-emphasis.md`);
    assert.ok(Date.now() - t0 < 15000, `long-emphasis.md: took ${Date.now() - t0} ms`);
    assert.ok(await h.waitFor(async () => (await frameText(page)).length > 1000, 10000), 'long-emphasis.md: shown');
    assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('em').length < 100), 'long-emphasis.md: its long block as text');
    await page.close();
  }
  // A large ordinary document stays Markdown.
  const page = await mdPage();
  await h.openReader(page, `${h.READER}?book=books/big-normal.md`);
  assert.doesNotMatch(await frameText(page), SLOW_NOTE);
  assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('h2').length) > 0, 'its headings');
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

// Round 42.
test('<use> by an encoded fragment, of a whole file, and on a page nested deep are counted as the browser resolves them (round 42 review, H-64, H-65, L-474)', async () => {
  for (const [book, after] of [['use-pct.html', 'After the encoded picture'], ['use-whole.epub', 'After the whole files']]) {
    const page = await h.newPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(Date.now() - t0 < 15000, `${book}: took ${Date.now() - t0} ms`);
    assert.ok(await h.waitFor(async () => new RegExp(after).test(await frameText(page)), 10000), book);
    assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 0, `${book}: its uses dropped`);
    await page.close();
  }
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/deep-use.html`);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 1, 'a harmless use deep in the page kept');
});

test('huge pictures as data: of any type, and files typed or named as sound, are left out (round 42 review, M-225, M-228)', async () => {
  for (const [book, after] of [['data-odd.html', 'After the odd pictures'], ['huge-typed.epub', 'After the typed pictures']]) {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(await h.waitFor(async () => new RegExp(after).test(await frameText(page)), 10000), book);
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => 1 + 1), 2, `${book}: the tab still answers`);
    const imgs = await h.inFrame(page, doc => [...doc.images].map(i => [i.alt, !!i.getAttribute('src')]));
    for (const [alt, has] of imgs) assert.equal(has, alt === 'fine', `${book}: ${alt}`);
    await page.close();
  }
});

test('a data: address is read as the browser reads it, and only its first bytes for a picture\'s size, quickly (round 42 review, M-225 to M-227)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const i = src.indexOf('const DATA_RE'), j = src.indexOf('\n}\n', src.indexOf('function dataBytes')) + 3;
  const dataBytes = new Function(src.slice(i, j) + '; return dataBytes;')();
  const png = Buffer.from(require('node:fs').readFileSync(require('node:path').join(__dirname, 'site', 'reader', 'books', 'huge-picture.epub'))).length;
  assert.ok(png > 0);
  const b64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
  assert.deepEqual([...dataBytes(`data:image/png;base64,${b64}`).bytes], [0x89, 0x50, 0x4e, 0x47]);
  // (";base64" not last: percent-decoded, as the browser does.)
  assert.equal(dataBytes('data:image/png;base64;x=y,%89PNG').bytes[0], 0x89);
  assert.equal(dataBytes('data:image/png;base64x,%89PNG').bytes[0], 0x89);
  assert.equal(dataBytes('data: image/svg+xml,a%b').type, 'image/svg+xml');
  assert.equal(new TextDecoder().decode(dataBytes('data:,100%25 and 100%').bytes), '100% and 100%');
  // 9 MB of percent-encoded text: only the header decoded.
  const long = 'data:image/png,' + '%89PNG' + 'x'.repeat(9 << 20);
  const t0 = Date.now(), d = dataBytes(long, 1 << 19);
  assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0} ms`);
  assert.equal(d.bytes.length, 1 << 19);
});

// Round 43.
test('Markdown shown as plain text is edited in Raw only, its text never rewritten from the plain view; the editor starts no checks of its own (round 43 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  // (A check given 1 ms: as on a slow machine, the large ordinary document falls back.)
  await page.addInitScript(() => {
    window.SPINE_TEST = { mdProbeMs: 1 };
    const W = window.Worker; window.workersMade = 0;
    window.Worker = function (...a) { window.workersMade++; return new W(...a); };
  });
  await h.openReader(page, `${h.READER}?book=books/big-normal.md`, { 'spine:editMode': 'wysiwyg', 'spine:editSplit': true });
  assert.ok(await h.waitFor(async () => SLOW_NOTE.test(await frameText(page)), 10000));
  await page.click('#editBtn'); await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  await page.waitForFunction(() => document.querySelector('[data-mode="raw"]').getAttribute('aria-pressed') === 'true', null, { timeout: 10000 });
  assert.equal(await page.evaluate(() => document.querySelector('[data-mode="wysiwyg"]').disabled), true, 'WYSIWYG not offered');
  const before = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  assert.match(before, /^# Big normal\n\n## Part 0/);
  const made = await page.evaluate(() => window.workersMade);
  // Scrolling the source many times starts no more checks.
  for (let i = 0; i < 15; i++) { await page.mouse.move(1000, 400); await page.mouse.wheel(0, 300); await page.waitForTimeout(50); }
  assert.ok(await page.evaluate(() => window.workersMade) - made <= 1, 'no check per scroll');
  assert.doesNotMatch(await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue()), /shown as plain text|\\#/);
});

test('a worker error counts as a failure: Markdown nested past its stack, then slow, is shown as plain text (round 43 review)', async () => {
  const page = await mdPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/deep-then-list.md`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => SLOW_NOTE.test(await frameText(page)), 10000));
});

test('a few broken <use> references leave the working ones; a <use> by about:srcdoc is dropped (round 43 review)', async () => {
  let page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/use-broken.html`);
  assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('use[href="#star"]').length) === 400, 'the working icons kept');
  await page.close();
  page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.SITE}/folder-remote/?book=srcdoc-use.html`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.equal(await h.inFrame(page, doc => [...doc.querySelectorAll('use')].filter(u => /about:/.test(u.getAttribute('href') || '')).length), 0);
});

test('a JPEG with stray bytes before its size, or its size past 512 KB, is left out (round 43 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/jpeg-tricks.epub`);
  assert.ok(await h.waitFor(async () => /After the JPEGs/.test(await frameText(page)), 10000));
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => 1 + 1), 2, 'the tab still answers');
  assert.deepEqual(await h.inFrame(page, doc => [...doc.images].map(i => [i.alt, !!i.getAttribute('src')])), [['junk', false], ['far', false], ['fine', true]]);
});

test('breaks in long plain-text words never split a character (round 43 review, M-231)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long-cjk.txt`);
  const t = await frameText(page);
  assert.equal((t.match(/𠮷/gu) || []).length, 8);
  assert.doesNotMatch(t, /�/);
});

// Round 44.
test('a slow list inside a footnote is caught by the worker, which reads footnotes as the page does (round 43 review, H-71)', async () => {
  const page = await mdPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/fn-slow.md`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => SLOW_NOTE.test(await frameText(page)), 10000));
});

test('long Markdown is drawn from the worker\'s reading, footnotes, math and emoji as before, without reading it again on the page (round 43 review, M-233)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => {
    // (Count marked's lexer runs on the page: none for a long document now.)
    window.pageLexes = 0;
    const hook = () => { if (!window.marked?.Lexer || window.marked.Lexer.__counted) return; const lex = window.marked.Lexer.prototype.lex; window.marked.Lexer.prototype.lex = function (...a) { if (a[0]?.length > 20000) window.pageLexes++; return lex.apply(this, a); }; window.marked.Lexer.__counted = true; };
    setInterval(hook, 5);
  });
  await h.openReader(page, `${h.READER}?book=books/long-extras.md`);
  assert.doesNotMatch(await frameText(page), SLOW_NOTE);
  const got = await h.inFrame(page, doc => [doc.querySelectorAll('sup.md-fnref').length, !!doc.querySelector('section.md-footnotes li'), doc.querySelectorAll('math').length > 0, doc.querySelectorAll('h2').length > 0]);
  assert.deepEqual(got.slice(1), [true, true, true], JSON.stringify(got));
  assert.ok(got[0] > 0, 'note references');
  assert.equal(await page.evaluate(() => window.pageLexes), 0, 'not read again on the page');
});

test('markers and masks that would draw too much are dropped, inline and in pictures; a plain marker stays (round 43 review, H-70; rounds 45, 46)', async () => {
  let page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/nested-effects.html`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => /After the effects/.test(await frameText(page)), 10000));
  assert.equal(await h.inFrame(page, doc => doc.querySelector('line[marker-end]')?.getAttribute('marker-end')), 'url(#arrow)', 'the plain arrow kept');
  // (Nothing nested: round 48.)
  assert.equal(await h.inFrame(page, NESTED), 0, 'nothing inside a marker or mask has an effect');
  await page.close();
  page = await h.newPage();
  const t1 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/nested-effects.epub`);
  assert.ok(await h.waitFor(async () => /After the effect pictures/.test(await frameText(page)), 15000));
  assert.ok(Date.now() - t1 < 20000, `took ${Date.now() - t1} ms`);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => 1 + 1), 2, 'the tab still answers');
});

// Round 45.
test('long Markdown with notes defined in a list item, a quote, or another note opens with every note (round 45 review)', async () => {
  const page = await mdPage();
  await h.openReader(page, `${h.READER}?book=books/fn-list-long.md`);
  assert.ok(await h.waitFor(async () => /The inner note/.test(await frameText(page)), 15000), 'opened, with the inner note');
  const text = await frameText(page);
  for (const t of ['The list note', 'The quote note', 'The outer note']) assert.match(text, new RegExp(t));
  assert.doesNotMatch(text, SLOW_NOTE);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('section.md-footnotes li').length), 4);
});

test('30,000 notes open in good time (round 45 review)', async () => {
  const page = await mdPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/notes-30k.md`);
  assert.ok(await h.waitFor(async () => (await h.inFrame(page, doc => doc.querySelectorAll('sup.md-fnref').length)) > 0, 20000), 'drawn with its notes');
  assert.ok(Date.now() - t0 < 20000, `took ${Date.now() - t0} ms`);
  assert.deepEqual(await h.inFrame(page, doc => [...doc.querySelectorAll('sup.md-fnref')].slice(0, 3).map(s => s.textContent)), ['1', '2', '3']);
});

test('a paragraph or table cell past the piece limit is shown as plain text on its own; the rest keeps its formatting (round 45 review)', async () => {
  for (const [book, keep] of [['table-cell.md', 'After the table'], ['one-slow-block.md', 'After,']]) {
    const page = await mdPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(await h.waitFor(async () => new RegExp(keep).test(await frameText(page)), 15000), `${book}: opened`);
    assert.ok(Date.now() - t0 < 20000, `${book}: took ${Date.now() - t0} ms`);
    const text = await frameText(page);
    assert.doesNotMatch(text, SLOW_NOTE, book);
    assert.match(text, /\*x\* \*x\*/, `${book}: the long block as its text`);
    assert.ok(await h.inFrame(page, doc => !!doc.querySelector('strong') && doc.querySelectorAll('em').length < 5), `${book}: the rest formatted, the long block not`);
    await page.close();
  }
});

test('emoji in long Markdown show although their names load slowly, and the editor keeps the shortcodes (round 45 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { window.SPINE_TEST = { mdProbeMs: 4000 }; });
  await page.route('**/libs/emoji.json', async r => { await new Promise(res => setTimeout(res, 2500)); r.continue(); });
  await h.openReader(page, `${h.READER}?book=books/long-extras.md`, { 'spine:editMode': 'raw', 'spine:editSplit': true });
  assert.ok(await h.waitFor(async () => /\u{1F604}/u.test(await frameText(page)), 15000), 'emoji shown');
  await page.click('#editBtn'); await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  await page.click('[data-mode="wysiwyg"]');
  await page.waitForTimeout(1500);
  await page.click('[data-mode="raw"]');
  await page.waitForTimeout(500);
  const src = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  assert.match(src, /:smile:/);
  assert.doesNotMatch(src, /\\:smile:/);
});

test('arrowheads in style attributes and style sheets are kept, inline and in pictures (round 45 review)', async () => {
  let page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/arrows.html`);
  assert.ok(await h.waitFor(async () => /After the arrows/.test(await frameText(page)), 10000));
  const ends = await h.inFrame(page, doc => [...doc.querySelectorAll('svg > path[style], line')].map(el => getComputedStyle(el).markerEnd));
  assert.equal(ends.length, 3);
  for (const e of ends) assert.match(e, /url\(/, JSON.stringify(ends));
  await page.close();
  page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/arrows.epub`);
  assert.ok(await h.waitFor(async () => /After the arrow pictures/.test(await frameText(page)), 15000));
  const srcs = await h.inFrame(page, doc => [...doc.querySelectorAll('img')].map(i => i.src));
  for (const u of srcs) assert.match(await page.evaluate(async u => (await fetch(u)).text(), u), /marker-end/, u);
});

test('masks and clip paths one level deep are kept: Sketch\'s, a clip of a clipped shape, a mask holding a filter (round 45 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/effects-kept.html`);
  assert.ok(await h.waitFor(async () => /After the kept effects/.test(await frameText(page)), 10000));
  const got = await h.inFrame(page, doc => [getComputedStyle(doc.querySelector('g')).maskImage, getComputedStyle(doc.querySelector('rect[clip-path]')).clipPath, getComputedStyle(doc.querySelector('rect[mask]')).maskImage, getComputedStyle(doc.querySelector('mask rect')).filter]);
  for (const v of got) assert.match(v, /url\(/, JSON.stringify(got));
});

test('masks nested deep by -webkit-mask, mask-image, escapes, custom properties, sheet classes or animations are capped (round 45 review)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/effect-tricks.html`);
  assert.ok(await h.waitFor(async () => /After the tricks/.test(await frameText(page)), 15000));
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  // (Nothing nested, by whatever channel: round 48.)
  assert.equal(await h.inFrame(page, NESTED), 0);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('set').length), 0, 'the animation that sets a mask removed');
});

// Round 46.
// (Painted, not only laid out: a screenshot waits for the frame to be drawn.)
async function paintMs(page) { const t = Date.now(); await page.screenshot(); return Date.now() - t; }
test('masks nested by var() fallbacks, @scope, imports, selectors on what the reader adds, or ids cleaned later, and costs no depth bounds, are capped; painted in good time (round 46 review, H-78 to H-83)', async () => {
  for (const k of ['varfb', 'scope', 'import', 'mark', 'alias', 'marker-fan', 'mask-fan']) {
    const page = await h.newPage({ viewport: { width: 1000, height: 700 } });
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/bypass-${k}.html`);
    assert.ok(await h.waitFor(async () => /After the bypass/.test(await frameText(page)), 15000), `${k}: opened`);
    const ms = await paintMs(page);
    assert.ok(ms < 5000, `${k}: painted in ${ms} ms`);
    assert.ok(Date.now() - t0 < 25000, `${k}: took ${Date.now() - t0} ms`);
    assert.equal(await h.inFrame(page, NESTED), 0, `${k}: nothing nested`);
    await page.close();
  }
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/bypass-pictures.epub`);
  assert.ok(await h.waitFor(async () => /After the bypass pictures/.test(await frameText(page)), 15000));
  const srcs = await h.inFrame(page, doc => [...doc.querySelectorAll('img')].map(i => i.src));
  assert.equal(srcs.length, 2);
  for (const u of srcs) {
    const svg = await page.evaluate(async u => (await fetch(u)).text(), u);
    // (Nothing inside a mask keeps an effect: round 48.)
    const loose = await page.evaluate(t => [...new DOMParser().parseFromString(t, 'image/svg+xml').querySelectorAll('mask *')].filter(e => !/mask: none !important/.test(e.getAttribute('style') || '')).length, svg);
    assert.equal(loose, 0, u);
  }
  assert.ok((await paintMs(page)) < 5000, 'pictures painted in good time');
});

test('references to their own target, keyframes, nested rules, start and end markers in a sheet and custom properties on the root keep every effect (round 46 review, H-84)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/effects-everyday.html`);
  assert.ok(await h.waitFor(async () => /After the everyday effects/.test(await frameText(page)), 10000));
  const got = await h.inFrame(page, doc => {
    const cs = sel => getComputedStyle(doc.querySelector(sel));
    return { start: cs('line.both').markerStart, end: cs('line.both').markerEnd, clip: cs('rect.pulse').clipPath, g: doc.querySelector('g[marker-end]')?.getAttribute('marker-end'), y: cs('rect.y').fill };
  });
  for (const [k, v] of Object.entries(got)) assert.match(String(v), /url\(|lg/, `${k}: ${JSON.stringify(got)}`);
});

test('40,000 line breaks in a Markdown paragraph open in good time, the paragraph as its text (round 46 review, H-85)', async () => {
  const page = await mdPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/many-breaks.md`);
  assert.ok(await h.waitFor(async () => /a<br>a<br>/.test(await frameText(page)), 15000), 'opened, the breaks as text');
  assert.ok(Date.now() - t0 < 20000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('br').length < 100), 'no breaks drawn');
  assert.ok((await paintMs(page)) < 5000);
});

test('Markdown with a block shown as its text is edited in Raw only, its source never rewritten; switching reads it no more (round 46 review, M-240, L-480)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.SPINE_TEST = { mdProbeMs: 4000 };
    const W = window.Worker; window.workersMade = 0;
    window.Worker = function (...a) { window.workersMade++; return new W(...a); };
  });
  await h.openReader(page, `${h.READER}?book=books/one-slow-block.md`, { 'spine:editMode': 'wysiwyg', 'spine:editSplit': true });
  assert.ok(await h.waitFor(async () => /After, emphasis stays/.test(await frameText(page)), 15000));
  await page.click('#editBtn'); await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  await page.waitForFunction(() => document.querySelector('[data-mode="raw"]').getAttribute('aria-pressed') === 'true', null, { timeout: 10000 });
  assert.equal(await page.evaluate(() => document.querySelector('[data-mode="wysiwyg"]').disabled), true, 'WYSIWYG not offered');
  const src = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  assert.doesNotMatch(src, /\\\*/);
  // (big-normal.md: switching modes reads it no more.)
  const p2 = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await p2.addInitScript(() => {
    window.SPINE_TEST = { mdProbeMs: 4000 };
    const W = window.Worker; window.workersMade = 0;
    window.Worker = function (...a) { window.workersMade++; return new W(...a); };
  });
  await h.openReader(p2, `${h.READER}?book=books/big-normal.md`, { 'spine:editMode': 'raw', 'spine:editSplit': true });
  assert.ok(await h.waitFor(async () => /Part 0/.test(await frameText(p2)), 15000));
  await p2.click('#editBtn'); await p2.click('#editThis');
  await p2.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  const before = await p2.evaluate(() => window.workersMade);
  for (const m of ['wysiwyg', 'raw', 'wysiwyg', 'raw']) { await p2.click(`[data-mode="${m}"]`); await p2.waitForTimeout(800); }
  assert.ok(await p2.evaluate(() => window.workersMade) - before <= 2, `reads: ${await p2.evaluate(() => window.workersMade) - before}`);
});

// Round 47.
test('<use> copies of a heavy marker, vertices of "z", a mask nested in another\'s element and many large filters are capped; painted in good time (round 47 review, H-86 to H-88, H-90)', async () => {
  for (const k of ['use', 'zz', 'nested', 'blur']) {
    const page = await h.newPage({ viewport: { width: 1000, height: 700 } });
    const warns = []; page.on('console', m => { if (/draw too much|aren't shown/.test(m.text())) warns.push(m.text()); });
    await h.openReader(page, `${h.READER}?book=books/draws-${k}.html`);
    assert.ok(await h.waitFor(async () => /After the drawing/.test(await frameText(page)), 20000), `${k}: opened`);
    const ms = await paintMs(page);
    assert.ok(ms < 8000, `${k}: painted in ${ms} ms`);
    // (A mask nested in another's element is simply not nested now: round 48.)
    if (k === 'nested') assert.equal(await h.inFrame(page, NESTED), 0, 'nothing nested');
    else assert.ok(warns.length, `${k}: something dropped`);
    await page.close();
  }
});

test('a heavy picture shown 40 times is charged each time; 21,000 clip paths used once each are all kept (round 47 review, H-89, M-242)', async () => {
  let page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/heavy-pictures.epub`);
  assert.ok(await h.waitFor(async () => /After the heavy pictures/.test(await frameText(page)), 15000));
  const shown = await h.inFrame(page, doc => [...doc.querySelectorAll('img')].filter(i => i.getAttribute('src')).length);
  assert.ok(shown >= 1 && shown < 40, `shown: ${shown}`);
  assert.ok((await paintMs(page)) < 8000);
  await page.close();
  page = await h.newPage();
  const warns = []; page.on('console', m => { if (/draw too much|aren't shown/.test(m.text())) warns.push(m.text()); });
  await h.openReader(page, `${h.READER}?book=books/many-clips.html`);
  assert.ok(await h.waitFor(async () => /After the clips/.test(await frameText(page)), 30000));
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('rect[clip-path]').length), 21000);
  assert.deepEqual(warns, []);
});

test('20,000 small rules before the text open on the text, not a blank part (round 47 review, M-245)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/many-rules.html`);
  assert.ok(await h.waitFor(async () => /After the rules/.test(await frameText(page)), 15000));
});

test('</br>, breaks in an HTML block, and backslash breaks in a short document are capped (round 47 review, H-91, H-92, M-244)', async () => {
  for (const book of ['end-breaks.md', 'block-breaks.md', 'short-breaks.md']) {
    const page = await mdPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(await h.waitFor(async () => (await frameText(page)).length > 1000, 15000), `${book}: opened`);
    assert.ok(Date.now() - t0 < 20000, `${book}: took ${Date.now() - t0} ms`);
    assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('br').length < 100), `${book}: no breaks drawn`);
    assert.ok((await paintMs(page)) < 5000, book);
    await page.close();
  }
});

test('Raw-only Markdown is offered WYSIWYG again once its block is fixed in Raw (round 47 review, L-484)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { window.SPINE_TEST = { mdProbeMs: 4000 }; });
  await h.openReader(page, `${h.READER}?book=books/one-slow-block.md`, { 'spine:editMode': 'raw', 'spine:editSplit': true });
  assert.ok(await h.waitFor(async () => /After, emphasis stays/.test(await frameText(page)), 15000));
  await page.click('#editBtn'); await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  await page.waitForFunction(() => document.querySelector('[data-mode="wysiwyg"]').disabled, null, { timeout: 10000 });
  await page.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(cm.getValue().replace(/(\*x\* )+/g, 'short ')); });
  await page.waitForFunction(() => !document.querySelector('[data-mode="wysiwyg"]').disabled, null, { timeout: 15000 });
});

// Round 48.
test('the Markdown worker\'s source, made from a template string, compiles with its escapes intact (rounds 45 to 47 lost \\s, \\n and \\b)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const a = src.indexOf('new Blob([await r.text(), `') + 'new Blob([await r.text(), '.length, b = src.indexOf("`], { type: 'text/javascript' }", a);
  const out = new Function('MD_BLOCK_PIECES', 'MD_BLOCK_BREAKS', 'mdParaStart', 'mdInlineMath', 'mdTokenizers', 'return ' + src.slice(a, b + 1))(20000, 500, function mdParaStart(){}, function mdInlineMath(){}, function mdTokenizers(){});
  assert.doesNotThrow(() => new Function(out), 'compiles');
  assert.doesNotMatch(out, /[\x00-\x08\x0b\x0c\x0e-\x1f]/, 'no control characters');
  for (const s of ['/^<\\/?w?br\\b/i', '[^\\s]{200,}', '\\p{M}', "'</p>'"]) assert.ok(out.includes(s), s);
});

test('effects through custom properties, @scope, a repeated filter, feMorphology, CSS blur and backdrop-filter are capped as the browser computes them; painted in good time (round 48 review, H-95 to H-98)', async () => {
  for (const k of ['var', 'scope', 'repeat', 'morph', 'cssblur', 'backdrop']) {
    const page = await h.newPage({ viewport: { width: 1000, height: 700 } });
    const warns = []; page.on('console', m => { if (/aren't shown/.test(m.text())) warns.push(m.text()); });
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/fx48-${k}.html`);
    assert.ok(await h.waitFor(async () => /After the effects/.test(await frameText(page)), 20000), `${k}: opened`);
    const ms = await paintMs(page);
    assert.ok(ms < 8000, `${k}: painted in ${ms} ms`);
    assert.ok(Date.now() - t0 < 30000, `${k}: took ${Date.now() - t0} ms`);
    assert.ok(warns.length, `${k}: effects set off`);
    await page.close();
  }
});

test('another file\'s filter is set off; a heavy picture as a sheet background on 40 sizes is charged per element (round 48 review, H-93, H-94)', async () => {
  let page = await h.newPage({ viewport: { width: 1000, height: 700 } });
  await h.openReader(page, `${h.READER}?book=books/fx48-file.epub`);
  assert.ok(await h.waitFor(async () => /After the file effects/.test(await frameText(page)), 20000));
  assert.ok((await paintMs(page)) < 8000, 'file filter painted in good time');
  assert.equal(await h.inFrame(page, doc => [...doc.querySelectorAll('.f')].filter(e => getComputedStyle(e).filter !== 'none').length), 0, 'no filter from another file');
  await page.close();
  page = await h.newPage({ viewport: { width: 1000, height: 700 } });
  await h.openReader(page, `${h.READER}?book=books/fx48-backgrounds.epub`);
  assert.ok(await h.waitFor(async () => /After the backgrounds/.test(await frameText(page)), 15000));
  assert.ok((await paintMs(page)) < 8000, 'backgrounds painted in good time');
  const shown = await h.inFrame(page, doc => [...doc.querySelectorAll('.h')].filter(e => getComputedStyle(e).backgroundImage !== 'none').length);
  assert.ok(shown < 40, `backgrounds shown: ${shown}`);
});

test('everyday effects are kept: drop shadows on 200 small circles by attribute and by class, an arrowhead beside a <use> loop (round 48 review, M-247, L-485)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/fx48-kept.html`);
  assert.ok(await h.waitFor(async () => /After the kept effects/.test(await frameText(page)), 10000));
  const got = await h.inFrame(page, doc => [[...doc.querySelectorAll('circle')].filter(c => getComputedStyle(c).filter !== 'none').length, getComputedStyle(doc.querySelector('line.m')).markerEnd]);
  assert.equal(got[0], 400, 'every shadow kept');
  assert.match(got[1], /url\(/, 'the arrowhead kept');
});

test('HTML blocks in Markdown render (a table, a <div> of paragraphs, a comment, an SVG); a long paragraph shown as text and 60,000 <wbr> open in good time (round 48 review, H-99, M-248, M-249)', async () => {
  let page = await mdPage();
  await h.openReader(page, `${h.READER}?book=books/html-blocks.md`);
  assert.ok(await h.waitFor(async () => (await h.inFrame(page, doc => doc.querySelectorAll('td').length)) > 0, 20000), 'opened');
  const got = await h.inFrame(page, doc => [doc.querySelectorAll('td').length, doc.querySelectorAll('br').length, /<tr>|<!--/.test(doc.body.textContent)]);
  assert.deepEqual(got, [12000, 600, false]);
  await page.close();
  for (const [book, text] of [['long-fallback.md', /abcdefghijklmnopq<br>/], ['many-wbr.md', /abc/]]) {
    page = await mdPage();
    const t0 = Date.now();
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    assert.ok(await h.waitFor(async () => text.test(await frameText(page)), 20000), `${book}: opened`);
    const ms = await paintMs(page);
    assert.ok(ms < 5000, `${book}: painted in ${ms} ms`);
    assert.ok(Date.now() - t0 < 25000, `${book}: took ${Date.now() - t0} ms`);
    await page.close();
  }
});

// E-51.
test('I shows the book\'s statistics: size, words, characters, reading time and what is left (E-51)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/stats-words.txt`);
  assert.ok(await h.waitFor(async () => /alpha beta/.test(await frameText(page)), 10000));
  await page.keyboard.press('i');
  await page.waitForFunction(() => /^[\d,]+$/.test(document.querySelector('#statsWords')?.textContent || ''), null, { timeout: 15000 });
  const got = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#statsList dt')].map(dt => [dt.textContent, dt.nextElementSibling.textContent])));
  assert.equal(got.Words, '2,001');
  assert.match(got['File size'], /KB/);
  assert.equal(got['Reading time'], 'about 8 min');
  assert.equal(got.Printed, 'about 7 pages');
  assert.match(got['Read so far'], /^\d+%, about \d+ min left$/);
  assert.equal(await page.isVisible('#statsList'), true);
});
