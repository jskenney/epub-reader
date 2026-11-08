// The reader's Content-Security-Policy from nginx.conf.example (the test site sends it): present, and it
// lets every feature work, with nothing refused (REVIEW.md M-6, D-2).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

test('the site sends the policy from nginx.conf.example', async () => {
  const example = fs.readFileSync(path.join(__dirname, '..', 'nginx.conf.example'), 'utf8');
  const documented = example.match(/^\s*add_header Content-Security-Policy "([^"]+)"/m)[1];
  const r = await fetch(h.READER);
  assert.equal(r.headers.get('content-security-policy'), documented);
  assert.match(documented, /frame-ancestors 'self'/);
});

test('books, documents, comics, fonts and search work under the policy, with nothing refused', async () => {
  for (const ref of ['', '?book=books/long.epub', '?book=books/notes.md', '?book=books/page.html', '?book=books/comic.cbz', '?book=books/shelf-dir/']) {
    const page = await h.newPage();
    await h.openReader(page, h.READER + ref);
    assert.notEqual(await h.title(page), 'Spine Reader', ref);
    await page.click('#fontBtn');   // the font menu loads every reading font for its previews
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.keyboard.press('/'); await page.keyboard.type('the'); await page.waitForTimeout(600);
    assert.deepEqual(page.cspViolations, [], `${ref || 'sample'}: ${page.cspViolations.join(' | ')}`);
    assert.deepEqual(page.errors, [], ref);
  }
});

test('reading aloud with the server voice works under the policy', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)), 'reading should start');
  await page.waitForTimeout(1500);
  assert.deepEqual(page.cspViolations, []);
});
