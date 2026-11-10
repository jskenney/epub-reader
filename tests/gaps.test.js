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
  await toSpine(page, 3);
  assert.match(await frameText(page), /This part of the book \(audio\/mpeg\) can't be shown here\./, 'an item with no type, known by its name');
  const status = re => page.waitForFunction(re => new RegExp(re).test(document.querySelector('#searchStatus').textContent), re, { timeout: 10000 });
  await page.fill('#searchBox', 'shown here'); await status('No matches');
  await page.fill('#searchBox', 'words here'); await status('of 2 matches');
  await page.fill('#searchBox', '');
  // Reading aloud from the start passes the notes over: they're never sent to the voice.
  await page.keyboard.press('Home').catch(() => {});
  await page.click('#tocList a >> nth=0'); await page.waitForTimeout(500);
  await h.clearBreezeLog();
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /Last words/.test(e.text)), 30000), JSON.stringify(await h.breezeLog()));
  assert.ok((await h.breezeLog()).every(e => !/shown here/.test(e.text)), JSON.stringify(await h.breezeLog()));
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

test('publisher narration at the end of the text doesn\'t turn to a following picture page (L-93)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/narrated-pic.epub`);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(async () => /End of book/.test(await page.textContent('#ttsStatus')), 20000), await page.textContent('#ttsStatus'));
  assert.match(await page.textContent('#spinePos'), /spine 1\/2/);
});

test('a folder book closed while its obfuscated font is still downloading leaves no copy of the font behind (L-153)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => {
    window.__fonts = [];   // [address, revoked]
    const make = URL.createObjectURL, drop = URL.revokeObjectURL;
    URL.createObjectURL = b => { const u = make(b); if (/font|ttf/.test(b?.type || '')) window.__fonts.push([u, false]); return u; };
    URL.revokeObjectURL = u => { const f = window.__fonts.find(x => x[0] === u); if (f) f[1] = true; return drop(u); };
  });
  let release, held = false;
  const gate = new Promise(r => { release = r; });
  await page.route('**/obf-dir/OEBPS/f.ttf', async route => { held = true; await gate; await route.continue(); });
  await page.goto(`${h.READER}?book=books/obf-dir/`);
  assert.ok(await h.waitFor(async () => held, 15000), 'the font was asked for');
  // Another book opened while the font is on its way, then the font arrives.
  await page.setInputFiles('#fileInput', path.join(__dirname, 'site', 'reader', 'books', 'abc.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'ABC');
  release();
  await page.waitForTimeout(1000);
  const live = await page.evaluate(() => window.__fonts.filter(([, revoked]) => !revoked).map(([u]) => u));
  assert.deepEqual(live, [], 'no copy of the closed book\'s font left');
});

test('a Pocket TTS worker that crashes is marked as stopped working, and loaded again on the next try (L-165)', async () => {
  const page = await h.newPage();
  let loads = 0;
  page.on('request', r => { if (/\/pocket-crash\/pocket\/lib\/worker\.js$/.test(r.url())) loads++; });
  await h.openReader(page, `${h.SITE}/folder-pocket-crash/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'pocket' });
  await page.keyboard.press('r');
  await page.click('#ttsDownload', { timeout: 3000 }).catch(() => {});
  const said = async () => `${await page.textContent('#ttsStatus')} ${await page.textContent('#notice')}`;
  assert.ok(await h.waitFor(async () => /the voice stopped working \(/.test(await said()), 20000), await said());
  // The voice is loaded afresh rather than the crashed worker tried again (it would never answer).
  if (loads < 2) { await page.click('#ttsPlay'); await page.click('#ttsDownload', { timeout: 3000 }).catch(() => {}); }
  assert.ok(await h.waitFor(async () => loads >= 2, 15000), `worker loads: ${loads}`);
});
