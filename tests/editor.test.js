// The editor (REVIEW.md E-21): Markdown, HTML and text documents edited as text (CodeMirror, or a plain text box),
// beside the page or alone; new documents; saving back to the file or a copy; drafts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const doc = name => `${h.READER}?book=books/${name}`;
const NOTES = fs.readFileSync(`${__dirname}/site/reader/books/notes.md`, 'utf8');
// The editor's text, and typing into it at the end.
const text = page => page.evaluate(() => { const c = document.querySelector('.CodeMirror'); return c ? c.CodeMirror.getValue() : document.querySelector('.edit-plain').value; });
async function typeAtEnd(page, s) {
  await page.click('#editSrc');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(s);
}
async function startEditing(page) {
  await page.click('#editBtn');
  await page.click('#editThis');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
}
const pageText = page => page.evaluate(() => document.querySelector('#page').contentDocument?.body?.innerText || '');
// A stand-in for the browser's file pickers: files are kept in window.__files (as text), and a file picked to open
// comes from window.__open.
function fakeFiles() {
  window.__files = {}; window.__writes = 0;
  const handle = name => ({ kind: 'file', name,
    async getFile() { return new File([window.__files[name] ?? window.__open?.[name] ?? ''], name, { type: '' }); },
    async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; },
    async createWritable() { let out = ''; return { async write(b) { out += typeof b === 'string' ? b : await b.text(); }, async close() { window.__files[name] = out; window.__writes++; }, async abort() {} }; } });
  window.showOpenFilePicker = async () => [handle(Object.keys(window.__open || {})[0])];
  window.showSaveFilePicker = async o => { window.__saveAs = o; return handle(o.suggestedName); };
}

test('the Edit button sits between Settings and Open; its menu edits a document or starts a new one (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'));
  const order = await page.evaluate(() => [...document.querySelector('.tools').children].map(e => e.id));
  assert.equal(order[order.indexOf('setBtn') + 1], 'editPick');
  assert.equal(order[order.indexOf('editPick') + 1], 'openBtn');
  await page.click('#editBtn');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#editMenu .opt')].map(o => [o.textContent, o.disabled])),
    [['Edit this document', false], ['New Markdown document', false], ['New HTML document', false]]);
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#editMenu'), true);
  // An EPUB can't be edited (yet): only new documents.
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.click('#editBtn');
  assert.equal(await page.isDisabled('#editThis'), true);
  // A site that turns editing off.
  await h.openReader(page, `${h.SITE}/folder-noedit/index.html?book=/reader/books/notes.md`);
  assert.equal(await page.isHidden('#editPick'), true);
});

test('editing a Markdown document: the text beside the page, which follows the text; keys type letters; layout is one long page (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, doc('notes.md'), { 'spine:layout': 'two' });
  await startEditing(page);
  assert.equal(await text(page), NOTES);
  assert.equal(await page.isVisible('#stage'), true, 'split: the page too');
  assert.equal(await page.isDisabled('#layoutBtn'), true);
  assert.equal(await page.evaluate(() => document.querySelector('#layoutBtn').dataset.layout), 'scroll');
  const theme = await page.evaluate(() => document.documentElement.dataset.theme || '');
  await typeAtEnd(page, '\n## Added ft\n\nNew words here.\n');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || ''), theme, 't typed, not the theme');
  assert.equal(await page.evaluate(() => !!document.fullscreenElement || document.querySelector('.app').classList.contains('fs')), false, 'f typed');
  assert.ok(await h.waitFor(async () => /New words here\./.test(await pageText(page)), 5000), 'the page follows the text');
  assert.match(await page.textContent('#tocList'), /Added ft/);
  assert.match(await page.textContent('#editName'), /unsaved/);
  assert.match(await page.title(), /^• notes\.md/);
  // Raw: the text alone, nothing to read aloud.
  await page.click('[data-view="raw"]');
  assert.equal(await page.isVisible('#stage'), false);
  assert.equal(await page.isDisabled('#ttsBtn'), true);
  await page.click('[data-view="split"]');
  assert.equal(await page.isVisible('#stage'), true);
});

test('Save without a file to write to downloads the text exactly; Done goes back to reading the saved text in the layout before (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'), { 'spine:layout': 'two' });
  await startEditing(page);
  await typeAtEnd(page, 'Plus one line.\n');
  const want = await text(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(dl.suggestedFilename(), 'notes.md');
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), want);
  await page.waitForFunction(() => !/unsaved/.test(document.querySelector('#editName').textContent));
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.equal(await page.evaluate(() => document.querySelector('#layoutBtn').dataset.layout), 'two');
  assert.ok(await h.waitFor(async () => /Plus one line\./.test(await pageText(page)), 5000));
});

test('a document opened through the file picker is saved back to its file; Save as asks for a new one (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeFiles);
  await page.addInitScript(t => { window.__open = { 'mine.md': t }; }, NOTES);
  await h.openReader(page, doc('notes.md'));
  await page.click('#openBtn');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Notes' && document.title === 'Notes');
  await startEditing(page);
  await typeAtEnd(page, 'Saved in place.\n');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 1);
  assert.equal(await page.evaluate(() => window.__files['mine.md']), NOTES + 'Saved in place.\n');
  assert.equal(await page.evaluate(() => window.__saveAs), undefined, 'no picker for Save');
  assert.match(await page.textContent('#editNote'), /Saved to mine\.md/);
  await page.click('#editSaveAs');
  await page.waitForFunction(() => window.__writes === 2);
  assert.equal(await page.evaluate(() => window.__saveAs.suggestedName), 'mine.md');
  assert.deepEqual(await page.evaluate(() => window.__saveAs.types[0].accept), { 'text/markdown': ['.md', '.markdown'] });
});

test('unsaved text is kept as a draft: offered when the document is opened again; Done asks before letting it go (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'));
  await startEditing(page);
  await typeAtEnd(page, 'Draft words.\n');
  await page.waitForTimeout(1200);   // (kept a moment after typing stops)
  // Done, declined: still editing. (A reload is asked about too: the browser's own prompt.)
  page.once('dialog', d => d.dismiss());
  await page.click('#editDone');
  assert.equal(await page.isVisible('#editBar'), true);
  await page.evaluate(() => { window.onbeforeunload = null; });
  await page.goto(doc('notes.md'), { waitUntil: 'load' }).catch(() => {});
  await h.waitForBook(page);
  await page.waitForFunction(() => !document.querySelector('#notice').hidden);
  assert.match(await page.textContent('#noticeText'), /unsaved changes from/);
  assert.equal(await page.textContent('#noticeAction'), 'Edit');
  page.once('dialog', d => d.accept());
  await page.click('#noticeAction');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  assert.equal(await text(page), NOTES + 'Draft words.\n');
  // Done, accepted: back to the document as it was, and the draft is gone.
  page.once('dialog', d => d.accept());
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.doesNotMatch(await pageText(page), /Draft words/);
  await page.reload(); await h.waitForBook(page); await page.waitForTimeout(500);
  assert.equal(await page.isHidden('#notice'), true);
});

test('new Markdown and HTML documents start from a small template and are saved under Untitled (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'));
  await page.click('#editBtn'); await page.click('#editNewMd');
  await page.waitForFunction(() => document.querySelector('#editBar').hasAttribute('data-ready'));
  assert.equal(await text(page), '# Untitled\n\n');
  assert.equal(await page.textContent('#bookTitle'), 'Untitled');
  await typeAtEnd(page, 'Hello.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editSave')]);
  assert.equal(dl.suggestedFilename(), 'Untitled.md');
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), '# Untitled\n\nHello.');
  await page.click('#editBtn'); await page.click('#editNewHtml');
  await page.waitForFunction(() => /<!DOCTYPE html>/.test(document.querySelector('.CodeMirror')?.CodeMirror.getValue() || '') && document.querySelector('#editBar').hasAttribute('data-ready'));
  assert.ok(await h.waitFor(async () => /Untitled/.test(await pageText(page)), 5000));
});

test('HTML is edited as written: nothing in it runs; saved as UTF-8, its charset says so (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('kept.html'));
  await startEditing(page);
  const original = await text(page);
  assert.match(original, /<script>window\.parent\.__ran = true;<\/script>/);
  assert.match(original, /onclick="alert\(1\)"/);
  assert.equal(await page.evaluate(() => window.__ran), undefined);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editSave')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), original.replace('charset="windows-1252"', 'charset="utf-8"'));
});

test('the reader\'s settings change the page and the text\'s size, not the text; contents entries go to their headings (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, doc('long-notes.md'));
  await startEditing(page);
  const before = await text(page);
  const size = () => page.evaluate(() => getComputedStyle(document.querySelector('.CodeMirror')).fontSize);
  const s0 = await size();
  await page.click('#larger');
  assert.notEqual(await size(), s0);
  await page.click('#themeBtn');
  assert.equal(await text(page), before);
  // A contents entry: the page goes there, and the text follows.
  await page.click('#tocList a:text-is("Part 20")');
  assert.ok(await h.waitFor(() => page.evaluate(() => {
    const cm = document.querySelector('.CodeMirror').CodeMirror;
    const line = cm.lineAtHeight(cm.getScrollInfo().top, 'local');
    return Math.abs(line - cm.getValue().split('\n').indexOf('## Part 20')) <= 6;
  }), 3000), 'the text scrolled to Part 20');
});

test('the text and the page scroll together, by block (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, doc('long-notes.md'));
  await startEditing(page);
  await page.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; const l = cm.getValue().split('\n').indexOf('## Part 12'); cm.scrollTo(null, cm.heightAtLine(l, 'local')); });
  assert.ok(await h.waitFor(() => page.evaluate(() => {
    const d = document.querySelector('#page').contentDocument, hd = [...d.querySelectorAll('h2')].find(x => x.textContent === 'Part 12');
    const t = hd.getBoundingClientRect().top; return t >= -5 && t < 60;
  }), 3000), 'Part 12 at the top of the page');
});

test('without CodeMirror, a plain text box does the same and says why (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.SPINE_TEST = { noCodeMirror: true }; window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'));
  await startEditing(page);
  assert.equal(await page.isVisible('.edit-plain'), true);
  assert.match(await page.textContent('#editNote'), /plain text box/);
  await page.click('.edit-plain'); await page.keyboard.press('Control+End'); await page.keyboard.type('Typed.');
  assert.ok(await h.waitFor(async () => /Typed\./.test(await pageText(page)), 5000));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), NOTES + 'Typed.');
});

test('reading aloud reads the page beside the text (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'), { 'spine:ttsEngine': 'server' });
  await startEditing(page);
  await h.clearBreezeLog();
  await page.click('#ttsBtn');
  await page.click('#ttsPlay');
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /Notes|Intro/.test(e.text)), 15000), 'reading the page');
});
