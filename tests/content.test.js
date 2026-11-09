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
