// Reading EPUB and CBZ archives in place: only the parts needed are fetched (range requests) or read
// (uploads), with a fallback to the whole file when a server ignores ranges (REVIEW.md L-16).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const BIG = path.join(__dirname, 'site', 'reader', 'books', 'big.epub');
// Count whole-archive loads: JSZip.loadAsync is only used when an archive can't be read in place.
async function countWholeLoads(page) {
  await page.addInitScript(() => {
    let lib;
    window.wholeLoads = 0;
    Object.defineProperty(window, 'JSZip', { configurable: true, get: () => lib, set: v => {
      lib = v; const load = v.loadAsync.bind(v); v.loadAsync = (...a) => { window.wholeLoads++; return load(...a); };
    } });
  });
}

test('a large EPUB on a server with range requests: only the parts needed are fetched', async () => {
  const size = fs.statSync(BIG).size;
  const page = await h.newPage();
  await countWholeLoads(page);
  await h.openReader(page, `${h.READER}?book=books/big.epub`);
  await h.clearBytes();
  await page.reload(); await h.waitForBook(page);
  assert.equal(await h.title(page), 'The Big Book');
  let sent = (await h.bytesSent())['/reader/books/big.epub'] || 0;
  assert.ok(sent > 0 && sent < size / 10, `sent ${sent} of ${size} bytes`);
  assert.equal(await page.evaluate(() => window.wholeLoads), 0);
  // The picture in chapter 3 is read (and decompressed) when that chapter opens.
  await page.click('#tocList a >> nth=2');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.getElementById('big-pic')?.naturalWidth > 0, null, { timeout: 10000 });
  sent = (await h.bytesSent())['/reader/books/big.epub'];
  assert.ok(sent < size / 10, `sent ${sent} of ${size} bytes after chapter 3`);
});

test('a server that ignores range requests: the whole file is downloaded, as before', async () => {
  const size = fs.statSync(BIG).size;
  const page = await h.newPage();
  await countWholeLoads(page);
  await h.clearBytes(h.SOFT);
  await h.openReader(page, `${h.SOFT}/reader/index.html?book=books/big.epub`);
  assert.equal(await h.title(page), 'The Big Book');
  assert.ok(((await h.bytesSent(h.SOFT))['/reader/books/big.epub'] || 0) >= size);
  assert.equal(await page.evaluate(() => window.wholeLoads), 1);
});

test('an uploaded EPUB or comic is read in place', async () => {
  for (const [file, want] of [['big.epub', 'The Big Book'], ['comic.cbz', 'Test Comic']]) {
    const page = await h.newPage();
    await countWholeLoads(page);
    await h.openReader(page);
    await page.setInputFiles('#fileInput', path.join(__dirname, 'site', 'reader', 'books', file));
    await page.waitForFunction(w => document.querySelector('#bookTitle').textContent === w, want, { timeout: 15000 });
    await h.waitForBook(page);
    assert.equal(await page.evaluate(() => window.wholeLoads), 1, `${file}: only the built-in sample should be loaded whole`);
    if (file === 'comic.cbz') {
      assert.ok(await page.evaluate(() => [...document.querySelector('#page').contentDocument.querySelectorAll('.cbz-page img')].slice(0, 2).every(i => i.naturalWidth > 0)));
    }
  }
});

test('comics on a server with range requests open in place', async () => {
  const page = await h.newPage();
  await countWholeLoads(page);
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`);
  assert.equal(await h.title(page), 'Test Comic');
  assert.equal(await page.evaluate(() => window.wholeLoads), 0);
});
