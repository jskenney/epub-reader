// Per-folder settings (reader-config.json) and default books, with index.html linked into several folders.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const look = page => page.evaluate(() => {
  const flow = document.querySelector('#page').contentDocument.querySelector('[id^="spine-flow-"]');
  const fw = document.querySelector('#page').contentWindow;
  return { theme: document.documentElement.getAttribute('data-theme') || 'auto',
    columns: fw.getComputedStyle(flow).columnCount, scrolling: fw.getComputedStyle(flow).transform === 'none' && fw.getComputedStyle(fw.document.documentElement).overflow === 'auto' };
});

test('each linked folder opens its own default.epub; without preferences in a config the built-in defaults apply', async () => {
  for (const [folder, book] of [['folder-a', 'Folder A Book'], ['folder-c', 'Folder C Book']]) {
    const page = await h.newPage();
    await h.openReader(page, `${h.SITE}/${folder}/index.html`);
    assert.equal(await h.title(page), book);
    assert.deepEqual(await look(page), { theme: 'auto', columns: '2', scrolling: false });
    assert.deepEqual(page.blocked, [], 'nothing should be fetched from other sites');
  }
});

test('a folder config sets defaults and settings, and warns about what it does not know', async () => {
  const page = await h.newPage();
  const warnings = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  await h.openReader(page, `${h.SITE}/folder-b/index.html`);
  assert.equal(await h.title(page), 'Folder B Book');
  assert.deepEqual(await look(page), { theme: 'dark', columns: '1', scrolling: false });
  assert.ok(warnings.some(w => /unknownSetting ignored \(unknown setting\)/.test(w)), warnings.join(' | '));
  // The default was applied, not saved as the reader's choice.
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:layout')), null);
});

test("the reader's own choices win over the folder's defaults", async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-b/index.html`, { 'spine:layout': 'two', 'spine:theme': 'light' });
  assert.deepEqual(await look(page), { theme: 'light', columns: '2', scrolling: false });
});

test('a config that is not JSON, or a "not found" page in its place, is ignored', async () => {
  const dir = path.join(__dirname, 'site', 'folder-c');
  fs.writeFileSync(path.join(dir, 'reader-config.json'), '{ this is not json');
  try {
    const page = await h.newPage();
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await h.openReader(page, `${h.SITE}/folder-c/index.html`);
    assert.equal(await h.title(page), 'Folder C Book');
    assert.ok(warnings.some(w => /isn't valid JSON/.test(w)), warnings.join(' | '));
  } finally { fs.unlinkSync(path.join(dir, 'reader-config.json')); }
  const soft = await h.newPage();
  const warnings = [];
  soft.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  await h.openReader(soft, `${h.SOFT}/folder-c/index.html`);
  assert.equal(await h.title(soft), 'Folder C Book');
  assert.deepEqual(warnings.filter(w => /reader-config/.test(w)), []);
});
