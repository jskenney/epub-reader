// The editor (REVIEW.md E-21): Markdown, HTML and text documents edited as text (CodeMirror, or a plain text box),
// beside the page or alone; new documents; saving back to the file or a copy; drafts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const doc = name => `${h.READER}?book=books/${name}`;
const RAW = { 'spine:editMode': 'raw' };   // (the text typed into; WYSIWYG is the default)
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
    // (A file's time as a disk keeps it: the same until it is written, or changed by the test in __mtime.)
    async getFile() { return new File([window.__files[name] ?? window.__open?.[name] ?? ''], name, { type: '', lastModified: window.__mtime?.[name] ?? 1 }); },
    async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; },
    async createWritable() { let out = ''; return { async write(b) { out += typeof b === 'string' ? b : await b.text(); }, async close() { await new Promise(r => setTimeout(r, window.__slow || 0)); window.__files[name] = out; window.__writes++; (window.__mtime ||= {})[name] = Date.now(); }, async abort() {} }; } });
  window.showOpenFilePicker = async () => [handle(Object.keys(window.__open || {})[0])];
  window.showSaveFilePicker = async o => { window.__saveAs = o; return handle(window.__saveName || o.suggestedName); };
}

test('the Edit button sits between Settings and Open; its menu edits a document or starts a new one (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'), RAW);
  const order = await page.evaluate(() => [...document.querySelector('.tools').children].map(e => e.id));
  assert.equal(order[order.indexOf('setBtn') + 1], 'editPick');
  assert.equal(order[order.indexOf('editPick') + 1], 'openBtn');
  await page.click('#editBtn');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#editMenu .opt')].map(o => [o.textContent, o.disabled])),
    [['Edit this document', false], ['New Markdown document', false], ['New HTML document', false]]);
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#editMenu'), true);
  // An EPUB: its chapter (E-23); a comic: only new documents.
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.click('#editBtn');
  assert.equal(await page.textContent('#editThis'), 'Edit this chapter');
  assert.equal(await page.isDisabled('#editThis'), false);
  await page.keyboard.press('Escape');
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`);
  await page.click('#editBtn');
  assert.equal(await page.isDisabled('#editThis'), true);
  // A site that turns editing off.
  await h.openReader(page, `${h.SITE}/folder-noedit/index.html?book=/reader/books/notes.md`);
  assert.equal(await page.isHidden('#editPick'), true);
});

test('editing a Markdown document: the text beside the page, which follows the text; keys type letters; layout is one long page (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, doc('notes.md'), { ...RAW, 'spine:layout': 'two' });
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
  await page.click('#editSplit');   // (split off: the text alone)
  assert.equal(await page.isVisible('#stage'), false);
  assert.equal(await page.isDisabled('#ttsBtn'), true);
  await page.click('#editSplit');
  assert.equal(await page.isVisible('#stage'), true);
});

test('Save without a file to write to downloads the text exactly; Done goes back to reading the saved text in the layout before (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'), { ...RAW, 'spine:layout': 'two' });
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
  await h.openReader(page, doc('notes.md'), RAW);
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

test('unsaved text is kept as a draft and offered when the document is opened again; Discard asks, then lets it go (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'), RAW);
  await startEditing(page);
  await typeAtEnd(page, 'Draft words.\n');
  await page.waitForTimeout(1200);   // (kept a moment after typing stops)
  // Discard, declined: still editing. (A reload is asked about too: the browser's own prompt.)
  page.once('dialog', d => d.dismiss());
  await page.click('#editDiscard');
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
  // Discard, accepted: back to the document as it was, and the draft is gone.
  page.once('dialog', d => d.accept());
  await page.click('#editDiscard');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.doesNotMatch(await pageText(page), /Draft words/);
  await page.reload(); await h.waitForBook(page); await page.waitForTimeout(500);
  assert.equal(await page.isHidden('#notice'), true);
});

test('Done keeps unsaved changes in the reading view, asks before another book, and Edit goes on from them; Discard returns to the saved text (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'), RAW);
  await startEditing(page);
  await typeAtEnd(page, 'Kept words.\n');
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.ok(await h.waitFor(async () => /Kept words\./.test(await pageText(page)), 5000), 'shown as edited');
  await page.waitForFunction(() => /changes not saved yet/.test(document.querySelector('#noticeText').textContent));
  // Edit again: the changes are there, still unsaved.
  await startEditing(page);
  assert.equal(await text(page), NOTES + 'Kept words.\n');
  assert.match(await page.textContent('#editName'), /unsaved/);
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  // Another book: asked first; declined, the document stays.
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.locator('#fileInput').setInputFiles({ name: 'x.md', mimeType: 'text/markdown', buffer: Buffer.from('# X\n') });
  await page.waitForTimeout(300);
  assert.match(asked, /notes\.md has unsaved changes/);
  assert.equal(await page.textContent('#bookTitle'), 'Notes');
  // Discard: the saved text again, nothing asked about after.
  await startEditing(page);
  page.once('dialog', d => d.accept());
  await page.click('#editDiscard');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.ok(await h.waitFor(async () => !/Kept words/.test(await pageText(page)), 5000));
  await page.locator('#fileInput').setInputFiles({ name: 'x.md', mimeType: 'text/markdown', buffer: Buffer.from('# X\n') });
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'X');
});

test('new Markdown and HTML documents start from a small template and are saved under Untitled (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'), RAW);
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
  await h.openReader(page, doc('kept.html'), RAW);
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
  await h.openReader(page, doc('long-notes.md'), RAW);
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
  await h.openReader(page, doc('long-notes.md'), RAW);
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
  await h.openReader(page, doc('notes.md'), RAW);
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
  await h.openReader(page, doc('notes.md'), { ...RAW, 'spine:ttsEngine': 'server' });
  await startEditing(page);
  await h.clearBreezeLog();
  await page.click('#ttsBtn');
  await page.click('#ttsPlay');
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /Notes|Intro/.test(e.text)), 15000), 'reading the page');
});

// WYSIWYG (phases 2 and 3): the page itself is edited.
const inPage = page => page.frameLocator('#page');
const flush = page => page.waitForTimeout(600);   // (the page's edits are written into the text a moment after typing)
async function wysiwyg(page, url, settings = {}) {
  await h.openReader(page, url, { 'spine:editMode': 'wysiwyg', 'spine:editSplit': true, ...settings });
  await startEditing(page);
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('[contenteditable="true"]'));
}

test('WYSIWYG is the default: the page is editable, the source read-only on its right; switching without typing keeps the text exactly (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  for (const name of ['notes.md', 'kept.html', 'corpus.md']) {
    await h.openReader(page, doc(name));
    await startEditing(page);
    const original = await text(page);
    assert.equal(await page.evaluate(() => document.querySelector('[data-mode="wysiwyg"]').getAttribute('aria-pressed')), 'true', name);
    assert.equal(await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getOption('readOnly')), true);
    const r = await page.evaluate(() => [document.querySelector('#stage').getBoundingClientRect().left, document.querySelector('#editSrc').getBoundingClientRect().left]);
    assert.ok(r[0] < r[1], 'the page on the left, the source on the right');
    await page.click('[data-mode="raw"]'); await page.waitForTimeout(300);
    await page.click('[data-mode="wysiwyg"]'); await page.waitForTimeout(300);
    await page.click('[data-mode="raw"]'); await page.waitForTimeout(300);
    assert.equal(await text(page), original, name);
    await page.click('[data-mode="wysiwyg"]'); await page.waitForTimeout(300);
    await page.click('#editDone');
  }
  // Plain text has no WYSIWYG.
  await h.openReader(page, doc('plain.txt'));
  await startEditing(page);
  assert.equal(await page.isDisabled('[data-mode="wysiwyg"]'), true);
  assert.equal(await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getOption('readOnly')), false);
});

test('WYSIWYG on HTML: typing changes the text; scripts, handlers, forms and the rest come back exactly; nothing runs (E-21)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await wysiwyg(page, doc('kept.html'));
  const original = await text(page);
  assert.equal(await inPage(page).locator('[data-ed-keep]').count(), 1, 'the script, as a locked chip');
  await inPage(page).locator('p', { hasText: 'Text.' }).click();
  await page.keyboard.press('End'); await page.keyboard.type(' More words.');
  await flush(page);
  assert.equal(await text(page), original.replace('Text.</p>', 'Text. More words.</p>'));
  assert.match(await page.textContent('#editName'), /unsaved/);
  assert.equal(await page.evaluate(() => window.__ran), undefined);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editSave')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), original.replace('Text.</p>', 'Text. More words.</p>').replace('charset="windows-1252"', 'charset="utf-8"'));
});

test('WYSIWYG on Markdown: formatting buttons and typing become Markdown; links keep their own addresses (E-21)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  // Bold, on a word chosen by double-clicking it.
  await inPage(page).locator('p', { hasText: 'Text.' }).dblclick({ position: { x: 5, y: 5 } });
  await page.click('[data-cmd="bold"]');
  await flush(page);
  assert.equal(await text(page), NOTES.replace('Text.', '**Text**.'));
  // A link made on a selection, through the Link button.
  await inPage(page).locator('h2', { hasText: 'Later' }).click();
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('See here');
  await page.keyboard.press('Shift+Home');
  page.once('dialog', d => d.accept('https://example.com/x'));
  await page.click('[data-cmd="link"]');
  await flush(page);
  assert.match(await text(page), /## Later\n\n\[See here\]\(https:\/\/example\.com\/x\)\n\nThe end\.\n$/);
  assert.match(await text(page), /\[link\]\(#later\)/, 'the in-page link as written, not as the reader marked it');
  // A heading made from a paragraph.
  await inPage(page).locator('p', { hasText: 'The end.' }).click();
  await page.selectOption('#editBlock', 'h3');
  await flush(page);
  assert.match(await text(page), /\n### The end\.\n$/);
  assert.match(await page.textContent('#tocList'), /The end\./);
});

test('Markdown written back from the page makes the same HTML as the original, for every construct (E-21)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('corpus.md'));
  const original = await text(page);
  // (Something typed and taken back, so the text is written from the page.)
  await inPage(page).locator('p', { hasText: 'Final paragraph' }).click();
  await page.keyboard.press('End'); await page.keyboard.type('x'); await page.keyboard.press('Backspace');
  await flush(page);
  const back = await text(page);
  assert.notEqual(back, original, 'written from the page');
  const html = await page.evaluate(([a, b]) => {
    const norm = md => { const d = new DOMParser().parseFromString(window.marked.parse(md, { gfm: true }), 'text/html'); return d.body.innerHTML.replace(/\s+/g, ' ').replace(/> </g, '><').trim(); };
    return [norm(a), norm(b)];
  }, [original, back]);
  assert.equal(html[1], html[0], back);
});

test('pasted HTML brings only text and simple formatting: no scripts, handlers or styles (E-21)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  await inPage(page).locator('p', { hasText: 'The end.' }).click();
  await page.keyboard.press('End');
  await inPage(page).locator('p', { hasText: 'The end.' }).evaluate(el => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<meta charset="utf-8"><!--StartFragment--><span style="color:red" onclick="parent.__p=1"> Pasted <b class="c">bold</b><script>parent.__p=1</script><img src="x" onerror="parent.__p=1"></span><!--EndFragment-->');
    dt.setData('text/plain', ' Pasted bold');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await flush(page);
  const html = await inPage(page).locator('p', { hasText: 'Pasted' }).evaluate(el => el.innerHTML);
  assert.doesNotMatch(html, /script|onclick|onerror|style=|class=/);
  assert.match(await text(page), /The end\. ?Pasted \*\*bold\*\*!\[\]\(x\)\n$/);
  assert.doesNotMatch(await text(page), /style|class|onclick|onerror|script/);
  assert.equal(await page.evaluate(() => window.__p), undefined);
  // A link to a file beside the document: not resolved against the reader's site in the page; written as it was.
  await inPage(page).locator('p', { hasText: 'Pasted' }).evaluate(el => {
    const dt = new DataTransfer(); dt.setData('text/html', ' <a href="other.md">other</a>'); dt.setData('text/plain', ' other');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await flush(page);
  assert.equal(await inPage(page).locator('a', { hasText: 'other' }).getAttribute('href'), null);
  assert.match(await text(page), /\[other\]\(other\.md\)\n$/);
});

test('links in the page being edited are not followed; the chips can\'t be typed into (E-21)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  const at = () => page.evaluate(() => document.querySelector('#page').contentDocument.scrollingElement.scrollTop);
  const before = await at();
  await inPage(page).locator('a', { hasText: 'link' }).click();
  await page.waitForTimeout(400);
  assert.ok(Math.abs(await at() - before) < 40, 'not scrolled to the link\'s target');
  await wysiwyg(page, doc('kept.html'));
  assert.equal(await inPage(page).locator('[data-ed-keep]').getAttribute('contenteditable'), 'false');
});

test('reading aloud goes on while the page is edited, and reads the edited sentence as it now is (E-21)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await wysiwyg(page, doc('long-notes.md'), { 'spine:ttsEngine': 'server', 'spine:set:LOOKAHEAD_SEC': 0 });
  await h.clearBreezeLog();
  await page.click('#ttsBtn');   // (opens the bar and starts reading at the top of the page)
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).length > 0, 20000), 'reading');
  const first = (await h.breezeLog())[0].text, part = +(first.match(/[Pp]art (\d+)/)?.[1] || 1);
  // A sentence a little further on, not yet read, is changed.
  await inPage(page).locator('p', { hasText: `Paragraph 2 of part ${part + 1},` }).click();
  await page.keyboard.press('End'); await page.keyboard.type(' Edited now.');
  await flush(page);
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /Edited now\./.test(e.text)), 45000), JSON.stringify((await h.breezeLog()).map(e => e.text)));
  const log = (await h.breezeLog()).map(e => e.text);
  assert.equal(log.filter(t => t === first).length, 1, `not started again: ${JSON.stringify(log)}`);
  assert.ok(!log.some(t => new RegExp(`^Paragraph 2 of part ${part + 1},.*\\.$`).test(t) && !/Edited now/.test(t)), 'the sentence as it was isn\'t read');
});

// Round 24 review: write-back.
async function typedRoundTrip(page, name, settings = {}) {
  await wysiwyg(page, doc(name), settings);
  const original = await text(page);
  await inPage(page).locator('p', { hasText: 'Start.' }).first().click();
  await page.keyboard.press('End'); await page.keyboard.type(' Typed.');
  await flush(page);
  return [original, await text(page)];
}
const sameHtml = (page, a, b) => page.evaluate(([x, y]) => {
  // (The empty comment that keeps two lists apart says nothing.)
  const norm = md => new DOMParser().parseFromString(window.marked.parse(md, { gfm: true }), 'text/html').body.innerHTML.replace(/<!-- -->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  return [norm(x), norm(y)];
}, [a, b]);

test('written back exactly: kept elements inside an SVG and a table, <body in a comment and an attribute, comments, a fragment, a document\'s own data-ed-keep, a <pre> starting with blank lines (round 24 review)', async () => {
  const page = await h.newPage();
  for (const name of ['trap.html', 'comments.html', 'frag.html', 'keepattr.html']) {
    const [original, back] = await typedRoundTrip(page, name);
    assert.equal(back, original.replace('Start.', 'Start. Typed.'), name);
  }
  // XHTML stays well-formed XML, with what was written (empty elements as the XML serializer writes them).
  const [ox, bx] = await typedRoundTrip(page, 'doc.xhtml');
  const xml = t => page.evaluate(x => { const d = new DOMParser().parseFromString(x, 'application/xml'); return d.getElementsByTagName('parsererror').length ? 'not well-formed' : new XMLSerializer().serializeToString(d); }, t);
  assert.equal(await xml(bx.replace(' Typed.', '')), await xml(ox));
  assert.match(bx, /^<\?xml version="1\.0" encoding="utf-8"\?>\n<!DOCTYPE html>\n<html xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">\n<head><title>X<\/title><\/head>\n<body>\n/);
  // (The body as the browser writes it: <rect/> as <rect></rect>, a <tbody> added; the style stays in the SVG,
  // the script in the table.)
  const [original, back] = await typedRoundTrip(page, 'svg-table.html');
  const dom = t => page.evaluate(x => new DOMParser().parseFromString(x, 'text/html').documentElement.outerHTML, t);
  assert.equal(await dom(back), await dom(original.replace('Start.', 'Start. Typed.')));
  assert.match(back, /<defs><style>\.c\{fill:red\}<\/style><\/defs>/);
  assert.match(back, /<tr><td>a<\/td><\/tr><script>var x=1<\/script><tr>/);
  // Markup after </body>: written once, inside the body.
  const [, after] = await typedRoundTrip(page, 'after.html');
  assert.equal(after.split('track()').length - 1, 1, after);
  assert.match(after, /<p>Start\. Typed\.<\/p>/);
});

test('Markdown written back: comments, a wrapper, escapes, emphasis, separate lists, list starts, breaks in cells, no-break spaces (round 24 review)', async () => {
  const page = await h.newPage();
  for (const name of ['comments.md', 'wrap.md', 'corpus2.md']) {
    const [original, back] = await typedRoundTrip(page, name);
    const [want, got] = await sameHtml(page, original.replace('Start.', 'Start. Typed.'), back);
    assert.equal(got, want, `${name}:\n${back}`);
  }
});

test('a Markdown document starting with a rule keeps it a rule, not front matter, however often it is written back (round 24 review)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('hr.md'));
  for (const s of [' one', ' two']) {
    await inPage(page).locator('p', { hasText: 'Body' }).click();
    await page.keyboard.press('End'); await page.keyboard.type(s);
    await flush(page);
  }
  assert.equal(await text(page), '***\n\nIntro text\n\n***\n\nBody one two\n');
});

test('Enter at the end of a paragraph, and a line break at the end of one, leave no backslash (round 24 review)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  await inPage(page).locator('p', { hasText: 'Text.' }).click();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await flush(page);
  assert.equal(await text(page), NOTES.replace('Text.', 'Text.'), 'an empty paragraph says nothing');
  await inPage(page).locator('p', { hasText: 'Text.' }).click();
  await page.keyboard.press('End'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('y'); await page.keyboard.press('Shift+Enter');
  await flush(page);
  assert.match(await text(page), /\nText\.\\\ny\n\n## Later/);
});

test('a meta describing charsets, a data-charset attribute and a commented-out meta are left alone when saving as UTF-8 (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  const [original] = await typedRoundTrip(page, 'meta.html');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editSave')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), original.replace('Start.', 'Start. Typed.').replace('<meta charset="windows-1252">', '<meta charset="utf-8">'));
});

test('a paragraph made a heading keeps its id and class; link addresses that aren\'t web, e-mail or relative are refused (round 24 review)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('ids.html'));
  await inPage(page).locator('h2').click();
  await page.selectOption('#editBlock', 'h3');
  await flush(page);
  assert.match(await text(page), /<h3 id="hh" class="big">Heading<\/h3>/);
  const before = await text(page);
  await inPage(page).locator('p', { hasText: 'Start.' }).dblclick({ position: { x: 5, y: 5 } });
  page.once('dialog', d => d.accept('java\tscript:alert(1)'));
  await page.click('[data-cmd="link"]');
  await flush(page);
  assert.equal(await text(page), before);
  assert.match(await page.textContent('#noticeText'), /Links can go to/);
});

// Round 24 review: flows.
test('while a save is being written, Done and opening another book wait; typing meanwhile keeps a draft (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeFiles);
  await page.addInitScript(t => { window.__open = { 'mine.md': t }; window.__slow = 1500; }, NOTES);
  await h.openReader(page, doc('notes.md'), RAW);
  await page.click('#openBtn');
  await page.waitForFunction(() => document.title === 'Notes');
  await startEditing(page);
  await typeAtEnd(page, 'One.\n');
  await page.keyboard.press('Control+s');
  await page.click('#editDone');
  assert.match(await page.textContent('#noticeText'), /still being saved/);
  assert.equal(await page.isVisible('#editBar'), true);
  await page.locator('#fileInput').setInputFiles({ name: 'other.md', mimeType: 'text/markdown', buffer: Buffer.from('# Other\n') });
  await page.waitForTimeout(200);
  assert.equal(await page.textContent('#bookTitle'), 'Notes', 'still this document');
  await typeAtEnd(page, 'Two.\n');
  await page.waitForFunction(() => window.__writes === 1);
  assert.equal(await page.evaluate(() => window.__files['mine.md']), NOTES + 'One.\n');
  await page.waitForTimeout(1200);
  const drafts = await page.evaluate(() => new Promise(res => { const rq = indexedDB.open('spine-drafts', 1); rq.onsuccess = () => { const g = rq.result.transaction('drafts').objectStore('drafts').getAll(); g.onsuccess = () => res(g.result.map(d => d.text)); }; }));
  assert.deepEqual(drafts, [NOTES + 'One.\nTwo.\n']);
});

test('drafts belong to the text they were made from: offered after a save, not to another file with the same name (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'), RAW);
  const open = async t => { await page.locator('#fileInput').setInputFiles({ name: 'same.md', mimeType: 'text/markdown', buffer: Buffer.from(t) }); await page.waitForFunction(x => document.querySelector('#bookTitle').textContent === x, t.slice(2, t.indexOf('\n'))); await page.waitForTimeout(400); };
  await open('# A\n\nFirst.\n');
  await startEditing(page);
  await typeAtEnd(page, 'Saved.\n');
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  await typeAtEnd(page, 'Later.\n');
  await page.waitForTimeout(1200);
  await page.goto(doc('notes.md')); await h.waitForBook(page);
  await open('# B\n\nOther file.\n');
  assert.equal(await page.isHidden('#notice'), true, 'not offered to another file');
  await open('# A\n\nFirst.\nSaved.\n');
  await page.waitForFunction(() => !document.querySelector('#notice').hidden);
  assert.match(await page.textContent('#noticeText'), /unsaved changes/);
});

test('WYSIWYG takes the typing at once; Ctrl+F there opens the reader\'s search; R does nothing with no page shown; Done gives the focus back to Edit (round 24 review)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  const theme = await page.evaluate(() => document.documentElement.dataset.theme || '');
  await page.keyboard.type('zz');
  await flush(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || ''), theme);
  assert.match(await text(page), /zz/);
  await page.keyboard.press('Control+f');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'searchBox');
  await page.keyboard.press('Escape');
  await page.click('[data-mode="raw"]'); await page.waitForTimeout(300);
  await page.click('#editSplit');   // (split off: no page)
  await page.keyboard.press('r');
  assert.equal(await page.isHidden('#tts'), true);
  // The editor bar's arrow keys move along it, not the page.
  await page.focus('[data-mode="wysiwyg"]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), 'raw');
  page.once('dialog', d => d.accept());
  await page.click('#editDone');
  await page.waitForFunction(() => document.querySelector('#editBar').hidden);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'editBtn');
});

test('on a narrow screen WYSIWYG shows the page it edits; leaving right after typing still keeps a draft (round 24 review)', async () => {
  const page = await h.newPage({ viewport: { width: 420, height: 800 } });
  await wysiwyg(page, doc('notes.md'));
  assert.equal(await page.isVisible('#stage'), true);
  assert.equal(await page.isVisible('#editSrc'), false);
  assert.equal(await page.isVisible('#editTools'), true);
  await page.keyboard.type('Quick ');
  await page.goto(doc('notes.md')); await h.waitForBook(page);
  await page.waitForFunction(() => !document.querySelector('#notice').hidden);
  assert.match(await page.textContent('#noticeText'), /unsaved changes/);
});

// (The fake device voice of speech.test.js: every utterance is recorded, none cached.)
function fakeSpeech() {
  const voices = [{ name: 'Plain Voice', lang: 'en-US', voiceURI: 'plain', default: true, localService: true },
    { name: 'Natural Voice', lang: 'en-GB', voiceURI: 'natural', default: false, localService: true },
    { name: 'Voix', lang: 'fr-FR', voiceURI: 'fr', default: false, localService: true }];
  let timer = null, current = null;
  window.__spoken = [];
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    addEventListener() {}, removeEventListener() {},
    cancel() { clearTimeout(timer); if (current) { const u = current; current = null; u.onerror?.({ error: 'interrupted' }); } this.speaking = false; },
    pause() {}, resume() {},
    speak(u) {
      current = u; this.speaking = true;
      window.__spoken.push({ text: u.text, voice: u.voice?.name || null, rate: u.rate, lang: u.lang });
      const words = [...u.text.matchAll(/\S+/g)];
      let k = 0;
      const step = () => {
        if (current !== u) return;
        if (k < words.length) { const w = words[k++]; u.onboundary?.({ name: 'word', charIndex: w.index, charLength: w[0].length }); timer = setTimeout(step, 40); }
        else { current = null; synth.speaking = false; u.onend?.({}); }
      };
      timer = setTimeout(step, 10);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  // (The real utterance only takes real voices.)
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; } };
}
test('reading aloud while typing in Raw beside the page doesn\'t say a sentence twice (round 24 review)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(fakeSpeech);
  await h.openReader(page, doc('long-notes.md'), { ...RAW, 'spine:ttsEngine': 'device' });
  await startEditing(page);
  await page.click('#ttsBtn');
  assert.ok(await h.waitFor(() => page.evaluate(() => window.__spoken.length > 0), 20000), 'reading');
  for (let k = 0; k < 4; k++) { await typeAtEnd(page, `Added ${k}. `); await page.waitForTimeout(1200); }
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => window.__spoken.map(u => u.text));
  assert.ok(log.length >= 3, JSON.stringify(log));
  assert.equal(new Set(log).size, log.length, `a sentence said twice: ${JSON.stringify(log)}`);
});

test('after Save as, the information gives the new file name (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeFiles);
  await page.addInitScript(() => { window.__saveName = 'copy.md'; });
  await h.openReader(page, doc('notes.md'), RAW);
  await startEditing(page);
  await page.click('#editSaveAs');
  await page.waitForFunction(() => window.__writes === 1);
  assert.match(await page.textContent('#editName'), /copy\.md/);
  assert.match(await page.textContent('#infoList'), /copy\.md/);
});

// Round 24 review, loop 2.
test('a wrapper with a script or comment beside it keeps both; a wrapper of blocks keeps Markdown inside; a doctype-only document keeps its doctype (round 24 review)', async () => {
  const page = await h.newPage();
  for (const name of ['wrapscript.html', 'minimal.html', 'dotted.html', 'after2.html']) {
    const [original, back] = await typedRoundTrip(page, name);
    if (name === 'after2.html') {
      assert.match(back, /<!-- generated by tool -->/); assert.match(back, /<!-- trailing -->/);
      assert.equal(back.split('track()').length - 1, 1, back);
    } else assert.equal(back, original.replace('Start.', 'Start. Typed.'), name);
  }
  const [, md] = await typedRoundTrip(page, 'wrapscript.md');
  assert.match(md, /<div class="x">/); assert.match(md, /<!-- keep me -->/); assert.match(md, /<script>a\(\)<\/script>/);
  // (A <body> inside a <noscript> in the head: the head is kept as written.)
  const [, ns] = await typedRoundTrip(page, 'noscript.html');
  assert.match(ns, /<noscript><body class="nojs"><\/noscript>\n<\/head>\n<body>\n/);
  const [, wrap] = await typedRoundTrip(page, 'wrap.md');
  assert.match(wrap, /^<div align="center">\n\n# Centered\n\nStart\. Typed\.\n\n<\/div>\n$/);
});

test('XHTML keeps its prefixes and kept elements as written (round 24 review)', async () => {
  const page = await h.newPage();
  const [original, back] = await typedRoundTrip(page, 'ns.xhtml');
  assert.equal(back, original.replace('Start.', 'Start. Typed.'));
});

test('Markdown written back escapes only what needs it, and keeps emphasis inside words (round 24 review)', async () => {
  const page = await h.newPage();
  const [original, back] = await typedRoundTrip(page, 'plainish.md');
  assert.match(back, /snake_case_names, a > b, 5 < 6, a\|b, 2 \\\* 3 and un\*believ\*able\./);
  const [want, got] = await sameHtml(page, original.replace('Start.', 'Start. Typed.'), back);
  assert.equal(got, want, back);
});

test('a draft made after a save that downloaded a copy is offered again; a link added while editing can be changed (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('notes.md'), RAW);
  await startEditing(page);
  await typeAtEnd(page, 'Part A.\n');
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  await typeAtEnd(page, 'Part B.\n');
  await page.waitForTimeout(1200);
  await page.goto(doc('notes.md')); await h.waitForBook(page);
  await page.waitForFunction(() => !document.querySelector('#notice').hidden);
  assert.match(await page.textContent('#noticeText'), /unsaved changes/);
  // A link made, then changed.
  await wysiwyg(page, doc('notes.md'));
  await inPage(page).locator('p', { hasText: 'Text.' }).dblclick({ position: { x: 5, y: 5 } });
  page.once('dialog', d => d.accept('other.md'));
  await page.click('[data-cmd="link"]');
  await flush(page);
  await inPage(page).locator('a', { hasText: 'Text' }).click();
  let asked = '';
  page.once('dialog', d => { asked = d.defaultValue(); d.accept('https://example.com/'); });
  await page.click('[data-cmd="link"]');
  await flush(page);
  assert.equal(asked, 'other.md');
  assert.match(await text(page), /\[Text\]\(https:\/\/example\.com\/\)\./);
});

test('a cancelled Save as leaves the text as it was; the name has room on a narrower screen; arrows pass the paragraph style (round 24 review)', async () => {
  const page = await h.newPage({ viewport: { width: 600, height: 800 } });
  await page.addInitScript(() => { window.showSaveFilePicker = async () => { throw Object.assign(new Error('no'), { name: 'AbortError' }); }; });
  await h.openReader(page, doc('kept.html'), RAW);
  await startEditing(page);
  const before = await text(page);
  await page.click('#editSaveAs');
  await page.waitForTimeout(300);
  assert.equal(await text(page), before);
  assert.doesNotMatch(await page.textContent('#editName'), /unsaved/);
  assert.ok(await page.evaluate(() => document.querySelector('#editName').getBoundingClientRect().width) >= 100);
  await page.click('[data-mode="wysiwyg"]'); await page.waitForTimeout(400);
  await page.focus('[data-cmd="bold"]');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'editBlock', 'past the select');
});

// Round 24 review, loop 3.
test('a backslash before emphasis, a link or code keeps them; comments before a doctype keep it; an SVG-less <animate> beside a wrapper stays where it was; script text is left alone by the charset change (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  const [o1, b1] = await typedRoundTrip(page, 'backslash.md');
  const [want, got] = await sameHtml(page, o1.replace('Start.', 'Start. Typed.'), b1);
  assert.equal(got, want, b1);
  const [o2, b2] = await typedRoundTrip(page, 'frag2.html');
  assert.equal(b2, o2.replace('Start.', 'Start. Typed.'));
  // (The <animate> stays beside the wrapper, once; the browser writes its attribute in lower case.)
  const [oa, ba] = await typedRoundTrip(page, 'animwrap.html');
  assert.equal(ba, oa.replace('Start.', 'Start. Typed.').replace('attributeName', 'attributename'));
  const [o3] = await typedRoundTrip(page, 'meta2.html');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#editSave')]);
  assert.equal(fs.readFileSync(await dl.path(), 'utf8'), o3.replace('Start.', 'Start. Typed.').replace('<meta charset="windows-1252">', '<meta charset="utf-8">'));
});

test('saving a site document to a file leaves another file\'s draft of the same name alone (round 24 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeFiles);
  await h.openReader(page, doc('notes.md'), RAW);
  await page.evaluate(() => new Promise(res => { const rq = indexedDB.open('spine-drafts', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('drafts', { keyPath: 'key' }); rq.onsuccess = () => { const tx = rq.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ key: 'file:markdown:notes.md', text: 'Other work', from: ['x'], t: 1 }); tx.oncomplete = res; }; }));
  await startEditing(page);
  await typeAtEnd(page, 'Mine.\n');
  await page.click('#editSaveAs');
  await page.waitForFunction(() => window.__writes === 1);
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => new Promise(res => { const rq = indexedDB.open('spine-drafts', 1); rq.onsuccess = () => { const g = rq.result.transaction('drafts').objectStore('drafts').getAll(); g.onsuccess = () => res(g.result.map(d => d.text)); }; }));
  assert.ok(left.includes('Other work'), JSON.stringify(left));
});

// Round 25 review.
test('Markdown written back keeps links and pictures whose text has "]" (round 25 review, M-117)', async () => {
  const page = await h.newPage();
  const [original, back] = await typedRoundTrip(page, 'bracket.md');
  const [want, got] = await sameHtml(page, original.replace('Start.', 'Start. Typed.'), back);
  assert.equal(got, want, back);
  assert.match(back, /\[a\\\]b\]\(http:\/\/x\.com\)/);
});

test('a CRLF file keeps its line endings: an edit undone leaves it unchanged, and it is saved with CRLF, from the text and from the page (round 25 review, M-118)', async () => {
  const page = await h.newPage();
  const crlf = fs.readFileSync(`${__dirname}/site/reader/books/crlf.md`, 'latin1');
  await page.addInitScript(fakeFiles);
  await page.addInitScript(t => { window.__open = { 'crlf.md': t }; }, crlf);
  await h.openReader(page, doc('notes.md'), RAW);
  await page.click('#openBtn');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'CRLF');
  await startEditing(page);
  await typeAtEnd(page, 'x'); await page.keyboard.press('Backspace'); await page.waitForTimeout(300);
  assert.doesNotMatch(await page.textContent('#editName'), /unsaved/);
  await typeAtEnd(page, 'More.\r\n');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 1);
  const saved = await page.evaluate(() => window.__files['crlf.md']);
  assert.ok(saved.startsWith(crlf), JSON.stringify(saved));
  assert.doesNotMatch(saved.replace(/\r\n/g, ''), /\n/, JSON.stringify(saved));
  // From the page (WYSIWYG): still CRLF.
  await page.click('[data-mode="wysiwyg"]');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('[contenteditable="true"]'));
  await inPage(page).locator('p', { hasText: 'Start.' }).first().click();
  await page.keyboard.press('End'); await page.keyboard.type(' Typed.');
  await flush(page);
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 2);
  const t = await page.evaluate(() => window.__files['crlf.md']);
  assert.match(t, /Start\. Typed\.\r\n/);
  assert.doesNotMatch(t.replace(/\r\n/g, ''), /\n/, JSON.stringify(t));
});

test('an HTML fragment whose script names <body> is written back as a fragment (round 25 review, L-283)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('frag-script.html'));
  await inPage(page).locator('p', { hasText: 'Start.' }).first().click();
  await page.keyboard.press('End'); await page.keyboard.type(' Typed.');
  await flush(page);
  assert.equal(await text(page), '<h1>T</h1><p>Start. Typed.</p><script>var s="<body>";</script><p>y</p>');
});

test('a link of the document\'s own changed to another relative address isn\'t live in the page, and is written back (round 25 review, L-284)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  const link = inPage(page).locator('a').first();
  await link.click();
  page.once('dialog', d => d.accept('other.md'));
  await page.click('[data-cmd="link"]');
  await flush(page);
  assert.equal(await inPage(page).locator('a').first().getAttribute('href'), null);
  assert.equal(await inPage(page).locator('a').first().getAttribute('data-ed-href'), 'other.md');
  assert.match(await text(page), /\]\(other\.md\)/);
});

test('Save asks before writing over a file that changed on disk since it was opened (round 25 review, L-285)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeFiles);
  await page.addInitScript(t => { window.__open = { 'mine.md': t }; }, NOTES);
  await h.openReader(page, doc('notes.md'), RAW);
  await page.click('#openBtn');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Notes');
  await startEditing(page);
  await typeAtEnd(page, 'Mine.\n');
  await page.evaluate(() => { window.__files['mine.md'] = 'Changed elsewhere, and longer than before: ' + 'x'.repeat(200); (window.__mtime ||= {})['mine.md'] = 5; });
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.keyboard.press('Control+s');
  await h.waitFor(() => asked, 5000);
  assert.match(asked, /changed on disk since it was opened/);
  await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => window.__files['mine.md']), /^Changed elsewhere/);
  assert.match(await page.textContent('#noticeText'), /wasn't written over/);
  // Saved here, the next Save doesn't ask.
  page.once('dialog', d => d.accept());
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 1);
  await typeAtEnd(page, 'Again.\n');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => window.__writes === 2);
});

// Round 25 review, loop 2.
test('Enter in a Markdown list in a CRLF file starts a new line with CRLF (round 25 review, M-123)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await h.openReader(page, doc('crlf.md'), RAW);
  await startEditing(page);
  await typeAtEnd(page, '- item'); await page.keyboard.press('Enter'); await page.keyboard.type('next');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const t = fs.readFileSync(await dl.path(), 'latin1');
  assert.match(t, /- item\r\n- next$/, JSON.stringify(t));
  assert.doesNotMatch(t.replace(/\r\n/g, ''), /\n/, JSON.stringify(t));
  assert.equal(await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getLine(document.querySelector('.CodeMirror').CodeMirror.lineCount() - 1)), '- next');
});

// Round 25 review, loop 5: patterns that took time growing with the input.
test('a long front-matter line, many comments before a fragment, a long code span and many unclosed <meta don\'t freeze opening, editing or saving (round 25 review, M-136, L-321, L-322, L-323)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  let t0 = Date.now();
  await h.openReader(page, doc('frontmatter-long.md'));
  assert.ok(Date.now() - t0 < 6000, `front matter: ${Date.now() - t0} ms`);
  for (const name of ['many-comments.html', 'long-code.md']) {
    await wysiwyg(page, doc(name));
    t0 = Date.now();
    await inPage(page).locator('p', { hasText: 'Start.' }).first().click();
    await page.keyboard.press('End'); await page.keyboard.type(' T');
    await flush(page);
    assert.match(await text(page), /Start\. T/);
    assert.ok(Date.now() - t0 < 4000, `${name}: ${Date.now() - t0} ms`);
  }
  await h.openReader(page, doc('many-meta.html'), RAW);
  await startEditing(page);
  t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  assert.ok(Date.now() - t0 < 4000, `saving: ${Date.now() - t0} ms`);
  // The download is plain bytes, not a page of the reader's origin (L-325).
  assert.equal(await page.evaluate(async u => (await fetch(u)).headers.get('content-type'), dl.url()), 'application/octet-stream');
});

test('a document with many unclosed comments after its body doesn\'t freeze typing in WYSIWYG (round 25 review, L-336)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('comment-bomb.html'));
  const t0 = Date.now();
  await inPage(page).locator('p', { hasText: 'Start.' }).first().click();
  await page.keyboard.press('End'); await page.keyboard.type(' T');
  await flush(page);
  assert.match(await text(page), /Start\. T/);
  assert.ok(Date.now() - t0 < 4000, `${Date.now() - t0} ms`);
});

test('with the top bar hidden, its corner button covers neither the editor\'s buttons nor a notice\'s (round 26 review, M-152)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  const clear = sel => page.evaluate(s => {
    const b = document.querySelector(s), r = b.getBoundingClientRect();
    return [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + r.width / 2, r.top + r.height / 2]].every(([x, y]) => b.contains(document.elementFromPoint(x, y)));
  }, sel);
  await h.openReader(page, doc('notes.md'), RAW);
  await startEditing(page);
  await page.focus('#tocBtn'); await page.keyboard.press('n');   // (the top bar hidden while editing)
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.bar')).display === 'none');
  for (const sel of ['#editSaveAs', '#editSave', '#editDone']) if (await page.isVisible(sel)) assert.equal(await clear(sel), true, sel);
  await h.openReader(page, `${h.READER}?book=books/huge-chapter.epub`, { 'spine:set:SHOW_TOPBAR': false });
  await page.click('#toc :is(a,button):has-text("Two")');
  await page.waitForFunction(() => !document.querySelector('#notice').hidden, null, { timeout: 15000 });
  for (const b of await page.$$('#notice button:visible')) {
    assert.equal(await b.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.right - 2, r.top + 1)); }), true);
  }
});

test('a right-to-left chapter: Edit, then Done, comes back to the heading of the page that was shown (round 25 review, M-147)', async () => {
  const page = await h.newPage({ viewport: { width: 1280, height: 800 } });
  await h.openReader(page, `${h.READER}?book=books/rtl-heads.epub`, { 'spine:layout': 'one' });
  const pos = async () => Number((await page.textContent('#spinePos')).match(/page (\d+)\//)[1]);
  for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(60); }
  if (await pos() === 1) for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
  const before = await pos();
  assert.ok(before > 3, `page ${before}`);
  await startEditing(page);
  await page.click('#editDone');
  await page.waitForFunction(() => !document.querySelector('.app').classList.contains('editing'));
  await page.waitForTimeout(500);
  const after = await pos();
  assert.ok(after > 1 && after <= before, `page ${after}, was ${before}`);
});

test('a file mostly LF with some CRLF lines: an edit undone leaves it unchanged (round 26 review, L-357)', async () => {
  const page = await h.newPage();
  const mixed = '# Mixed\n\nOne.\r\nTwo.\nThree.\n\nFour.\n';
  await page.addInitScript(fakeFiles);
  await page.addInitScript(t => { window.__open = { 'mixed.md': t }; }, mixed);
  await h.openReader(page, doc('notes.md'), RAW);
  await page.click('#openBtn');
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Mixed');
  await startEditing(page);
  await typeAtEnd(page, 'x'); await page.keyboard.press('Backspace'); await page.waitForTimeout(300);
  assert.doesNotMatch(await page.textContent('#editName'), /unsaved/);
});
