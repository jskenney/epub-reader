// Natural voices: jumping cancels stale work, preparing ahead into the next chapter, saved audio after a
// reload (all with the mock server voice), and, with SLOW=1, the real self-hosted Kokoro and Pocket TTS.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const server = { 'spine:ttsEngine': 'server' };
async function goToText(page, text) {   // with search, as a reader would
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page').contentWindow.CSS.highlights?.has('search-current'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

test('clicking elsewhere while reading cancels the old passage and speaks there at once', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, server);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)));
  // Jump to a long paragraph, and away again while its audio is still being made.
  await page.frameLocator('#page').locator('p', { hasText: 'First paragraph 1.' }).click({ position: { x: 5, y: 5 } });
  await h.waitFor(async () => (await h.breezeLog()).some(r => r.text.startsWith('First paragraph 1.')), 5000, 50);
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.frameLocator('#page').locator('p', { hasText: 'First paragraph 3.' }).click({ position: { x: 5, y: 5 } });
  const there = await h.waitFor(async () => (await page.evaluate(() => {
    const hl = document.querySelector('#page').contentWindow.CSS.highlights.get('tts-sentence');
    return hl ? [...hl][0].toString() : '';
  })).startsWith('First paragraph 3.'), 10000);
  assert.ok(there, 'the sentence clicked should be read');
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
  await page.waitForTimeout(1000);
  const log = await h.breezeLog();
  // After a jump the first sentence is read on its own (so speech starts at once) and the rest of the paragraph
  // is made next: that rest of paragraph 1 is what the second jump has to cancel.
  const i1 = log.findIndex(r => r.text.startsWith('First paragraph 1.')), i3 = log.findIndex(r => r.text.startsWith('First paragraph 3.'));
  assert.ok(log.slice(i1 + 1, i3).some(r => r.aborted), `the rest of paragraph 1 should have been cancelled: ${JSON.stringify(log.map(r => [r.text.slice(0, 20), !!r.aborted]))}`);
});

test('passages are prepared ahead, on into the next chapter', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, server);
  await goToText(page, 'cafe');
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)));
  await page.frameLocator('#page').locator('p', { hasText: 'café' }).click();
  const ahead = await h.waitFor(async () => (await h.breezeLog()).some(r => /^Chapter Two/.test(r.text)), 20000);
  assert.ok(ahead, `chapter two should be prepared while chapter one is read: ${(await h.breezeLog()).map(r => r.text.slice(0, 20)).join(' | ')}`);
  assert.match(await page.textContent('#spinePos'), /spine 1\/3/, 'while still reading chapter one');
});

test('finished audio is saved: after a reload the same passage plays without asking the server again', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, server);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)));
  await h.waitFor(async () => (await h.breezeLog()).length >= 3, 20000);   // a few passages made and saved
  await page.waitForTimeout(1500);
  const before = (await h.breezeLog()).filter(r => !r.aborted).map(r => r.text);
  await page.reload();
  await h.waitForBook(page);
  await h.clearBreezeLog();
  const t0 = Date.now();
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page), 10000));
  const first = Date.now() - t0;
  await page.waitForTimeout(500);
  const asked = (await h.breezeLog()).map(r => r.text);
  assert.ok(!asked.includes(before[0]), 'the first passage should come from saved audio');
  assert.ok(first < 2000, `first word after ${first} ms`);
});

test('server voices: clips outside the voices folder are not used (L-12, L-28)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, LONG, server);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)));
  assert.deepEqual(await page.$$eval('#ttsVoice option', os => os.map(o => o.value)), ['narrator', 'described']);
  // The voice with an instruction speaks with it, without the clip from the other site (L-28).
  await page.selectOption('#ttsVoice', 'described');
  await h.clearBreezeLog();
  await page.keyboard.press('r'); await page.keyboard.press('r');
  const asked = await h.waitFor(async () => (await h.breezeLog()).find(r => !r.ref_bytes), 15000);
  assert.ok(asked, 'a request without a clip');
  assert.equal(asked.ref_text, '');
  assert.deepEqual(await h.remoteLog(), []);
});

test('saved server-voice audio survives reordered or added fields in voices.json, not a changed seed or clip (L-15, L-28)', async () => {
  const file = path.join(__dirname, 'site', 'tts-voices', 'voices.json');
  const original = fs.readFileSync(file, 'utf8');
  const clip = path.join(__dirname, 'site', 'tts-voices', 'narrator.wav'), clipTime = fs.statSync(clip).mtime;
  const edit = change => { const j = JSON.parse(original); j.voices[0] = change(j.voices[0]); fs.writeFileSync(file, JSON.stringify(j)); };
  const page = await h.newPage();
  try {
    await h.clearBreezeLog();
    await h.openReader(page, LONG, server);
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    await h.waitFor(async () => (await h.breezeLog()).filter(r => !r.aborted).length >= 2, 20000);
    await page.waitForTimeout(1000);
    const first = (await h.breezeLog()).filter(r => !r.aborted)[0].text;
    const replay = async () => {
      await page.reload();
      await h.waitForBook(page);
      await h.clearBreezeLog();
      await page.keyboard.press('r');
      assert.ok(await h.waitFor(() => h.spokenWord(page), 10000));
      await page.waitForTimeout(500);
      return (await h.breezeLog()).map(r => r.text).includes(first);
    };
    edit(v => ({ note: 'added later', ...Object.fromEntries(Object.entries(v).reverse()) }));
    assert.equal(await replay(), false, 'reordered fields: the first passage should come from saved audio');
    edit(v => ({ ...v, seed: 7 }));
    assert.equal(await replay(), true, 'a new seed: the first passage should be made again');
    // The original settings, but the clip re-recorded under the same name (L-28): made again too.
    edit(v => v);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(clip, later, later);
    assert.equal(await replay(), true, 'a re-recorded clip: the first passage should be made again');
  } finally {
    fs.writeFileSync(file, original);
    fs.utimesSync(clip, clipTime, clipTime);
  }
});

test('a refused HEAD request keeps the clip version last seen, so saved audio is still used (L-28, L-31, T-10)', async () => {
  const page = await h.newPage();
  try {
    await h.clearBreezeLog();
    await h.openReader(page, LONG, server);
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    await h.waitFor(async () => (await h.breezeLog()).filter(r => !r.aborted).length >= 2, 20000);
    await page.waitForTimeout(1000);
    const first = (await h.breezeLog()).filter(r => !r.aborted)[0].text;
    await fetch(`${h.SITE}/__head?on=0`);
    await page.reload(); await h.waitForBook(page);
    await h.clearBreezeLog();
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page), 10000));
    await page.waitForTimeout(500);
    assert.ok(!(await h.breezeLog()).map(r => r.text).includes(first), 'the first passage should come from saved audio');
  } finally { await fetch(`${h.SITE}/__head?on=1`); }
});

const slow = !process.env.SLOW && 'set SLOW=1 to run (loads real models on the CPU)';
for (const [engine, folder] of [['kokoro', 'kokoro'], ['pocket', 'pocket']]) {
  const missing = !fs.existsSync(path.join(__dirname, '..', folder)) && `${folder}/ not fetched`;
  test(`${engine}: the self-hosted model loads and speaks without contacting other sites`, { skip: slow || missing, timeout: 600000 }, async () => {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': engine });
    await page.keyboard.press('r');
    await page.click('#ttsDownload').catch(() => {});
    assert.ok(await h.waitFor(() => h.spokenWord(page), 540000, 1000), await page.textContent('#ttsStatus'));
    assert.deepEqual(page.blocked, []);
    assert.deepEqual(page.cspViolations, [], 'the reader policy in nginx.conf.example must allow the voice to run');
  });
}
