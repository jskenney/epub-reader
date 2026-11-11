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

test('default.md when there is no default.epub, on servers with real and with "not found" pages; a configured list', async () => {
  const dir = path.join(__dirname, 'site', 'reader'), md = path.join(dir, 'default.md'), epub = path.join(dir, 'default.epub');
  const open = async (base = h.SITE, folder = 'reader') => { const page = await h.newPage(); await h.openReader(page, `${base}/${folder}/index.html`); return [await h.title(page), await h.notice(page)]; };
  try {
    fs.writeFileSync(md, '# The Default Notes\n\nOpened because there is no default.epub.\n');
    for (const base of [h.SITE, h.SOFT]) assert.deepEqual(await open(base), ['The Default Notes', ''], base);
    // default.epub comes first when both are there.
    fs.copyFileSync(path.join(dir, 'books', 'long.epub'), epub);
    assert.equal((await open())[0], 'The Long Book');
    fs.rmSync(epub); fs.rmSync(md);
    // Neither: the sample, also where every missing file answers 200 with a page.
    for (const base of [h.SITE, h.SOFT]) assert.equal((await open(base))[0], 'Four Fables', base);
    // A list from the folder's config, tried in order (on both kinds of server).
    for (const base of [h.SITE, h.SOFT]) assert.equal((await open(base, 'folder-list'))[0], 'story', base);   // (a text file is titled by its name)
  } finally { fs.rmSync(md, { force: true }); fs.rmSync(epub, { force: true }); }
});

test('books without an identifier keep separate positions even with the same title (L-13)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/twin-a.epub`);
  await page.click('#tocList a >> nth=2');   // part 3 of twin A
  // (The footer changes as the chapter starts loading; the position is saved once it has rendered.)
  await page.waitForFunction(() => Object.entries(localStorage).some(([k, v]) => k.startsWith('spine:pos:opf:') && JSON.parse(v).i === 2));
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('spine:pos:')));
  assert.ok(keys.some(k => /^spine:pos:opf:[0-9a-z]{16,}$/.test(k)), keys.join(' '));
  // Twin B starts at its beginning, not at twin A's place.
  await page.goto(`${h.READER}?book=books/twin-b.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 1\/2/);
  // Twin A still resumes at part 3.
  await page.goto(`${h.READER}?book=books/twin-a.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
  await page.keyboard.press('i');
  assert.match(await page.textContent('#infoSection'), /none \(the position is kept by the title and chapter files\)/);
});

// Where the position is saved, once the reader has saved it (T-7: no fixed waits).
// (The book's own key, not its looser record: localStorage lists keys in no fixed order.)
const savedAt = (page, i) => page.waitForFunction(i => Object.entries(localStorage).find(([k, v]) => k.startsWith('spine:pos:') && !k.startsWith('spine:pos:loose:') && JSON.parse(v)?.i === i)?.[0], i)
  .then(hd => hd.jsonValue());
const posKeys = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('spine:pos:') && !k.startsWith('spine:pos:loose:')).sort());

test('a position under an older key is moved over once, and the old key removed (L-13, M-10)', async () => {
  // The title key (the first versions) ...
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/twin-a.epub`, { 'spine:pos:Twin Title': { i: 1, f: 0 } });
  assert.match(await page.textContent('#spinePos'), /spine 2\/3/);
  const keys = await posKeys(page);
  assert.equal(keys.length, 1, keys.join(' '));
  assert.match(keys[0], /^spine:pos:opf:/, 'moved to the new key, and the title key removed');
  // ... so a second book with that title doesn't pick it up too.
  await page.goto(`${h.READER}?book=books/twin-b.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 1\/2/);
  // The fingerprint of the whole package file (the previous version).
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const fingerprint = new Function(`${src.slice(src.indexOf('function fingerprint('), src.indexOf('const isExternal'))}; return fingerprint;`)();
  const opf = require('node:child_process').execFileSync('unzip', ['-p', path.join(__dirname, 'site', 'reader', 'books', 'twin-a.epub'), 'OEBPS/content.opf'], { encoding: 'utf8' });
  const page2 = await h.newPage();
  await h.openReader(page2, `${h.READER}?book=books/twin-a.epub`, { [`spine:pos:opf:${fingerprint(opf)}`]: { i: 2, f: 0 } });
  assert.match(await page2.textContent('#spinePos'), /spine 3\/3/);
  const keys2 = await posKeys(page2);
  assert.equal(keys2.length, 1, keys2.join(' '));
  assert.notEqual(keys2[0], `spine:pos:opf:${fingerprint(opf)}`);
});

test("a book without an identifier keeps its position after a metadata edit, or after being given one (M-10)", async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/twin-a.epub`);
  await page.click('#tocList a >> nth=2');
  const key = await savedAt(page, 2);
  // A new author, a date and a cover: same title and chapters, so the same key.
  await page.goto(`${h.READER}?book=books/twin-a-edited.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
  assert.deepEqual(await posKeys(page), [key]);
  // Its last chapter edited (so a new key): found again by title, files and leading chapters, under its new key.
  await page.goto(`${h.READER}?book=books/twin-a-last.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
  const keysNow = await posKeys(page);
  assert.equal(keysNow.length, 2, keysNow.join(' '));
  assert.ok(keysNow.includes(key), 'the old key is kept: the old file may still be read');
  // The same title and file names but different text: another book, starting at its beginning.
  await page.goto(`${h.READER}?book=books/twin-c.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 1\/3/);
  // Given an identifier: the position is copied to it, and kept for a copy without one.
  await page.goto(`${h.READER}?book=books/twin-a-uid.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
  assert.ok((await posKeys(page)).some(k => k.startsWith('spine:pos:id:')));   // (the identifier, hashed: round 25 review, L-311)
  await page.goto(`${h.READER}?book=books/twin-a.epub`); await h.waitForBook(page);
  assert.match(await page.textContent('#spinePos'), /spine 3\/3/);
});

test('books sharing a title, file names and cover page, but not their text, keep their own positions (L-31)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/cover-x.epub`);
  await page.click('#tocList a >> nth=2');
  await savedAt(page, 2);
  for (const [book, want] of [['cover-y', /spine 1\/3/], ['cover-x', /spine 3\/3/], ['cover-y', /spine 1\/3/]]) {
    await page.goto(`${h.READER}?book=books/${book}.epub`); await h.waitForBook(page);
    assert.match(await page.textContent('#spinePos'), want, book);
  }
});

test('positions not read for KEEP_POSITIONS_DAYS are forgotten; older ones without a time get one (L-36)', async () => {
  const page = await h.newPage();
  const day = 86400000, now = Date.now();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, {
    'spine:pos:opf:stale': { i: 1, f: 0, t: now - 800 * day }, 'spine:pos:urn:recent': { i: 2, f: 0, t: now - 10 * day },
    'spine:pos:Old Title': { i: 0, f: 0.5 } });
  const kept = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('spine:pos:')).map(k => [k, JSON.parse(localStorage.getItem(k))])));
  assert.equal(kept['spine:pos:opf:stale'], undefined, 'not read for 800 days: forgotten');
  assert.equal(kept['spine:pos:urn:recent'].i, 2);
  assert.ok(kept['spine:pos:Old Title'].t > now - day, 'an old entry without a time is given one, not removed');
  assert.ok(kept['spine:pos:urn:long'] === undefined || kept['spine:pos:urn:long'].t > now - day);
});

test('a book that finishes loading after another was opened does not replace it (M-15)', async () => {
  const page = await h.newPage();
  await h.openReader(page);
  // The link's book is slow to arrive; a file is opened meanwhile.
  let first = true;   // (only its first request: the rest of it then arrives at once)
  await page.route('**/books/long.epub', async route => { if (first) { first = false; await new Promise(r => setTimeout(r, 2500)); } await route.continue(); });
  const tmp = path.join(require('node:os').tmpdir(), `spine-race-${Date.now()}.txt`);
  fs.writeFileSync(tmp, 'Opened second\n\nThis file was opened while the other book was still loading.');
  try {
    await page.goto(`${h.READER}?book=books/long.epub`);
    await page.waitForTimeout(300);
    await page.setInputFiles('#fileInput', tmp);
    await page.waitForFunction(() => /Opened second|spine-race/.test(document.querySelector('#bookTitle').textContent), null, { timeout: 10000 });
    const now = await h.title(page);
    await page.waitForTimeout(4000);   // the slow book has arrived by now
    assert.equal(await h.title(page), now);
    assert.equal(await h.notice(page), '');
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('books with an identifier still use it, so they resume wherever they are opened from (L-13)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.click('#tocList a >> nth=1');
  assert.match(await savedAt(page, 1), /^spine:pos:id:/);
  await page.goto(`${h.READER}?book=books/shelf-only.epub`); await h.waitForBook(page);   // a copy of the same book
  assert.match(await page.textContent('#spinePos'), /spine 2\/3/);
});

test("a bad ?book= link opens the folder's default.epub, with a note about the link (L-14)", async () => {
  const target = path.join(__dirname, 'site', 'reader', 'default.epub');
  fs.copyFileSync(path.join(__dirname, 'site', 'reader', 'books', 'long.epub'), target);
  try {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/nothing.epub`);
    assert.equal(await h.title(page), 'The Long Book');
    assert.match(await h.notice(page), /books\/nothing.epub couldn't be opened\. Nothing was found/);
  } finally { fs.rmSync(target, { force: true }); }
});

test('a missing file with "&" or "\'" in its name is still recognised on a site that answers with a "not found" page (L-80)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SOFT}/reader/index.html?book=books/Alice's%20%26%20Bob.html`);
  assert.equal(await h.title(page), 'Four Fables', 'the "not found" page is not opened as the book');
  assert.match(await h.notice(page), /couldn't|not found|isn't/i);
});

test('an extracted book in a folder named with ";" and "," shows its pictures (L-81)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/semi%3Bcolon%2Ccomma/`);
  assert.equal(await h.title(page), 'Pictures');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument.querySelector('img.pic')?.naturalWidth > 0, null, { timeout: 5000 });
  assert.deepEqual(page.cspViolations, []);
});

test('without the ZIP library, text files and EPUBs read in place still open; the sample says why it can\'t (L-82)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-nocdn/index.html?book=/reader/books/plain.txt`);
  assert.match(await h.inFrame(page, doc => doc.body.innerText), /It was a dark night/);
  await h.openReader(page, `${h.SITE}/folder-nocdn/index.html?book=/reader/books/long.epub`);
  assert.equal(await h.title(page), 'The Long Book');
  await h.openReader(page, `${h.SITE}/folder-nocdn/index.html`).catch(() => {});
  assert.match(await h.notice(page), /ZIP library isn't on this site/);
});

test('an empty DEFAULT_BOOK in a config is refused rather than opening the reader\'s own page (L-83)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-emptydefault/index.html`);
  assert.equal(await h.title(page), 'Four Fables');
});

test('another folder asked to keep positions forever (or longer): the site-wide sweep keeps them (L-77)', async () => {
  const page = await h.newPage();
  const day = 86400000, now = Date.now();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:pos:opf:stale': { i: 1, f: 0, t: now - 800 * day }, 'spine:keepDays': 0 });
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('spine:pos:opf:stale')));
  assert.equal(kept?.i, 1, 'kept: a folder said 0 (forever)');
});
