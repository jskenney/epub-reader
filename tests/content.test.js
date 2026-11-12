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
  assert.match(await h.waitFor(() => h.notice(page), 5000) || '', /missing\.html/);
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
  const text = await h.waitFor(() => h.notice(page), 8000);
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
