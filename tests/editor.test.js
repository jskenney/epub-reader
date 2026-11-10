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
    async getFile() { return new File([window.__files[name] ?? window.__open?.[name] ?? ''], name, { type: '' }); },
    async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; },
    async createWritable() { let out = ''; return { async write(b) { out += typeof b === 'string' ? b : await b.text(); }, async close() { window.__files[name] = out; window.__writes++; }, async abort() {} }; } });
  window.showOpenFilePicker = async () => [handle(Object.keys(window.__open || {})[0])];
  window.showSaveFilePicker = async o => { window.__saveAs = o; return handle(o.suggestedName); };
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

test('unsaved text is kept as a draft: offered when the document is opened again; Done asks before letting it go (E-21)', async () => {
  const page = await h.newPage();
  await h.openReader(page, doc('notes.md'), RAW);
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
});

test('links in the page being edited are not followed; the chips can\'t be typed into (E-21)', async () => {
  const page = await h.newPage();
  await wysiwyg(page, doc('notes.md'));
  await inPage(page).locator('a', { hasText: 'link' }).click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.querySelector('#page').contentDocument.scrollingElement.scrollTop), 0, 'not scrolled to the link\'s target');
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
