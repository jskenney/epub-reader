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
  assert.ok(first < 4000, `first word after ${first} ms`);
});

test('server voices: clips outside the voices folder are not used (L-12, L-28)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, LONG, server);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)));
  assert.deepEqual(await page.$$eval('#ttsVoice option', os => os.map(o => o.value)), ['narrator', 'second', 'described']);
  // The voice with an instruction speaks with it, without the clip from the other site (L-28).
  await page.selectOption('#ttsVoice', 'described');
  await h.clearBreezeLog();
  await page.keyboard.press('r'); await page.keyboard.press('r');
  const asked = await h.waitFor(async () => (await h.breezeLog()).find(r => !r.ref_bytes), 15000);
  assert.ok(asked, 'a request without a clip');
  assert.equal(asked.ref_text, '');
  assert.deepEqual(await h.remoteLog(), []);
});

// A server that lists its languages in /health (ZONOS3: epub-reader-tts-server-zonos3) is offered for books in
// them and sent the book's language; one that can't use instructions has its instruction-only voices left out. A
// server that lists none (Breeze) is offered for English and Chinese and sent no language, as before (E-47).
test('server voice: languages and instructions from /health (E-47)', async () => {
  // (The mock server's ZONOS3 mode cleared however the test ends, or the server-voice tests after it would see it:
  // round 34 review, T-62.)
  try {
    // Breeze: no language sent; the voice with only an instruction (its clip is on another site) is offered.
    let page = await h.newPage();
    await h.clearBreezeLog();
    await h.openReader(page, LONG, server);
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    assert.deepEqual(await page.$$eval('#ttsVoice option', os => os.map(o => o.value)), ['narrator', 'second', 'described']);
    assert.equal((await h.breezeLog())[0].language, null);
    await page.close();
    // ZONOS3, speaking the book's language: it is sent, and the instruction-only voice is left out.
    await h.clearBreezeLog();
    await fetch(`${h.SITE}/__breeze?langs=fr,en,de`);
    page = await h.newPage();
    await h.openReader(page, LONG, server);
    const lang = await page.evaluate(() => (document.querySelector('#page').contentDocument.documentElement.getAttribute('lang') || ''));
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    assert.deepEqual(await page.$$eval('#ttsVoice option', os => os.map(o => o.value)), ['narrator', 'second']);
    const sent = (await h.breezeLog())[0].language;
    assert.ok(sent && sent.toLowerCase().startsWith('en') && (!lang || sent === lang), `language sent: ${sent} (book: ${lang})`);
    assert.equal(await page.$eval('#ttsEngine option[value=server]', o => o.textContent), 'Server');
    await page.close();
    // ZONOS3 without the book's language: Server voice is offered but can't be chosen, and says why.
    await fetch(`${h.SITE}/__breeze?langs=fr,de`);
    page = await h.newPage();
    await h.openReader(page, LONG, { 'spine:ttsEngine': 'device' });
    await page.keyboard.press('r');
    await page.waitForFunction(() => document.querySelector('#ttsEngine option[value=server]')?.textContent.includes('language'));
    assert.deepEqual(await page.$eval('#ttsEngine option[value=server]', o => [o.textContent, o.disabled]), ["Server (not in this book's language)", true]);
  } finally { await fetch(`${h.SITE}/__breeze`, { method: 'DELETE' }); }
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

const clip = path.join(__dirname, 'site', 'tts-voices', 'narrator.wav'), clipTime = fs.statSync(clip).mtime;
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
    const versions = await page.evaluate(() => JSON.parse(localStorage.getItem('spine:clipVersions') || '{}'));
    assert.ok(Object.values(versions).some(Boolean), 'a clip version was recorded');
    // HEAD refused, and the clip re-recorded meanwhile: the version last seen is kept (so the key, and the
    // saved audio, are the same) rather than reset.
    await fetch(`${h.SITE}/__head?on=0`);
    const later = new Date(Date.now() + 7000);
    fs.utimesSync(clip, later, later);
    await page.reload(); await h.waitForBook(page);
    await h.clearBreezeLog();
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page), 10000));
    await page.waitForTimeout(500);
    assert.ok(!(await h.breezeLog()).map(r => r.text).includes(first), 'the first passage should come from saved audio');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('spine:clipVersions') || '{}')), versions);
  } finally { await fetch(`${h.SITE}/__head?on=1`); fs.utimesSync(clip, clipTime, clipTime); }
});

test('a voice chosen while its clip check is still running waits for it, so a re-recorded clip is not missed (L-37)', async () => {
  const second = path.join(__dirname, 'site', 'tts-voices', 'second.wav'), was = fs.statSync(second).mtime;
  const page = await h.newPage();
  try {
    // Second narrator's audio saved, under its clip's current version.
    await h.clearBreezeLog();
    await h.openReader(page, LONG, { ...server, 'spine:serverVoice': 'second' });
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    await h.waitFor(async () => (await h.breezeLog()).filter(r => !r.aborted).length >= 1, 20000);
    await page.waitForTimeout(1000);
    const first = (await h.breezeLog()).filter(r => !r.aborted)[0].text;
    // Its clip re-recorded; slow HEAD replies; the reader reopened with the first narrator chosen, so the
    // second's check runs in the background.
    const later = new Date(Date.now() + 9000);
    fs.utimesSync(second, later, later);
    await fetch(`${h.SITE}/__head?delay=5&path=second.wav`);   // (only the second clip's check is slow)
    await page.evaluate(() => localStorage.setItem('spine:serverVoice', JSON.stringify('narrator')));
    await page.reload(); await h.waitForBook(page);
    await h.clearBreezeLog();
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)), 'the first narrator reads');
    await page.keyboard.press(' ');                     // pause, choose the second narrator, and start again
    await page.selectOption('#ttsVoice', 'second');   // from the top of the page (R), where its audio was saved
    await h.clearBreezeLog();
    await page.keyboard.press('r');
    // Not the audio saved for the old clip: the passage is made again.
    assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(r => r.text === first && /Another clip/.test(r.ref_text)), 20000),
      'the first passage should be made again with the new clip');
  } finally { await fetch(`${h.SITE}/__head?delay=0`); fs.utimesSync(second, was, was); }
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

test('server voice: a chapter in another language is made ahead in its own, once (round 34 review, L-433)', async () => {
  await h.clearBreezeLog();
  await fetch(`${h.SITE}/__breeze?langs=en,fr`);
  try {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/two-langs.epub`, server);
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /second paragraph/.test(e.text)), 20000));
    await page.waitForTimeout(8000);   // (chapter two read through)
    const two = (await h.breezeLog()).filter(e => /British|second paragraph/.test(e.text));
    assert.ok(two.length > 0 && two.every(e => e.language === 'en-GB'), JSON.stringify(two.map(e => [e.text, e.language])));
    assert.equal(new Set(two.map(e => e.text)).size, two.length, 'each made once');
  } finally { await fetch(`${h.SITE}/__breeze`, { method: 'DELETE' }); }
});

test('server voice: the language is part of saved audio\'s key for a server that lists languages, not for Breeze; a voice that needs instructions is dropped when the server can\'t use them (round 34 review, T-63)', async () => {
  const said = async (page, url) => {
    await page.goto(url); await h.waitForBook(page);
    await page.keyboard.press('r');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Escape');
  };
  try {
    // A server that lists languages: the same words in a French book are made again, in French.
    await h.clearBreezeLog();   // (which also clears the server's languages: set after)
    await fetch(`${h.SITE}/__breeze?langs=en,fr`);
    let page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/same-en.epub`, server);
    await said(page, `${h.READER}?book=books/same-en.epub`);
    await said(page, `${h.READER}?book=books/same-fr.epub`);
    let log = (await h.breezeLog()).filter(e => /same words/.test(e.text));
    assert.deepEqual([...new Set(log.map(e => e.language))].sort(), ['en', 'fr'], JSON.stringify(log));
    await page.close();
    // Breeze (no languages): the language isn't in the key, so the French book's same words come from saved audio.
    await fetch(`${h.SITE}/__breeze`, { method: 'DELETE' });
    await h.clearBreezeLog();
    page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/same-en.epub`, server);
    await said(page, `${h.READER}?book=books/same-en.epub`);
    const before = (await h.breezeLog()).filter(e => /same words/.test(e.text)).length;
    await said(page, `${h.READER}?book=books/same-fr.epub`);
    assert.ok(before > 0);
    assert.equal((await h.breezeLog()).filter(e => /same words/.test(e.text)).length, before, 'not made again');
    await page.close();
    // A voice with only an instruction, chosen before, on a server that can't use instructions: another is used.
    await h.clearBreezeLog();
    await fetch(`${h.SITE}/__breeze?langs=en,fr`);
    page = await h.newPage();
    await h.openReader(page, LONG, { ...server, 'spine:serverVoice': 'described' });
    await page.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(page)));
    assert.equal(await page.$eval('#ttsVoice', s => s.value), 'narrator');
    assert.ok((await h.breezeLog()).every(e => e.ref_text), 'asked with a voice of a clip');
  } finally { await fetch(`${h.SITE}/__breeze`, { method: 'DELETE' }); }
});

test('server voice: a chapter with TeX read ahead is asked for without the TeX (round 31 review; T-59)', async () => {
  await h.clearBreezeLog();
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/tex-ahead.epub`, server);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(e => /Euler/.test(e.text)), 20000), 'chapter two read ahead');
  const euler = (await h.breezeLog()).filter(e => /Euler/.test(e.text));
  assert.ok(euler.every(e => !/\\\(|\^\{|\\pi/.test(e.text)), JSON.stringify(euler.map(e => e.text)));
});
