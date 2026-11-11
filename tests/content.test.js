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
