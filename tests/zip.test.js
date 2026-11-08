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
  await h.clearBytes(h.NORANGE);
  await h.openReader(page, `${h.NORANGE}/reader/index.html?book=books/big.epub`);
  assert.equal(await h.title(page), 'The Big Book');
  assert.ok(((await h.bytesSent(h.NORANGE))['/reader/books/big.epub'] || 0) >= size);
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

test('a book with an empty file opens with range requests (H-3)', async () => {
  for (const base of [h.SITE, h.NORANGE]) {
    const page = await h.newPage();
    await h.openReader(page, `${base}/reader/index.html?book=books/empty-file.epub`);
    assert.equal(await h.title(page), 'Empty File');
    assert.equal(await h.notice(page), '', base);
    assert.match(await page.evaluate(() => document.querySelector('#page').contentDocument.body.textContent), /Text\./);
  }
});

// Unusual archives (T-6): each opens in place, or falls back to the whole file, or fails clearly.
test('directory entries, a comment holding a fake end record, and a long local extra field read in place (L-22, L-23)', async () => {
  for (const [file, want] of [['dirs.epub', 'Directory Entries'], ['comment.epub', 'Archive Comment'], ['local-extra.epub', 'Local Extra']]) {
    const page = await h.newPage();
    await countWholeLoads(page);
    await h.openReader(page, `${h.READER}?book=books/${file}`);
    assert.equal(await h.title(page), want, file);
    assert.equal(await page.evaluate(() => window.wholeLoads), 0, `${file} should be read in place`);
  }
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/local-extra.epub`);
  await page.click('#tocList a >> nth=2');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.getElementById('le-pic')?.naturalWidth > 0, null, { timeout: 10000 });
});

test('a file name that is not UTF-8 is found through its Unicode Path field (L-22)', async () => {
  const page = await h.newPage();
  await countWholeLoads(page);
  await h.openReader(page, `${h.READER}?book=books/unicode-path.epub`);
  assert.equal(await h.title(page), 'Unicode Path');
  assert.match(await page.evaluate(() => document.querySelector('#page').contentDocument.body.textContent), /Found by its Unicode name/);
  assert.equal(await page.evaluate(() => window.wholeLoads), 0);
});

test('an entry that inflates past its declared size fails clearly instead of filling memory (M-9)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/bomb.epub`);
  assert.equal(await h.title(page), 'Bomb');
  await page.click('#tocList a >> nth=1');
  const note = await h.waitFor(() => h.notice(page), 10000);
  assert.match(note, /c2\.xhtml: damaged archive \(larger than it says\)/);
});

test('ZIP64, or a range reply without a total size, falls back to the whole file', async () => {
  for (const [ref, want] of [['books/zip64.epub', 'Zip64 Book'], ['books/star-total/long.epub', 'The Long Book']]) {
    const page = await h.newPage();
    await countWholeLoads(page);
    await h.openReader(page, `${h.READER}?book=${ref}`);
    assert.equal(await h.title(page), want, ref);
    assert.equal(await page.evaluate(() => window.wholeLoads), 1, ref);
  }
});

test('an unknown compression method is reported clearly (neither reader can open it)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/method99.epub`);
  assert.equal(await h.title(page), 'Four Fables');
  assert.match(await h.notice(page), /method99\.epub couldn't be (opened|read)/);
});

test('when the server stops answering ranges, the chapter fails, and works again once it answers (M-7)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/big.epub`);
  try {
    await fetch(`${h.SITE}/__ranges?on=0`);
    await page.click('#tocList a >> nth=2');
    assert.match(await h.waitFor(() => h.notice(page), 10000), /stopped answering range requests/);
  } finally { await fetch(`${h.SITE}/__ranges?on=1`); }
  await page.click('#noticeAction');   // dismiss
  await page.click('#tocList a >> nth=2');   // the failed reads weren't remembered: this time it works
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.getElementById('big-pic')?.naturalWidth > 0, null, { timeout: 10000 });
  assert.equal(await h.notice(page), '');
});

test('a book replaced on the server while it is open is reported, not read as a mix (M-8)', async () => {
  const books = path.join(__dirname, 'site', 'reader', 'books');
  const target = path.join(books, 'changing.epub');
  fs.copyFileSync(path.join(books, 'big.epub'), target);
  try {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/changing.epub`);
    assert.equal(await h.title(page), 'The Big Book');
    fs.copyFileSync(path.join(books, 'long.epub'), target);   // a different file under the same name
    await page.click('#tocList a >> nth=2');
    assert.match(await h.waitFor(() => h.notice(page), 10000), /changed on the server while it was open/);
  } finally { fs.rmSync(target, { force: true }); }
});

// A same-size replacement with the same date (L-26): only the checksums can tell, so it must be reported, on
// a server with a strong ETag, only a weak one, or no validators at all.
for (const folder of ['', 'weak-etag/', 'no-validators/'])
test(`a book replaced by another of the same size is reported (${folder || 'strong ETag'}) (L-26, T-9)`, async () => {
  const books = path.join(__dirname, 'site', 'reader', 'books');
  const target = path.join(books, folder, 'same-now.epub');
  const when = new Date('2026-01-01T00:00:00Z');
  fs.copyFileSync(path.join(books, 'same-a.epub'), target);
  fs.utimesSync(target, when, when);
  try {
    const page = await h.newPage();
    await countWholeLoads(page);
    await h.openReader(page, `${h.READER}?book=books/${folder}same-now.epub`);
    assert.equal(await h.title(page), 'Same Size');
    assert.equal(await page.evaluate(() => window.wholeLoads), 0, 'read in place');
    fs.copyFileSync(path.join(books, 'same-b.epub'), target);
    fs.utimesSync(target, when, when);   // the same date, so the same Last-Modified
    await page.click('#tocList a >> nth=2');
    // With a strong ETag (which here includes the time to the nanosecond, as nginx's has the second and size)
    // the server may still see the same version; then the checksum catches it.
    assert.match(await h.waitFor(() => h.notice(page), 10000), /changed on the server while it was open|the book changed while it was open/);
    assert.doesNotMatch(await page.evaluate(() => document.querySelector('#page').contentDocument.body.textContent), /BBBB/);
  } finally { fs.rmSync(target, { force: true }); }
});

test('padding after the archive, and malformed or redundant Unicode Path fields, still read in place (L-27, T-9)', async () => {
  for (const [file, want, chapters] of [['trailing.epub', 'Trailing Bytes', 2], ['bad-upath.epub', 'Bad Unicode Path', 2]]) {
    const page = await h.newPage();
    await countWholeLoads(page);
    await h.openReader(page, `${h.READER}?book=books/${file}`);
    assert.equal(await h.title(page), want, file);
    assert.equal(await page.evaluate(() => window.wholeLoads), 0, `${file} should be read in place`);
    assert.equal(await page.locator('#tocList a').count(), chapters, file);
    await page.click('#tocList a >> nth=1');
    await page.waitForFunction(() => /Second chapter/.test(document.querySelector('#page').contentDocument.body.textContent), null, { timeout: 10000 });
    assert.equal(await h.notice(page), '', file);
  }
});

test('a file inside a book that says it is huge is refused clearly, not decompressed (L-27)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/huge-entry.epub`);
  await page.click('#tocList a >> nth=1');
  assert.match(await h.waitFor(() => h.notice(page), 10000), /too large to open \(600 MB; the limit is 512 MB\)/);
});

test('an uploaded book changed on disk while open says so (M-7)', async () => {
  const tmp = path.join(require('node:os').tmpdir(), `spine-upload-${Date.now()}.epub`);
  fs.copyFileSync(BIG, tmp);
  try {
    const page = await h.newPage();
    await h.openReader(page);
    await page.setInputFiles('#fileInput', tmp);
    await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'The Big Book', null, { timeout: 15000 });
    await h.waitForBook(page);
    fs.writeFileSync(tmp, 'replaced');
    await page.click('#tocList a >> nth=2');
    assert.match(await h.waitFor(() => h.notice(page), 10000), /changed or moved on disk while it was open/);
  } finally { fs.rmSync(tmp, { force: true }); }
});
