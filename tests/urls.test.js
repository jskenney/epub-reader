// Opening books from the address (?book=), the /bookshelf/ fallback, default.epub, and sites that answer
// missing files with a 200 "not found" page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

for (const [label, base] of [['real 404s', h.SITE], ['soft 404s', h.SOFT]]) {
  test(`?book= finds books next to the page and under /bookshelf/ (${label})`, async () => {
    const cases = [
      ['books/long.epub', 'The Long Book'],            // next to the page
      ['books/shelf-only.epub', 'The Long Book'],      // only under /bookshelf/
      ['books/shelf-dir/', 'The Long Book'],           // an extracted folder under /bookshelf/
      ['books/notes.md', 'Notes'],
      ['books/plain.txt', 'CHAPTER I.'],         // a text file's title is its first heading
      ['books/page.html', 'Web Page'],
      ['books/shelf-page.html', 'Shelf Page'],         // an HTML document only under /bookshelf/ (M-2)
      ['books/comic.cbz', 'Test Comic'],
    ];
    for (const [ref, want] of cases) {
      const page = await h.newPage();
      await h.openReader(page, `${base}/reader/index.html?book=${ref}`);
      assert.equal(await h.title(page), want, `${ref}: ${await h.notice(page)}`);
      assert.equal(await h.notice(page), '', ref);
    }
  });

  test(`a missing book is reported, and the sample opens (${label})`, async () => {
    for (const ref of ['books/nothing.epub', 'books/nothing/', 'books/nothing.md', 'books/nothing.html']) {
      const page = await h.newPage();
      await h.openReader(page, `${base}/reader/index.html?book=${ref}`);
      assert.equal(await h.title(page), 'Four Fables', ref);
      assert.match(await h.notice(page), /Nothing was found at/, ref);
    }
  });
}

test('a "%" in ?book= neither hangs the reader nor breaks the name (M-1)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/50%25off.epub`);
  assert.equal(await h.title(page), 'The Long Book');
  assert.deepEqual(page.errors, []);
  const odd = await h.newPage();
  await h.openReader(odd, `${h.READER}?book=books/100%25-missing.epub`);
  assert.equal(await h.title(odd), 'Four Fables');
  assert.match(await h.notice(odd), /100%-missing.epub couldn't be opened/);
  assert.deepEqual(odd.errors, []);
});

test('books on other sites are refused', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=//example.com/x.epub`);
  assert.match(await h.notice(page), /same site/);
});

test('default.epub: used when it is a real EPUB, otherwise the sample', async () => {
  const dir = path.join(__dirname, 'site', 'reader');
  const target = path.join(dir, 'default.epub');
  const tryWith = async (content, base = h.SITE) => {
    if (content === null) fs.rmSync(target, { force: true }); else fs.writeFileSync(target, content);
    const page = await h.newPage();
    await h.openReader(page, `${base}/reader/index.html`);
    return [await h.title(page), await h.notice(page)];
  };
  try {
    assert.equal((await tryWith(null))[0], 'Four Fables');
    assert.equal((await tryWith(null, h.SOFT))[0], 'Four Fables', 'a "not found" page is not a book');
    assert.equal((await tryWith(fs.readFileSync(path.join(dir, 'books', 'comic.cbz'))))[0], 'Four Fables', 'a ZIP without an EPUB inside');
    assert.equal((await tryWith(fs.readFileSync(path.join(dir, 'books', 'long.epub')).subarray(0, 600)))[0], 'Four Fables', 'a cut-off EPUB');
    assert.equal((await tryWith(fs.readFileSync(path.join(dir, 'books', 'long.epub'))))[0], 'The Long Book');
  } finally { fs.rmSync(target, { force: true }); }
});
