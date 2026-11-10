// Tests for gaps listed in REVIEW.md T-20: older fixes that had none.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const frameText = page => h.inFrame(page, doc => doc.body.innerText.trim());
async function toSpine(page, n) {   // turn pages until section n shows
  for (let k = 0; k < 40 && !new RegExp(`spine ${n}/`).test(await page.textContent('#spinePos')); k++) {
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  }
  await page.waitForFunction(n => new RegExp(`spine ${n}/`).test(document.querySelector('#spinePos').textContent), n);
  await page.waitForTimeout(300);
}

test('a fallback page keeps its pictures after it is shown (L-90)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/odd-spine.epub`);
  await toSpine(page, 2);
  await page.waitForFunction(() => document.querySelector('#page').contentDocument.querySelector('#fb-img')?.naturalWidth === 64, null, { timeout: 5000 });
  await page.waitForTimeout(1500);
  const alive = await page.evaluate(async () => {
    const img = document.querySelector('#page').contentDocument.querySelector('#fb-img');
    try { await fetch(img.src); return true; } catch { return false; }
  });
  assert.equal(alive, true, "the picture's copy is still there");
});

test('the sleep timer is off again in a newly opened book (L-96)', async () => {
  const page = await h.newPage();
  // (folder-listen shows the sleep timer.)
  await h.openReader(page, `${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r'); await page.waitForTimeout(400); await page.keyboard.press(' ');
  await page.selectOption('#ttsSleep', '15');
  assert.equal(await page.inputValue('#ttsSleep'), '15');
  await page.setInputFiles('#fileInput', path.join(__dirname, 'site', 'reader', 'books', 'abc.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'ABC');
  await page.waitForTimeout(500);
  assert.equal(await page.inputValue('#ttsSleep'), 'off');
});

test('a part of the book that can\'t be shown gets a note, which isn\'t searched or read aloud (L-153, L-172)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/nonpage.epub`, { 'spine:ttsEngine': 'server' });
  await toSpine(page, 2);
  assert.match(await frameText(page), /This part of the book \(application\/pdf\) can't be shown here\./);
  await page.fill('#searchBox', 'shown here'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchStatus'), /No matches/);
  await page.fill('#searchBox', 'words here'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchStatus'), /of 2 matches/);
});

test('an obfuscated font named in another case in encryption.xml is still unobfuscated (L-137)', async () => {
  const page = await h.newPage();
  const want = require('node:fs').readFileSync(path.join(__dirname, 'site', 'reader', 'books', 'obf-font.bin'));
  await h.openReader(page, `${h.READER}?book=books/obf-case.epub`);
  const url = await h.inFrame(page, doc => [...doc.querySelectorAll('style')].map(s => s.textContent).join('').match(/blob:[^)"']+/)?.[0]);
  assert.ok(url, "the font's address");
  const got = Buffer.from(await page.evaluate(async u => [...new Uint8Array(await (await fetch(u)).arrayBuffer())], url));
  assert.ok(got.equals(want), `the font as it was before obfuscation (first bytes ${got.subarray(0, 8).toString('hex')})`);
});
