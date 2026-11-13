// Book contents the reader must show as the book means them: print-only styles, spine items that aren't XHTML
// pages, and text in encodings other than UTF-8 (REVIEW.md M-24 to M-26).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const frameText = page => h.inFrame(page, doc => doc.body.innerText.trim());
async function toSpine(page, n) {   // turn pages until section n shows
  for (let k = 0; k < 40 && !new RegExp(`spine ${n}/`).test(await page.textContent('#spinePos')); k++) {
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  }
  await page.waitForFunction(n => new RegExp(`spine ${n}/`).test(document.querySelector('#spinePos').textContent), n);
  await page.waitForTimeout(300);
}

test('a print-only style block does not apply on screen (M-24)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/print-style.epub`);
  assert.match(await frameText(page), /Seen on screen/);
  assert.equal(await h.inFrame(page, doc => [...doc.querySelectorAll('style[media]')].map(s => s.media).join()), 'print');
});

test('spine items that are not XHTML: an SVG page, a picture with a fallback page, a bare picture (M-25)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/odd-spine.epub`);
  assert.match(await frameText(page), /Drawn cover words/, 'the SVG page is drawn');
  assert.equal(await h.inFrame(page, doc => !!doc.querySelector('svg rect')), true);
  await toSpine(page, 2);
  assert.match(await frameText(page), /Fallback page/, 'the fallback page is shown, not the picture as text');
  assert.doesNotMatch(await frameText(page), /PNG|IHDR/);
  await page.waitForFunction(() => document.querySelector('#page').contentDocument.querySelector('#fb-img')?.naturalWidth === 64, null, { timeout: 5000 });
  await toSpine(page, 3);
  await page.waitForFunction(() => document.querySelector('#page').contentDocument.querySelector('img')?.naturalWidth === 50, null, { timeout: 5000 });
  assert.doesNotMatch(await frameText(page), /PNG|IHDR/, 'the bare picture is shown as a picture');
  assert.deepEqual(page.errors, []);
});

test('text in UTF-16 and Shift_JIS reads correctly, in books and as files (M-26)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/odd-spine.epub`);
  await toSpine(page, 4);
  assert.match(await frameText(page), /Sixteen-bit café text\./);
  await toSpine(page, 5);
  assert.match(await frameText(page), /日本語の本です。/);
  await h.openReader(page, `${h.READER}?book=books/sjis.html`);
  assert.match(await frameText(page), /日本語の本です。/);
  await h.openReader(page, `${h.READER}?book=books/u16.txt`);
  const t = await frameText(page);
  assert.match(t, /^Sixteen-bit plain text, café\./);
});

test('UTF-8 under a stale or wrong declaration stays UTF-8; real Latin-1 that says so still reads (M-26 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/stale-charset.epub`);
  assert.match(await frameText(page), /café – “quoted”/, 'a stale <meta> charset');
  await toSpine(page, 2);
  assert.match(await frameText(page), /café – “quoted”/, 'a wrong XML declaration');
  await toSpine(page, 3);
  assert.match(await frameText(page), /Latin crème brûlée\./, 'real Latin-1');
  await h.openReader(page, `${h.READER}?book=books/tips.md`);
  assert.match(await frameText(page), /café – “quoted”/, 'Markdown that mentions a charset');
});

test('an old Latin-1 file served with charset=utf-8, and Markdown that mentions a UTF-8 <meta>, still read as Windows-1252 (round 11 review)', async () => {
  const page = await h.newPage();
  const latin = Buffer.from('# Old\n\nCafé crème brûlée.\n', 'latin1');
  for (const type of ['text/markdown; charset=utf-8', 'text/plain; charset=utf-8']) {
    const ext = type.includes('markdown') ? 'md' : 'txt';
    await page.route(`**/books/served-latin.${ext}`, route => route.fulfill({ status: 200, headers: { 'Content-Type': type }, body: latin }));
    await h.openReader(page, `${h.READER}?book=books/served-latin.${ext}`);
    assert.match(await frameText(page), /Café crème brûlée\./, type);
  }
  await h.openReader(page, `${h.READER}?book=books/latin-tips.md`);
  assert.match(await frameText(page), /Café crème brûlée\./);
});

test('paging gets past a chapter that can\'t be shown, both ways (round 11, fourth review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/abc-missing/`);
  const file = () => page.textContent('#curFile');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''));
  assert.equal(await file(), 'OEBPS/c1.xhtml', 'still on the chapter shown');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /Charlie/.test(document.querySelector('#page').contentDocument?.body?.innerText || ''), null, { timeout: 5000 });
  assert.equal(await file(), 'OEBPS/c3.xhtml');
  await page.waitForTimeout(1600);   // (until the page is fully shown: the fonts get up to 1.5 s)
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(800);
  assert.equal(await file(), 'OEBPS/c3.xhtml');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => /Alpha/.test(document.querySelector('#page').contentDocument?.body?.innerText || ''), null, { timeout: 5000 });
  assert.equal(await file(), 'OEBPS/c1.xhtml');
});

test('encoding labels: aliases, x-user-defined, and a server label the browser drops lets the file\'s own declaration count (round 11, fourth review)', async () => {
  const page = await h.newPage();
  const serve = async (name, type, body) => page.route(`**/books/${name}`, route => route.fulfill({ status: 200, headers: { 'Content-Type': type }, body }));
  // ISO-2022-JP is 7-bit, so valid UTF-8 too: named by an alias, it must still be decoded as declared.
  const jis = Buffer.from([0x1b, 0x24, 0x42, 0x46, 0x7c, 0x4b, 0x5c, 0x1b, 0x28, 0x42]);   // 日本
  await serve('jis.txt', 'text/plain; charset=csISO2022JP', jis);
  await h.openReader(page, `${h.READER}?book=books/jis.txt`);
  assert.match(await frameText(page), /日本/);
  await serve('xud.html', 'text/html', Buffer.concat([Buffer.from('<meta charset="x-user-defined"><p>Caf'), Buffer.from([0xe9]), Buffer.from('.</p>')]));
  await h.openReader(page, `${h.READER}?book=books/xud.html`);
  assert.match(await frameText(page), /Café\./);
  await serve('dropped.html', 'text/html; charset=none', Buffer.concat([Buffer.from('<meta charset="shift_jis"><p>'), Buffer.from([0x93, 0xfa, 0x96, 0x7b]), Buffer.from('</p>')]));
  await h.openReader(page, `${h.READER}?book=books/dropped.html`);
  assert.match(await frameText(page), /日本/);
});

test('fonts obfuscated as EPUB allows (IDPF and Adobe) are handed to the page as the real font (L-88)', async () => {
  const page = await h.newPage();
  const want = require('node:fs').readFileSync(require('node:path').join(__dirname, 'site', 'reader', 'books', 'obf-font.bin'));
  for (const name of ['obf-idpf', 'obf-adobe']) {
    await h.openReader(page, `${h.READER}?book=books/${name}.epub`);
    const url = await h.inFrame(page, doc => [...doc.querySelectorAll('style')].map(s => s.textContent).join('').match(/blob:[^)"']+/)?.[0]);
    assert.ok(url, `${name}: the font's address`);
    const got = Buffer.from(await page.evaluate(async u => [...new Uint8Array(await (await fetch(u)).arrayBuffer())], url));
    assert.ok(got.equals(want), `${name}: the font as it was before obfuscation (first bytes ${got.subarray(0, 8).toString('hex')})`);
  }
});

test('UTF-8 text with a stray bad byte stays UTF-8, not read as Windows-1252 (L-108)', async () => {
  const page = await h.newPage();
  const body = Buffer.concat([Buffer.from('# Notes\n\nCafé crème brûlée, naïve façade. ', 'utf8'), Buffer.from([0xff]), Buffer.from(' The end — fin.\n', 'utf8')]);
  await page.route('**/books/stray.md', route => route.fulfill({ status: 200, headers: { 'Content-Type': 'text/markdown' }, body }));
  await h.openReader(page, `${h.READER}?book=books/stray.md`);
  const t = await frameText(page);
  assert.match(t, /Café crème brûlée, naïve façade\. � The end — fin\./, t);
});

const frameHtml = page => h.inFrame(page, doc => doc.documentElement.outerHTML);
test('markup that only appears on reading back has its styles, srcset and addresses cleaned too (round 13 review)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, `${h.READER}?book=books/mutation-css.epub`);
  const html = await frameHtml(page);
  assert.doesNotMatch(html, /localhost:8792/, 'no address of the other site is left');
  assert.doesNotMatch(html, /src="mx-local\.png"/, 'no relative address left to resolve against the reader');
  await page.waitForTimeout(500);
  assert.deepEqual(await h.remoteLog(), []);
});

test('var() inside image-set() or image(): the address would appear past the cleaner, so it goes (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/var-image.epub`);
  const css = await h.inFrame(page, doc => [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n'));
  assert.doesNotMatch(css, /image-set\(var/, css.slice(-400));
  const bg = await h.inFrame(page, doc => ['a', 'b', 'c'].map(id => doc.defaultView.getComputedStyle(doc.getElementById(id)).backgroundImage));
  for (const v of bg) assert.doesNotMatch(v, /var-|8792/, v);
});

test('XHTML files named .html are read as XHTML (self-closed tags stay empty) (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/xhtml-named-html.epub`);
  assert.match(await frameText(page), /after the anchor\.[\s\S]*Last paragraph\./, 'nothing hidden inside the self-closed div');
});

test('the importing sheet keeps its own @namespace, and text in strings is left alone (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/ns-sheet.epub`);
  // (epub|type selectors can't match in a page read as HTML; what matters is that the browser keeps the rule.)
  const [spaces, after] = await h.inFrame(page, doc => [[...doc.styleSheets].flatMap(ss => [...ss.cssRules]).filter(r => r instanceof doc.defaultView.CSSNamespaceRule).map(r => r.prefix),
    doc.defaultView.getComputedStyle(doc.getElementById('q'), '::after').content]);
  assert.deepEqual(spaces, ['epub']);
  assert.equal(after, '"@namespace zz;"');
});

test('a damaged picture is left out, not the whole page (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/bad-picture.epub`);
  assert.match(await frameText(page), /The text of chapter one\./);
});

test('a newly opened book whose first chapter can\'t be shown doesn\'t leave the last book\'s page; paging gets on (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.setInputFiles('#fileInput', require('node:path').join(__dirname, 'site', 'reader', 'books', 'bad-first.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Bad First');
  await page.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''));
  await page.waitForTimeout(500);
  assert.doesNotMatch(await frameText(page), /keeper|First paragraph/, 'not the other book\'s page');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /Second chapter/.test(document.querySelector('#page').contentDocument?.body?.innerText || ''), null, { timeout: 5000 });
});

test('page turns while a chapter loads wait for it, rather than skipping a chapter (round 13 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  for (let k = 0; k < 20; k++) {   // to the last page of chapter one
    const [x, y] = (await page.textContent('#spinePos')).match(/page (\d+)\/(\d+)/).slice(1).map(Number);
    if (x >= y) break;
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  }
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1500);
  assert.match(await page.textContent('#spinePos'), /spine 2\//);
});

test('in the scroll layout a chapter that can\'t be shown leaves the page before, and choosing it again tries again (loop 5 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/abc-missing/`, { 'spine:layout': 'scroll' });
  await page.click('#tocList a >> nth=1');
  await page.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''));
  await page.waitForTimeout(300);
  assert.deepEqual(page.errors, []);
  assert.equal(await page.textContent('#curFile'), 'OEBPS/c1.xhtml');
  // Chosen again (from a blank page after a new book's failed first chapter too): tried again, and said so again.
  const blank = await h.newPage();
  await h.openReader(blank, `${h.READER}?book=books/bad-first.epub`);
  await blank.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''));
  await blank.click('#noticeAction').catch(() => {});
  await blank.waitForFunction(() => document.querySelector('#notice').hidden || !/couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''), null, { timeout: 3000 }).catch(() => {});
  await blank.evaluate(() => { document.querySelector('#notice').hidden = true; });
  await blank.click('#tocList a >> nth=0');
  await blank.waitForFunction(() => !document.querySelector('#notice').hidden && /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''), null, { timeout: 5000 });
});

// Round 25 review.
test('a text file with one paragraph per line (no blank lines) keeps its paragraphs and chapter headings (round 25 review, M-122)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/oneline-paras.txt`);
  const s = await h.inFrame(page, doc => ({ p: doc.querySelectorAll('p').length, h: doc.querySelectorAll('h1,h2').length }));
  assert.ok(s.p >= 100 && s.h >= 1, JSON.stringify(s));
  assert.deepEqual(await page.$$eval('#tocList a', as => as.map(a => a.textContent)), ['Chapter 1', 'Chapter 2']);
});

test('one huge paragraph, or a huge block of short lines, is split into sections (round 25 review, L-286)', async () => {
  const page = await h.newPage();
  for (const name of ['oneline.txt', 'verse.txt']) {
    await h.openReader(page, `${h.READER}?book=books/${name}`, { 'spine:layout': 'scroll' });
    const n = Number(/spine \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
    assert.ok(n >= 3, `${name}: ${n} sections`);
  }
});

// Round 25 review, loop 2.
test('unwrapped text with blank lines keeps its two-line heading and its verse; hard-wrapped text marked by indentation keeps its paragraphs; a paragraph without spaces is split (round 25 review, M-125, L-294, L-293)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/unwrapped-blank.txt`);
  const u = await h.inFrame(page, doc => ({ h: doc.querySelector('h1,h2')?.innerHTML, lines: doc.querySelectorAll('.txt-lines').length, p: doc.querySelectorAll('p:not(.txt-lines)').length }));
  assert.match(u.h, /CHAPTER ONE<br>\s*The Arrival/);
  assert.equal(u.lines, 1);
  assert.equal(u.p, 30);
  await h.openReader(page, `${h.READER}?book=books/indented.txt`);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('p').length), 60);
  await h.openReader(page, `${h.READER}?book=books/cjk.txt`, { 'spine:layout': 'scroll' });
  const n = Number(/spine \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
  assert.ok(await h.inFrame(page, doc => doc.querySelectorAll('p').length) > 1 || n > 1);
});

test('text shapes: indented paragraphs keep their chapter headings; unwrapped text with some indented lines, or with scene breaks and short lines, is a paragraph per line (round 25 review, loop 3)', async () => {
  const page = await h.newPage();
  const shape = async name => { await h.openReader(page, `${h.READER}?book=books/${name}`); return h.inFrame(page, doc => ({ p: doc.querySelectorAll('p:not(.txt-lines)').length, lines: doc.querySelectorAll('.txt-lines').length })); };
  assert.deepEqual(await shape('indent-heads.txt'), { p: 75, lines: 0 });
  assert.deepEqual(await page.$$eval('#tocList a', as => as.map(a => a.textContent)), ['CHAPTER I', 'CHAPTER II', 'CHAPTER III', 'CHAPTER IV', 'CHAPTER V']);
  assert.deepEqual(await shape('unwrapped-indent.txt'), { p: 100, lines: 0 });
  assert.deepEqual(await shape('unwrapped-scenes.txt'), { p: 96, lines: 0 });
});

test('text shapes, loop 4: short indented paragraphs; hard-wrapped at 100 with blank lines; a few long lines; code; a sentence starting "chapter" mid-paragraph (round 25 review, M-132, M-133, L-313, L-314, L-315)', async () => {
  const page = await h.newPage();
  const shape = async name => { await h.openReader(page, `${h.READER}?book=books/${name}`); return h.inFrame(page, doc => ({ p: doc.querySelectorAll('p:not(.txt-lines)').length, lines: doc.querySelectorAll('.txt-lines').length, h: doc.querySelectorAll('h1,h2').length })); };
  assert.equal((await shape('indent-dialogue.txt')).p, 80);
  assert.equal((await shape('wrap100-blank.txt')).p, 80);
  assert.equal((await shape('small-unwrapped.txt')).p, 4);
  const code = await shape('code.txt');
  assert.ok(code.lines > 0 && code.p === 0, JSON.stringify(code));
  assert.match(await h.inFrame(page, doc => doc.querySelector('.txt-lines').innerHTML), /\u2003/, 'indentation kept');
  assert.equal((await shape('false-heading.txt')).h, 0);
});

test('text shapes, loop 5: verse, Word text with tabs, short unwrapped lines, no blank lines nor indents, chapter titles, non-Latin headings, tabs in code (round 25 review, M-137, M-138, M-139, L-326 to L-330)', async () => {
  const page = await h.newPage();
  const shape = async name => { await h.openReader(page, `${h.READER}?book=books/${name}`); return h.inFrame(page, doc => ({ p: doc.querySelectorAll('p:not(.txt-lines)').length, lines: doc.querySelectorAll('.txt-lines').length, h: doc.querySelectorAll('h1,h2').length })); };
  const poetry = await shape('pg-poetry.txt');
  assert.ok(poetry.lines >= 20 && poetry.p === 0, `verse kept as lines: ${JSON.stringify(poetry)}`);
  assert.deepEqual(await shape('word-tabs.txt'), { p: 75, lines: 1, h: 3 });
  assert.equal((await shape('fanfic-shortlines.txt')).p, 120);
  assert.equal((await shape('unwrapped-uniform.txt')).p, 150);
  assert.equal((await shape('wrapped-noblank-noindent.txt')).p, 40);
  const toc = async () => page.$$eval('#tocList a', as => as.map(a => a.textContent));
  await shape('pg-novel.txt');
  assert.ok((await toc()).length <= 10, `one contents entry per chapter, not a title or a signature as well: ${(await toc()).join(' | ')}`);
  assert.equal((await shape('cjk-novel-plain.txt')).h, 4);
  assert.equal((await shape('greek-wrapped.txt')).h, 2);
  await shape('code-tabs.txt');
  assert.match(await h.inFrame(page, doc => doc.querySelector('.txt-lines').innerHTML), / /, 'tab indentation kept');
});

// Round 25 review, loop 6.
test('a document\'s relative link to another document beside it opens that one, at the place linked (round 25 review, M-141)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/linkdoc/a.html`, { 'spine:layout': 'scroll' });
  await page.frameLocator('#page').locator('#tob').click();
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc B');
  await page.waitForFunction(() => /book=.*linkdoc%2Fb\.html/.test(location.search));
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => { const r = doc.getElementById('sec')?.getBoundingClientRect(); return r && r.top >= 0 && r.top < doc.defaultView.innerHeight; }), 5000), 'at the section');
  await h.openReader(page, `${h.READER}?book=books/linkdoc/a.html`);
  await page.frameLocator('#page').locator('#tomd').click();
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc C');
});

test('search says "+" only when there are more matches than listed (round 25 review, L-335)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:set:SEARCH_MAX': 1 });
  await page.fill('#searchBox', 'lighthouse');
  await page.waitForFunction(() => /of 1/.test(document.querySelector('#searchStatus').textContent));
  assert.equal(await page.textContent('#searchStatus'), '1 of 1 matches');
});

test('a document\'s link with empty steps (".///host/…", ".\\\\host/…", "a/..///host/…") doesn\'t open a page of another site (round 26 review, H-34)', async () => {
  const page = await h.newPage();
  const asked = [];
  await page.route(u => u.hostname === 'evil.example', r => { asked.push(r.request().url()); r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/html' }, body: '<title>Sign in again</title><h1>Sign in again</h1>' }); });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await h.openReader(page, `${h.READER}?book=books/linkdoc/d.html`, { 'spine:layout': 'scroll' });
  for (const id of ['x1', 'x2', 'x3', 'x4']) {
    await page.frameLocator('#page').locator('#' + id).click();
    await page.waitForTimeout(400);
    assert.equal(await page.textContent('#bookTitle'), 'Doc D', id);
  }
  assert.deepEqual(asked, []);
  assert.deepEqual(errors, []);
  assert.doesNotMatch(await page.evaluate(() => location.search), /get=|evil/);
});

test('a chapter of more than 16 MB of markup is refused with a notice, quickly, and the rest of the book still reads (round 26 review, H-35)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/huge-chapter.epub`);
  const t0 = Date.now();
  await page.click('#toc :is(a,button):has-text("Two")');
  await page.waitForFunction(() => /too large to show/.test(document.querySelector('#notice')?.textContent || ''), null, { timeout: 15000 });
  assert.ok(Date.now() - t0 < 15000);
  assert.match(await page.textContent('#notice'), /c2\.xhtml is too large to show \(2\d MB of text; the limit is 16 MB\)/);
  await page.click('#toc :is(a,button):has-text("One")');
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => /Start here/.test(doc.body.textContent)), 5000));
});

test('a document\'s links: a missing file leaves it open with a notice; "../" reaches the folder above; a book beside it opens; a link to itself goes to the place; a name holding %2F is reached (round 26 review, M-144, L-340, L-346)', async () => {
  const page = await h.newPage();
  const E = `${h.READER}?book=books/linkdoc/e.html`;
  const title = () => page.textContent('#bookTitle');
  const click = id => page.frameLocator('#page').locator('#' + id).click();
  await h.openReader(page, E, { 'spine:layout': 'scroll' });
  const before = await page.evaluate(() => location.href);
  await click('miss');
  assert.match(await h.noticeLike(page, /missing\.html/, 5000), /missing\.html/);
  assert.equal(await title(), 'Doc E');
  assert.equal(await page.evaluate(() => location.href), before, 'the address is left as it was');
  await click('me');
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => { const r = doc.getElementById('end')?.getBoundingClientRect(); return r && r.top >= 0 && r.top < doc.defaultView.innerHeight; }), 5000), 'at the place in itself');
  assert.equal(await title(), 'Doc E');
  await click('up');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc F');
  await page.waitForFunction(() => /other%2Ff\.html/.test(location.search));
  await h.openReader(page, E, { 'spine:layout': 'scroll' });
  await click('pct');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc XY');
  await h.openReader(page, E, { 'spine:layout': 'scroll' });
  await click('epub');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'The Long Book');
});

test('after following a document\'s link, Back and Forward open the documents again (round 26 review, M-145)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/linkdoc/a.html`, { 'spine:layout': 'scroll' });
  await page.frameLocator('#page').locator('#tob').click();
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc B' && /linkdoc%2Fb\.html/.test(location.search));
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc A');
  assert.match(await page.evaluate(() => location.search), /linkdoc(\/|%2F)a\.html/);
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Doc B');
});

test('an HTML or Markdown document marked right to left (on html, or a wrapper around it all) reads right to left (round 25 review, M-148)', async () => {
  const page = await h.newPage();
  for (const name of ['rtl-doc.html', 'rtl-doc.md']) {
    await h.openReader(page, `${h.READER}?book=books/${name}`);
    assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.querySelector('[id^="spine-flow"]')).direction), 'rtl', name);
  }
});

test('a link to a very long name gives a short notice that leaves its button in sight (round 25 review, L-345)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/linkdoc/long-link.html`, { 'spine:layout': 'scroll' });
  await page.frameLocator('#page').locator('#long').click();
  const text = await h.noticeLike(page, /\S{100}|…$/, 8000);
  assert.ok(text && text.length <= 420, `${text?.length} characters`);
  assert.equal(await page.isVisible('#noticeAction'), true);
  const r = await page.evaluate(() => document.querySelector('#notice').getBoundingClientRect().height);
  assert.ok(r < 200, `the notice is ${r}px high`);
  await page.click('#noticeAction');
  assert.equal(await page.isHidden('#notice'), true);
});

test('a Markdown table is drawn as a table (lines between cells, the header row set apart, columns aligned as written); an HTML document\'s keeps its own look', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/table.md`);
  const look = () => h.inFrame(page, doc => {
    const s = el => getComputedStyle(el), td = doc.querySelector('td'), th = doc.querySelector('th');
    return { tds: doc.querySelectorAll('td').length, border: parseFloat(s(td).borderTopWidth), collapse: s(doc.querySelector('table')).borderCollapse,
      head: s(th).backgroundColor, aligns: [...doc.querySelectorAll('tbody tr:first-child td')].map(c => s(c).textAlign) };
  });
  const md = await look();
  assert.equal(md.tds, 6);
  assert.ok(md.border >= 1, JSON.stringify(md));
  assert.equal(md.collapse, 'collapse');
  assert.notEqual(md.head, 'rgba(0, 0, 0, 0)');
  assert.deepEqual(md.aligns.map(a => a.replace('-webkit-', '')), ['start', 'center', 'right']);
  await h.openReader(page, `${h.READER}?book=books/table.html`);
  assert.equal((await look()).border, 0, 'an HTML document\'s table as it was');
});

test('Markdown: GitHub\'s math (inline, $`…`$, $$ blocks, math code blocks) as MathML keeping its TeX, dollar amounts as text; footnotes numbered with links both ways; alerts set apart (E-31, E-32, E-33)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/gh.md`);
  const r = await h.inFrame(page, doc => ({
    math: doc.querySelectorAll('math').length, block: doc.querySelectorAll('math[display="block"]').length,
    tex: [...doc.querySelectorAll('annotation[encoding="application/x-tex"]')].map(a => a.textContent.trim()),
    text: doc.body.textContent.replace(/\s+/g, ' '),
    refs: [...doc.querySelectorAll('sup[data-fn-ref] a')].map(a => [a.textContent, a.getAttribute('href'), a.id]),
    notes: [...doc.querySelectorAll('.md-footnotes li')].map(li => [li.id, li.querySelectorAll('[data-fn-back]').length]),
    alerts: [...doc.querySelectorAll('.md-alert')].map(a => [a.dataset.alert, a.querySelector('.md-alert-title').textContent, getComputedStyle(a).borderLeftColor]),
    quotes: doc.querySelectorAll('blockquote').length, bad: doc.querySelector('.md-math-error')?.textContent }));
  assert.deepEqual(r.tex, ['E = mc^2', '\\sqrt{x}', '\\int_0^1 x^2\\,dx = \\frac{1}{3}', '\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}', 'x^2']);
  assert.equal(r.block, 2);
  assert.match(r.text, /costs \$5 and \$10 stay text, and \$x\$ too/);
  assert.deepEqual(r.refs.map(x => x[0]), ['1', '2', '1']);
  assert.deepEqual(r.refs.map(x => x[2]), ['fnref-first', 'fnref-second', 'fnref-first-2']);
  assert.deepEqual(r.notes, [['fn-first', 2], ['fn-second', 1]]);
  assert.deepEqual(r.alerts.map(a => a.slice(0, 2)), [['NOTE', 'Note'], ['WARNING', 'Warning']]);
  assert.notEqual(r.alerts[0][2], r.alerts[1][2], 'each kind its colour');
  assert.equal(r.quotes, 1, 'the plain quotation stays one');
  assert.equal(r.bad, '$\\frac{1}{$');
  // A footnote mark goes to its note.
  await page.frameLocator('#page').locator('sup[data-fn-ref="second"] a').click();
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => { const r = doc.getElementById('fn-second').getBoundingClientRect(); return r.right > 0 && r.left < doc.defaultView.innerWidth; }), 5000), 'at the note');
});

test('Markdown: emoji shortcodes GitHub knows as their emoji (not unknown names, code, or times); code blocks naming a language highlighted, others as they were (E-34, E-35)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/gh2.md`);
  const r = await h.inFrame(page, doc => ({
    emoji: [...doc.querySelectorAll('[data-emoji]')].map(e => [e.dataset.emoji, e.textContent, e.getAttribute('aria-label')]),
    text: doc.body.textContent.replace(/\s+/g, ' '),
    code: doc.querySelector('code').textContent,
    blocks: [...doc.querySelectorAll('pre code')].map(c => [c.className, c.querySelectorAll('span[class^="hljs-"]').length]),
    keyword: (() => { const k = doc.querySelector('.hljs-keyword'); return k && [k.textContent, getComputedStyle(k).color]; })(),
    comment: (() => { const k = doc.querySelector('.hljs-comment'); return k && getComputedStyle(k).color; })() }));
  assert.deepEqual(r.emoji, [['smile', '😄', 'smile'], ['+1', '👍', '+1'], ['tada', '🎉', 'tada']]);
  assert.match(r.text, /but :not_an_emoji: and :smile: stay, and so does 10:30:45\./);
  assert.equal(r.code, ':smile:', 'inline code as written');
  assert.equal(r.blocks[0][0], 'hljs language-js');
  assert.ok(r.blocks[0][1] >= 4, JSON.stringify(r.blocks));
  assert.deepEqual(r.blocks.slice(1).map(b => b[1]), [0, 0], 'a block without a language, or with one not known, as it was');
  assert.equal(r.keyword[0], 'const');
  assert.notEqual(r.keyword[1], r.comment, 'keywords and comments in their colours');
  // Dark: colours of their own.
  await page.keyboard.press('t'); await page.waitForTimeout(400);
  assert.notEqual(await h.inFrame(page, doc => getComputedStyle(doc.querySelector('.hljs-keyword')).color), r.keyword[1]);
});

test('a document of one huge numbered list is split into parts, numbered on across them; a document over 32 MB is refused with a notice (round 27 review, M-156)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/big-list.md`);
  assert.ok(Date.now() - t0 < 20000, `${Date.now() - t0} ms`);
  const parts = Number(/spine \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
  assert.ok(parts >= 5, `${parts} parts`);
  // The last part's list goes on from the earlier parts' numbers.
  await page.focus('#ribbon'); await page.keyboard.press('End');
  await page.waitForFunction(n => new RegExp(`spine ${n}/`).test(document.querySelector('#spinePos').textContent), parts, { timeout: 10000 });
  const start = await h.inFrame(page, doc => Number(doc.querySelector('ol')?.getAttribute('start')));
  assert.ok(start > 1000, `starts at ${start}`);
  // Over the limit: refused.
  await page.setInputFiles('#fileInput', { name: 'huge.md', mimeType: 'text/markdown', buffer: Buffer.alloc(33 * 1024 * 1024, 'a') });
  assert.match(await h.noticeLike(page, /huge\.md is too large to show \(33 MB; the limit is 32 MB\)/, 15000), /huge\.md is too large to show \(33 MB; the limit is 32 MB\)/);
});

test('SVG pictures: none over 4 MB, and no more than 24 MB of them for a page; the page shows quickly (round 27 review, M-157)', async () => {
  const page = await h.newPage();
  const warned = []; page.on('console', m => { if (/too large to show/.test(m.text())) warned.push(m.text()); });
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/svg-heavy.epub`);
  await page.waitForTimeout(1000);
  assert.ok(Date.now() - t0 < 15000);
  const shown = await h.inFrame(page, doc => [...doc.querySelectorAll('img')].map(i => !!i.getAttribute('src')));
  assert.equal(shown.at(-1), false, 'the 5 MB picture left out');
  const n = shown.slice(0, 10).filter(Boolean).length;
  assert.ok(n >= 6 && n <= 8, `${n} of the 3 MB pictures shown (24 MB a page)`);
  assert.ok(warned.some(w => /huge\.svg/.test(w)), warned.join(' | '));
});

test('a folder book\'s chapter over 16 MB is refused with a notice, by its length or as it arrives compressed with no length, without reading it all (round 27 review, L-359)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/bigfolder/`);
  await page.click('#nextBtn');
  assert.match(await h.noticeLike(page, /__big-plain\.xhtml is too large to show/, 15000), /__big-plain\.xhtml is too large to show/);
  await page.click('#noticeAction');
  await page.click('#nextBtn');
  assert.match(await h.waitFor(async () => /__big-gzip/.test(await h.notice(page)) && h.notice(page), 30000) || '', /__big-gzip\.xhtml is too large to show/);
  await page.waitForTimeout(500);
  const log = await (await fetch(`${h.SITE}/__big`)).json();
  assert.ok(log.length && log.every(e => !e.complete), JSON.stringify(log));
});

test('document links: a site path starting with // stays this site\'s; the reader\'s own page isn\'t opened as a document; a book\'s own link marks are ignored; a link to itself by a name holding "," stays in the document (round 27 review, L-360, L-361, L-362, L-363)', async () => {
  const page = await h.newPage();
  const G = `${h.READER}?book=books/linkdoc/g.html`;
  const click = id => page.frameLocator('#page').locator('#' + id).click();
  await h.openReader(page, G, { 'spine:layout': 'scroll' });
  await click('slashes');
  const n1 = await h.noticeLike(page, /x\.html|same site/, 8000);
  assert.doesNotMatch(n1, /Only books hosted on this same site/);
  assert.match(n1, /x\.html/);
  await page.click('#noticeAction');
  await click('reader');
  assert.match(await h.noticeLike(page, /this reader's own page/, 5000), /this reader's own page/);
  assert.equal(await page.textContent('#bookTitle'), 'Doc G');
  await page.click('#noticeAction');
  await click('forged');
  await page.waitForTimeout(600);
  assert.equal(await page.textContent('#bookTitle'), 'Doc G', 'a mark the book wrote isn\'t followed');
  await h.openReader(page, `${h.READER}?book=books/linkdoc/x%2Cy.md`, { 'spine:layout': 'scroll' });
  const len = await page.evaluate(() => history.length);
  const asked = []; page.on('request', r => { if (/x(,|%2C)y\.md/i.test(r.url())) asked.push(r.url()); });
  await page.frameLocator('#page').locator('a', { hasText: 'to the bottom' }).click();
  assert.ok(await h.waitFor(() => h.inFrame(page, doc => { const r = doc.getElementById('bottom')?.getBoundingClientRect(); return r && r.top >= 0 && r.top < doc.defaultView.innerHeight; }), 5000), 'at the bottom');
  assert.equal(await page.evaluate(() => history.length), len, 'no history entry');
  assert.deepEqual(asked, [], 'not fetched again');
  // ?book= naming the reader's own page.
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.goto(`${h.READER}?book=index.html`);
  assert.ok(await h.waitFor(async () => /this reader's own page/.test(await h.notice(page) || ''), 8000), await h.notice(page));
});

test('a long Markdown novel opens in good time (no search of the rest of the document for every paragraph), and TeX repeating a macro is shown as written, quickly (round 28 review, H-40, H-41)', async () => {
  const page = await h.newPage();
  let t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/long-novel.md`);
  assert.ok(Date.now() - t0 < 12000, `the novel took ${Date.now() - t0} ms`);
  t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/texbomb.md`);
  assert.ok(Date.now() - t0 < 12000, `the TeX took ${Date.now() - t0} ms`);
  assert.equal(await h.inFrame(page, doc => !!doc.querySelector('.md-math-error') && /After\./.test(doc.body.textContent)), true);
});

test('an SVG naming further SVGs doesn\'t lead past the page\'s limit (they aren\'t followed); a chapter\'s SVGs still show on its third visit (round 28 review, H-42, M-161)', async () => {
  const page = await h.newPage();
  const warned = []; page.on('console', m => { if (/SVG inside an SVG/.test(m.text())) warned.push(m.text()); });
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/svg-chain.epub`);
  assert.ok(Date.now() - t0 < 10000);
  assert.equal(await h.inFrame(page, doc => !!doc.getElementById('c0').getAttribute('src')), true, 'the first is shown');
  assert.ok(await h.waitFor(() => warned.length > 0, 3000), 'the next isn\'t followed');
  await h.openReader(page, `${h.READER}?book=books/svg-revisit.epub`);
  const shown = () => h.inFrame(page, doc => [...doc.querySelectorAll('img')].filter(i => i.getAttribute('src')).length);
  assert.equal(await shown(), 3);
  for (let k = 0; k < 3; k++) {
    await page.click('#tocList a >> nth=5'); await page.waitForFunction(() => /spine 6\//.test(document.querySelector('#spinePos').textContent));
    await page.click('#tocList a >> nth=0'); await page.waitForFunction(() => /spine 1\//.test(document.querySelector('#spinePos').textContent));
    await page.waitForTimeout(300);
  }
  assert.equal(await shown(), 3, 'all three on the third return');
});

test('bare web addresses are linked in a document with emoji too; a time like 10:30:45 doesn\'t load the emoji list (round 28 review, M-165, L-381)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/gh2.md`);
  await h.openReader(page, `${h.READER}?book=books/autolink.md`);
  assert.equal(await h.inFrame(page, doc => doc.querySelector('a[href="https://example.com/page"]')?.textContent), 'https://example.com/page');
  const asked = []; page.on('request', r => { if (/emoji\.json/.test(r.url())) asked.push(r.url()); });
  await h.openReader(page, `${h.READER}?book=books/times.md`);
  assert.deepEqual(asked, []);
});

test('a code block over the highlighting limit is shown plain, in good time; a small one is still coloured (round 28 review, M-166)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/big-code.md`);
  assert.ok(Date.now() - t0 < 20000);
  const spans = await h.inFrame(page, doc => [...doc.querySelectorAll('pre code')].map(c => c.querySelectorAll('span').length));
  assert.ok(spans.length >= 2 && spans.slice(0, -1).every(n => n === 0) && spans.at(-1) > 0, JSON.stringify(spans));
});

test('the reader\'s own page isn\'t opened by an address spelled another way; two footnote labels never share an id; a body style\'s var() shorthand is kept (round 28 review, L-373, L-374, L-375)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  for (const b of ['%2569ndex.html', './/index.html', '..//reader//index.html']) {
    await page.goto(`${h.READER}?book=${b}`);
    assert.ok(await h.waitFor(async () => /reader's own page/.test(await h.notice(page) || ''), 8000), `${b}: ${await h.notice(page)}`);
  }
  await h.openReader(page, `${h.READER}?book=books/fn-ids.md`);
  const ids = await h.inFrame(page, doc => [...doc.querySelectorAll('.md-footnotes li')].map(li => li.id));
  assert.equal(new Set(ids).size, 2, JSON.stringify(ids));
  await h.openReader(page, `${h.READER}?book=books/body-var.epub`);
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.body).textDecoration), 'underline wavy rgb(1, 2, 3)');
});

test('a huge <details>, table or reversed list split into parts: each part keeps the summary, the table head, and counts down on (round 28 review, L-382)', async () => {
  const page = await h.newPage();
  const last = async (book, fn) => {
    await h.openReader(page, `${h.READER}?book=books/${book}`);
    const parts = Number(/spine \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]);
    assert.ok(parts >= 2, `${book}: ${parts} parts`);
    await page.focus('#ribbon'); await page.keyboard.press('End');
    await page.waitForFunction(n => new RegExp(`spine ${n}/`).test(document.querySelector('#spinePos').textContent), parts, { timeout: 10000 });
    // (The last part's page, once it is in the frame: its first item is past the first part's.)
    await h.waitFor(() => h.inFrame(page, doc => !/(Paragraph|Row|Item) 0 /.test(doc.body.textContent.slice(0, 2000)) && /(Paragraph|Row|Item) \d+/.test(doc.body.textContent)), 10000);
    return h.inFrame(page, fn);
  };
  assert.equal(await last('big-details.html', doc => doc.querySelector('details > summary')?.textContent), 'The summary');
  assert.equal(await last('big-table.html', doc => doc.querySelector('table > thead th')?.textContent), 'Head');
  const [start, first] = await last('big-reversed.html', doc => [Number(doc.querySelector('ol').getAttribute('start')), doc.querySelector('ol li').textContent]);
  const i = Number(/Item (\d+)/.exec(first)[1]);
  assert.equal(start, 8000 - i, `item ${i} numbered ${start}`);
});

test('Markdown made to be slow opens in good time: :name:-like times in one paragraph, no blank lines, unclosed $`; long ordinary formulas are drawn (round 29 review, M-170, M-171, M-172, M-176)', async () => {
  const page = await h.newPage();
  const time = async b => { const t0 = Date.now(); await h.openReader(page, `${h.READER}?book=books/${b}`); return Date.now() - t0; };
  const ms = await time('slow-emoji.md'); assert.ok(ms < 12000, `slow-emoji.md: ${ms} ms`);
  const x = await time('tick-x.md'), tick = await time('slow-tick.md');
  assert.ok(tick < x * 1.3 + 2000, `unclosed $\` ${tick} ms, the same code spans without $ ${x} ms`);
  // (Tens of thousands of blocks take time to lay out: no longer than the same with blank lines, which was quick to read.)
  const blank = await time('fences-blank.md'), none = await time('slow-fences.md');
  // (Laying out the blocks takes most of the time and varies from run to run; marked reads either in about 100 ms.)
  assert.ok(none < blank * 2 + 5000, `no blank lines ${none} ms, with them ${blank} ms`);
  await h.openReader(page, `${h.READER}?book=books/long-math.md`);
  assert.deepEqual(await h.inFrame(page, doc => [doc.querySelectorAll('math').length, doc.querySelectorAll('.md-math-error').length]), [2, 0]);
});

test('a document of twenty thousand headings turns its pages in good time (round 29 review, M-174)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/many-heads.md`, { 'spine:layout': 'one' });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
  const t0 = Date.now();
  for (let k = 0; k < 3; k++) { const before = await page.textContent('#spinePos'); await page.keyboard.press('ArrowRight'); await page.waitForFunction(b => document.querySelector('#spinePos').textContent !== b, before, { timeout: 20000 }); }
  assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms for three turns`);
});

test('a huge code block opens in good time, in parts; the reader\'s page isn\'t opened by "x%2F..%2Findex.html"; a long summary isn\'t copied into each part (round 29 review, L-388, L-387, L-390)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/huge-code.md`);
  assert.ok(Date.now() - t0 < 20000, `${Date.now() - t0} ms`);
  assert.ok(Number(/spine \d+\/(\d+)/.exec(await page.textContent('#spinePos'))[1]) >= 5, 'in parts');
  await page.goto(`${h.READER}?book=x%252F..%252Findex.html`);
  assert.ok(await h.waitFor(async () => /reader's own page/.test(await h.notice(page) || ''), 8000), await h.notice(page));
  await h.openReader(page, `${h.READER}?book=books/big-details-long.html`);
  await page.focus('#ribbon'); await page.keyboard.press('End');
  await page.waitForFunction(() => /spine (\d+)\/\1\b/.test(document.querySelector('#spinePos').textContent), null, { timeout: 10000 });
  await h.waitFor(() => h.inFrame(page, doc => /Paragraph \d+/.test(doc.body.textContent) && !/Paragraph 0 /.test(doc.body.textContent)), 10000);
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('summary').length), 0);
});

test('a paragraph of tens of thousands of emphasis marks opens in good time (round 30 review, H-47)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/emphasis.md`);
  assert.ok(Date.now() - t0 < 10000, `${Date.now() - t0} ms`);
});

test('TeX between \\( \\) and \\[ \\] in an HTML page and an EPUB chapter is drawn as math, and code blocks naming their language are coloured; code, dollar amounts, unreadable TeX and code already coloured stay as they are (E-37)', async () => {
  const page = await h.newPage();
  for (const b of ['math-page.html', 'math-epub.epub']) {
    await h.openReader(page, `${h.READER}?book=books/${b}`);
    const r = await h.inFrame(page, doc => ({
      inl: !!doc.querySelector('#inl math'), money: /money \$5 and \$10\./.test(doc.getElementById('inl').textContent),
      disp: doc.querySelector('#disp math')?.getAttribute('display'), lit: doc.querySelector('#lit code')?.textContent,
      bad: doc.getElementById('bad').textContent.includes('\\(\\frac{1}{\\)'), badMath: !!doc.querySelector('#bad math'),
      js: doc.querySelectorAll('#js span').length, py: doc.querySelectorAll('#py span').length, none: doc.querySelectorAll('#none span').length,
      own: doc.getElementById('own').innerHTML,
      colour: getComputedStyle(doc.querySelector('#js .hljs-keyword')).color, ownColour: getComputedStyle(doc.querySelector('#own .hljs-keyword')).color,
    }));
    assert.equal(r.inl, true, b); assert.equal(r.money, true, b); assert.equal(r.disp, 'block', b);
    assert.equal(r.lit, '\\(x\\)', b); assert.equal(r.bad, true, b); assert.equal(r.badMath, false, b);
    assert.ok(r.js > 0 && r.py > 0, `${b}: coloured ${JSON.stringify(r)}`); assert.equal(r.none, 0, b);
    assert.equal(r.own, '<span class="hljs-keyword">let</span> b', b);
    assert.notEqual(r.colour, r.ownColour, `${b}: the book's own highlighting keeps its colours`);
  }
});

test('MATH_DELIMITERS chooses the marks around math in HTML: \\( and \\[ by default; a site\'s \\( and $$; $ too, dollar amounts staying text (E-37)', async () => {
  const page = await h.newPage();
  const which = () => h.inFrame(page, doc => ['br', 'dd', 'sd', 'money'].filter(id => doc.querySelector(`#${id} math`)));
  await h.openReader(page, `${h.READER}?book=books/math-marks.html`);
  assert.deepEqual(await which(), ['br'], 'the default');
  await h.openReader(page, `${h.SITE}/folder-math/index.html?book=/reader/books/math-marks.html`);
  assert.deepEqual(await which(), ['br', 'dd'], 'the site\'s \\( and $$');
  await h.openReader(page, `${h.READER}?book=books/math-marks.html`, { 'spine:set:MATH_DELIMITERS': '\\( \\[ $$ $' });
  assert.deepEqual(await which(), ['br', 'dd', 'sd'], 'all four, chosen in Settings');
  assert.match(await h.inFrame(page, doc => doc.getElementById('money').textContent), /Costs \$5 and \$10, or \\\$7\./);
  await h.openReader(page, `${h.READER}?book=books/math-marks.html`, { 'spine:set:MATH_DELIMITERS': '' });
  assert.deepEqual(await which(), [], 'none');
});
