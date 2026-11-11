// Editing an EPUB's chapters (REVIEW.md E-23): the chapter shown is edited with E-21's editor; the book is saved
// re-packed (in place when it came from the file picker), or the chapter alone downloaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const RAW = { 'spine:editMode': 'raw' };
const text = page => page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
async function startEditing(page) {
  await page.click('#editBtn');
  assert.equal(await page.textContent('#editThis'), 'Edit this chapter');
  await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
}
// Replace a piece of the chapter's text in the code editor.
const replace = (page, from, to) => page.evaluate(([a, b]) => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(cm.getValue().replace(a, b)); }, [from, to]);
const pageText = page => page.evaluate(() => document.querySelector('#page').contentDocument?.body?.innerText || '');
// What a downloaded EPUB holds, read with Python's zipfile: names in order, compression, and some files' text.
function unzip(file, names) {
  const r = spawnSync('python3', ['-c', `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps({"order": [i.filename for i in z.infolist()], "stored": [i.filename for i in z.infolist() if i.compress_type == 0],
  "files": {n: z.read(n).decode("utf-8") for n in sys.argv[2:]}}))`, file, ...names], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const SRC = path.join(__dirname, 'site', 'reader', 'books', 'long.epub');

test('a chapter of an EPUB is edited as its XHTML; Done keeps it edited; Save gives the book re-packed with only that chapter changed (E-23)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, LONG, RAW);
  await startEditing(page);
  const original = await text(page);
  assert.match(original, /^<\?xml|<html/);
  assert.equal(await page.isVisible('#editChapter'), true);
  const para = original.match(/<p>([^<]{10,})<\/p>/)[1];
  await replace(page, para, 'An edited paragraph.');
  assert.ok(await h.waitFor(async () => /An edited paragraph\./.test(await pageText(page)), 5000), 'the page follows');
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.ok(await h.waitFor(async () => /An edited paragraph\./.test(await pageText(page)), 5000), 'shown as edited after Done');
  await page.waitForFunction(() => /1 chapter changed and not saved yet/.test(document.querySelector('#noticeText').textContent));
  // Save: the book re-packed.
  await startEditing(page);
  assert.match(await text(page), /An edited paragraph\./);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(dl.suggestedFilename(), 'long.epub');
  const file = await dl.path();
  const before = unzip(SRC, ['OEBPS/content.opf']).order;
  const chapter = (await page.evaluate(() => document.querySelector('#editName').textContent)).split(' — ')[0].replace(/^• /, '');
  const got = unzip(file, ['mimetype', `OEBPS/${chapter}`]);
  assert.equal(got.order[0], 'mimetype'); assert.deepEqual(got.stored, ['mimetype']);
  assert.equal(got.files.mimetype, 'application/epub+zip');
  assert.deepEqual([...got.order].sort(), [...before].sort());
  assert.equal(got.files[`OEBPS/${chapter}`], original.replace(para, 'An edited paragraph.'));
  // (The package gains dcterms:modified, this EPUB 3 package having none; everything else is as it was.)
  assert.match(unzip(file, ['OEBPS/content.opf']).files['OEBPS/content.opf'], /<meta property="dcterms:modified">\d{4}-/);
  for (const other of before.filter(n => !n.endsWith(chapter) && n !== 'mimetype' && !n.endsWith('.opf'))) {
    const r = spawnSync('python3', ['-c', 'import zipfile,sys; a=zipfile.ZipFile(sys.argv[1]).read(sys.argv[3]); b=zipfile.ZipFile(sys.argv[2]).read(sys.argv[3]); sys.exit(0 if a==b else 1)', SRC, file, other]);
    assert.equal(r.status, 0, `${other} unchanged`);
  }
  assert.doesNotMatch(await page.textContent('#editName'), /unsaved/);
  // The book as saved opens in the reader.
  await page.click('#editDone');
  await page.locator('#fileInput').setInputFiles(file);
  await h.waitForBook(page);
  assert.equal(await h.title(page), 'The Long Book');
});

test('a chapter that isn\'t well-formed XHTML isn\'t saved: the error gives its line and the cursor goes there; the chapter alone can be downloaded (E-23)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, LONG, RAW);
  await startEditing(page);
  await replace(page, '</p>', '<b></p>');
  let saved = false; page.on('download', () => { saved = true; });
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(500);
  assert.equal(saved, false);
  assert.match(await page.textContent('#noticeText'), /isn't well-formed XHTML \(line \d+, column \d+\)/);
  const line = +(await page.textContent('#noticeText')).match(/line (\d+)/)[1];
  assert.equal(await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getCursor().line + 1), line);
  // WYSIWYG waits for it too.
  await page.click('[data-mode="wysiwyg"]');
  assert.equal(await page.evaluate(() => document.querySelector('[data-mode="raw"]').getAttribute('aria-pressed')), 'true');
  await replace(page, '<b></p>', '</p>');
  const want = await text(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editChapter')]);
  assert.match(dl.suggestedFilename(), /\.xhtml$/);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), want);
});

test('an EPUB opened through the file picker is saved over its file, and reads on from the saved copy (E-23)', async () => {
  const page = await h.newPage();
  await page.addInitScript(b64 => {
    window.__files = {}; window.__writes = 0;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const handle = { kind: 'file', name: 'long.epub', async getFile() { return new File([bytes], 'long.epub', { type: 'application/epub+zip', lastModified: 1 }); },
      async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; },
      async createWritable() { const parts = []; return { async write(b) { parts.push(b); }, async close() { window.__files['long.epub'] = new Blob(parts).size; window.__writes++; }, async abort() {} }; } };
    window.showOpenFilePicker = async () => [handle];
    window.showSaveFilePicker = async () => { throw new Error('not asked'); };
  }, fs.readFileSync(SRC).toString('base64'));
  await h.openReader(page, `${h.READER}?book=books/notes.md`, RAW);
  await page.click('#openBtn');
  await h.waitForBook(page);
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'The Long Book');
  await startEditing(page);
  await replace(page, '</p>', ' Saved in place.</p>');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 1);
  assert.match(await page.textContent('#editNote'), /Saved the book to long\.epub/);
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  // Another chapter still reads (from the packed copy).
  await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => !!document.querySelector('#page').contentDocument.body.innerText.trim()), true);
});

test('WYSIWYG on a chapter keeps it well-formed XHTML, changed only where typed (E-23)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:editMode': 'wysiwyg' });
  await startEditing(page);
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('[contenteditable="true"]'));
  const original = await text(page);
  const p = page.frameLocator('#page').locator('h1').first();
  await p.click(); await page.keyboard.press('End'); await page.keyboard.type(' Typed.');
  await page.waitForTimeout(600);
  const back = await text(page);
  assert.equal(await page.evaluate(t => new DOMParser().parseFromString(t, 'application/xhtml+xml').getElementsByTagName('parsererror').length, back), 0);
  const norm = t => page.evaluate(x => new XMLSerializer().serializeToString(new DOMParser().parseFromString(x, 'application/xhtml+xml')), t);
  // (The browser may type the space as a no-break space.)
  assert.equal(await norm(back.replace(/[ \u00a0]Typed\./, '')), await norm(original));
  assert.match(back, /<h1>Chapter One[ \u00a0]Typed\.<\/h1>/);
});

test('while a chapter is edited the page stays on it; leaving the book with chapters unsaved asks; ?edit= opens an EPUB\'s chapter in the editor (E-23)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, RAW);
  await startEditing(page);
  const at = await page.textContent('#spinePos');
  await page.click('#tocList a >> nth=2');
  await page.waitForTimeout(400);
  assert.equal(await page.textContent('#spinePos'), at);
  assert.match(await page.textContent('#noticeText'), /being edited: Done first/);
  await replace(page, '</p>', ' Changed.</p>');
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.locator('#fileInput').setInputFiles({ name: 'x.md', mimeType: 'text/markdown', buffer: Buffer.from('# X\n') });
  await page.waitForTimeout(300);
  assert.match(asked, /1 edited chapter of this book isn't saved/);
  assert.equal(await h.title(page), 'The Long Book');
  await h.openReader(page, `${h.READER}?edit=books/long.epub`);
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'), null, { timeout: 15000 });
  assert.match(await text(page), /<\/html>/);
});

test('a folder book (an unpacked EPUB on the server) is saved as a packed EPUB (E-23)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?book=books/abc/`, RAW);
  await startEditing(page);
  await replace(page, '</p>', ' Folder edit.</p>');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.match(dl.suggestedFilename(), /\.epub$/);
  const got = unzip(await dl.path(), ['META-INF/container.xml']);
  assert.equal(got.order[0], 'mimetype');
  assert.match(got.files['META-INF/container.xml'], /rootfile/);
  assert.ok(got.order.some(n => /\.opf$/.test(n)), JSON.stringify(got.order));
});

// Round 24 review, loop 5.
async function editAndSave(page, book, from, to, files, { wysiwyg = false } = {}) {
  await h.openReader(page, `${h.READER}?book=books/${book}`, { 'spine:editMode': wysiwyg ? 'wysiwyg' : 'raw' });
  await startEditing(page);
  if (wysiwyg) {
    await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('[contenteditable="true"]'));
    await page.frameLocator('#page').locator('h1').first().click(); await page.keyboard.press('End'); await page.keyboard.type(to);
    await page.waitForTimeout(600);
  } else await replace(page, from, to);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  return unzip(await dl.path(), files);
}

test('a chapter with a wrapper keeps one wrapper; a UTF-16 or Latin-1 package and Latin-1 chapters stay readable; the package\'s own dcterms:modified is the one set (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  const w = await editAndSave(page, 'rv-wrap.epub', '', ' Typed', ['OEBPS/c1.xhtml'], { wysiwyg: true });
  assert.equal(w.files['OEBPS/c1.xhtml'].split('class="calibre"').length - 1, 1, w.files['OEBPS/c1.xhtml']);
  const u = await editAndSave(page, 'rv-u16.epub', 'Sixteen text.', 'Sixteen edited.', ['OEBPS/content.opf', 'OEBPS/c1.xhtml']);
  assert.match(u.files['OEBPS/content.opf'], /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(u.files['OEBPS/content.opf'], /<dc:title>Sixteen<\/dc:title>/);
  assert.match(u.files['OEBPS/content.opf'], /<meta property="dcterms:modified">\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ<\/meta><\/metadata>/, 'added, EPUB 3 having none');
  const l = await editAndSave(page, 'rv-latin.epub', 'au lait', 'au lait chaud', ['OEBPS/content.opf', 'OEBPS/c1.xhtml']);
  assert.match(l.files['OEBPS/c1.xhtml'], /^<\?xml version="1\.0" encoding="UTF-8"\?>.*Un café au lait chaud\./s);
  assert.match(l.files['OEBPS/content.opf'], /Brontë/);
  assert.match(l.files['OEBPS/content.opf'], /refines="#c" property="dcterms:modified">2001-01-01T00:00:00Z</);
  assert.doesNotMatch(l.files['OEBPS/content.opf'], /2002-02-02/);
  // (Python reads them as XML too.)
  const r = spawnSync('python3', ['-c', `import zipfile,sys,xml.dom.minidom as m
for f in sys.argv[1:]: pass`], { encoding: 'utf8' });
  assert.equal(r.status, 0);
});

test('an XHTML chapter named .html keeps <br/> through WYSIWYG; chapters kept malformed stop the book\'s save; fixed or SVG pages and encrypted chapters (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  const x = await editAndSave(page, 'rv-html.epub', '', ' Typed', ['OEBPS/c1.html'], { wysiwyg: true });
  assert.match(x.files['OEBPS/c1.html'], /<br ?\/>/); assert.match(x.files['OEBPS/c1.html'], /<hr ?\/>/);
  // A chapter kept malformed, then another saved: refused.
  await h.openReader(page, LONG, RAW);
  await startEditing(page);
  await replace(page, '</p>', '<b></p>');
  page.once('dialog', d => d.accept());
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown');
  await page.waitForTimeout(600);
  const pos = await page.textContent('#spinePos');
  if (!/spine 1\//.test(pos)) {
    await startEditing(page);
    let saved = false; page.on('download', () => { saved = true; });
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    assert.equal(saved, false);
    assert.match(await page.textContent('#noticeText'), /an edited chapter, isn't well-formed XHTML/);
  }
  // A fixed-layout page: raw only.
  await h.openReader(page, `${h.READER}?book=books/fixed.epub`, { 'spine:editMode': 'wysiwyg', 'spine:layout': 'one' });
  await startEditing(page);
  assert.equal(await page.isDisabled('[data-mode="wysiwyg"]'), true);
  assert.equal(await page.evaluate(() => document.querySelector('[data-mode="raw"]').getAttribute('aria-pressed')), 'true');
  // An encrypted chapter isn't edited.
  await h.openReader(page, `${h.READER}?book=books/rv-drm.epub`);
  await page.click('#editBtn'); await page.click('#editThis');
  await page.waitForTimeout(400);
  assert.match(await page.textContent('#noticeText'), /encrypted \(DRM\)/);
  assert.equal(await page.isHidden('#editBar'), true);
});

// Round 24 review, loop 6.
test('a folder book on a site that answers missing files with a page gets no such pages packed in; prefixed and differently cased packages get their date (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.SOFT}/reader/index.html?book=books/abc/`, RAW);
  await startEditing(page);
  await replace(page, '</p>', ' Soft edit.</p>');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const got = unzip(await dl.path(), []);
  assert.deepEqual(got.order.filter(n => n.startsWith('META-INF/')), ['META-INF/container.xml']);
  const p = await editAndSave(page, 'rq-prefix.epub', 'Prefixed text.', 'Prefixed edit.', ['OEBPS/content.opf']);
  assert.doesNotMatch(p.files['OEBPS/content.opf'], /2000-01-01/);
  assert.equal(p.files['OEBPS/content.opf'].split('dcterms:modified').length - 1, 1, p.files['OEBPS/content.opf']);
  const c = await editAndSave(page, 'rq-case.epub', 'Cased text.', 'Cased edit.', ['OEBPS/content.opf']);
  assert.doesNotMatch(c.files['OEBPS/content.opf'], /2000-01-01/);
});

test('switching Split on a fixed page doesn\'t keep Raw as the chosen mode (round 24 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/fixed.epub`, { 'spine:editMode': 'wysiwyg', 'spine:layout': 'one' });
  await startEditing(page);
  await page.click('#editSplit');
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:editMode')), '"wysiwyg"');
});

test('Discard on a chapter returns it to how it was last saved; other chapters stay edited (E-23)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, RAW);
  await startEditing(page);
  const original = await text(page);
  await replace(page, '</p>', ' Thrown away.</p>');
  page.once('dialog', d => d.accept());
  await page.click('#editDiscard');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.ok(await h.waitFor(async () => !/Thrown away/.test(await pageText(page)), 5000));
  await startEditing(page);
  assert.equal(await text(page), original);
});

test('a folder book with a file that can\'t be fetched isn\'t saved without it (round 25 review, M-119)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?book=books/abc/`, RAW);
  await startEditing(page);
  await replace(page, '</p>', ' Folder edit.</p>');
  await page.route('**/books/abc/OEBPS/c3.xhtml', r => r.fulfill({ status: 500, body: 'broken' }));   // (couldn't be fetched, not missing: M-124)
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('#notice').hidden && /c3\.xhtml couldn't be fetched/.test(document.querySelector('#noticeText').textContent), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  assert.equal(downloaded, false);
  assert.match(await page.textContent('#editName'), /unsaved/);
});

test('a folder book listing a file on another site, or one it doesn\'t have, is still saved, without them (round 25 review, M-124)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?book=books/abc-extra/`, RAW);
  await startEditing(page);
  await replace(page, '</p>', ' Folder edit.</p>');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const got = unzip(await dl.path(), []);
  assert.ok(got.order.includes('OEBPS/c3.xhtml'), JSON.stringify(got.order));
  assert.ok(!got.order.some(n => /clip\.mp4|gone\.png/.test(n)), JSON.stringify(got.order));
});

test('a book picked with no extension in its name is downloaded with .epub (round 25 review, loop 5)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?book=books/notes.md`, RAW);
  await page.setInputFiles('#fileInput', { name: 'mybook', mimeType: '', buffer: fs.readFileSync(SRC) });
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'The Long Book' && document.querySelector('#status').hidden);
  await startEditing(page);
  await replace(page, '</p>', ' Edit.</p>');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(dl.suggestedFilename(), 'mybook.epub');
});

test('a book named like "My book v1.2" is downloaded with .epub added (".2" isn\'t its extension: round 25 review, L-344)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, `${h.READER}?book=books/notes.md`, RAW);
  await page.setInputFiles('#fileInput', { name: 'My book v1.2', mimeType: '', buffer: fs.readFileSync(SRC) });
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'The Long Book' && document.querySelector('#status').hidden);
  await startEditing(page);
  await replace(page, '</p>', ' Edit.</p>');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(dl.suggestedFilename(), 'My book v1.2.epub');
});
