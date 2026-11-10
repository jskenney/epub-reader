// Opening files by address (REVIEW.md E-24): ?edit=path opens a document straight into the editor (a new one if it
// isn't there); ?get=address opens a book or document on this site or another (which must allow it with CORS).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const NOTES = fs.readFileSync(`${__dirname}/site/reader/books/notes.md`, 'utf8');
const text = page => page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
const ready = page => page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
const noticeText = page => page.evaluate(() => document.querySelector('#notice').hidden ? '' : document.querySelector('#noticeText').textContent);

test('?edit= opens a document on the site straight into the editor, found as ?book= finds it (E-24)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?edit=books/notes.md`);
  await ready(page);
  assert.equal(await text(page), NOTES);
  assert.equal(await page.textContent('#bookTitle'), 'Notes');
  // (In the bookshelf folder too.)
  await h.openReader(page, `${h.READER}?edit=second-shelf.md`.replace('/reader/index.html', '/folder-cfg/index.html'));
  await ready(page);
  assert.match(await text(page), /Second Shelf/);
});

test('?edit= for a file that isn\'t there starts a new, empty one with that name, in the text editor (E-24)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?edit=books/new-notes.md`);
  await ready(page);
  assert.equal(await text(page), '');
  assert.equal(await page.evaluate(() => document.querySelector('[data-mode="raw"]').getAttribute('aria-pressed')), 'true');
  assert.match(await page.textContent('#editName'), /new-notes\.md/);
  await page.click('#editSrc'); await page.keyboard.type('# Fresh\n\nWords.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(dl.suggestedFilename(), 'new-notes.md');
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), '# Fresh\n\nWords.');
});

test('?edit= refuses other kinds of file; an EPUB opens to read; with editing turned off the document opens to read and nothing is made (E-24)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?edit=books/thing.pdf`);
  assert.match(await noticeText(page), /can't be edited: \?edit= takes \.md, \.markdown, \.html, \.htm and \.txt files/);
  await h.openReader(page, `${h.READER}?edit=books/long.epub`);
  assert.equal(await h.title(page), 'The Long Book');
  assert.match(await noticeText(page), /EPUB's chapters can't be edited yet/);
  assert.equal(await page.isHidden('#editBar'), true);
  const off = `${h.SITE}/folder-noedit/index.html`;
  await h.openReader(page, `${off}?edit=/reader/books/notes.md`);
  assert.equal(await page.textContent('#bookTitle'), 'Notes');
  assert.match(await noticeText(page), /Editing is turned off/);
  assert.equal(await page.isHidden('#editBar'), true);
  await h.openReader(page, `${off}?edit=/reader/books/missing-one.md`);
  assert.match(await noticeText(page), /Nothing was found/);
  assert.equal(await page.isHidden('#editBar'), true);
});

test('?get= opens a document on this site as ?book= does, and one on another site that allows it, saying where it came from (E-24)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?get=books/notes.md`);
  assert.equal(await page.textContent('#bookTitle'), 'Notes');
  assert.equal(await noticeText(page), '');
  // (From the site with no reader policy: the other site is http://localhost:8791, which the nginx policy's
  // https: wouldn't cover.)
  await h.openReader(page, `${h.PLAIN}/reader/index.html?get=${h.SOFT}/reader/books/notes.md`);
  assert.equal(await page.textContent('#bookTitle'), 'Notes');
  assert.match(await noticeText(page), /This comes from localhost:8791, another site/);
  // It can be edited, and saved as a copy.
  await page.click('#editBtn'); await page.click('#editThis'); await ready(page);
  assert.equal(await text(page), NOTES);
  assert.match(await page.getAttribute('#editName', 'title'), /From localhost:8791/);
  // An EPUB from another site too.
  await h.openReader(page, `${h.PLAIN}/reader/index.html?get=${h.SOFT}/reader/books/long.epub`);
  assert.equal(await h.title(page), 'The Long Book');
  assert.match(await noticeText(page), /localhost:8791/);
});

test('?get= from a site that doesn\'t allow it says so; the reader\'s policy refuses http from a policy site; a site can turn ?get= off (E-24)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.PLAIN}/reader/index.html?get=${h.SOFT}/nocors/doc.md`);
  assert.match(await noticeText(page), /didn't let this page read it \(the site has to allow it, with CORS headers\)/);
  await h.openReader(page, `${h.READER}?get=${h.SOFT}/reader/books/notes.md`);
  assert.match(await noticeText(page), /couldn't be opened/);
  await h.openReader(page, `${h.SITE}/folder-noget/index.html?get=/reader/books/notes.md`);
  assert.match(await noticeText(page), /doesn't open files by their address/);
});
