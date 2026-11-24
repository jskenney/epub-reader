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

test('markers and masks nested more than two deep are dropped, inline and in pictures; a plain marker stays (round 43 review, H-70; round 45)', async () => {
  let page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/nested-effects.html`);
  assert.ok(Date.now() - t0 < 15000, `took ${Date.now() - t0} ms`);
  assert.ok(await h.waitFor(async () => /After the effects/.test(await frameText(page)), 10000));
  assert.equal(await h.inFrame(page, doc => doc.querySelector('line[marker-end]')?.getAttribute('marker-end')), 'url(#arrow)', 'the plain arrow kept');
  // (No more than two deep, a marker counting two: round 45.)
  assert.equal(await h.inFrame(page, doc => {
    const w = { marker: 2, mask: 1 }, memo = new Map();
    const depth = t => { if (memo.has(t)) return memo.get(t); memo.set(t, 99); let inner = 0;
      for (const el of [t, ...t.querySelectorAll('*')]) for (const a of ['marker-mid', 'mask']) { const id = /#([^)'"]+)/.exec(el.getAttribute(a) || '')?.[1], r = id && doc.getElementById(id); if (r) inner = Math.max(inner, depth(r)); }
      const v = (w[t.localName] || 0) + inner; memo.set(t, v); return v; };
    return [...doc.querySelectorAll('[marker-mid],[mask]')].filter(el => { const id = /#([^)'"]+)/.exec(el.getAttribute('marker-mid') || el.getAttribute('mask'))?.[1], t = id && doc.getElementById(id); return t && depth(t) > 2; }).length;
  }), 0, 'nothing points more than two deep');
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
  const got = await h.inFrame(page, doc => Object.fromEntries([...doc.querySelectorAll('div[class^="t-"]')].map(d => {
    const top = d.querySelector('svg > rect'), cs = getComputedStyle(top);
    return [d.className, [cs.maskImage, cs.webkitMaskImage].join(' ')];
  })));
  // (The animation removed, what it would have nested is one level deep, and kept.)
  for (const [k, v] of Object.entries(got)) if (k !== 't-smil') assert.doesNotMatch(v, /url\(/, `${k}: ${v}`);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('set').length), 0, 'the animation that sets a mask removed');
});
