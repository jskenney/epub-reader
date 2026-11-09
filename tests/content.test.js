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
