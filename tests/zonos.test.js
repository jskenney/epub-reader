// ZONOS3-Mini in the browser (REVIEW.md E-46), with a stand-in engine (tests/site/zonos-fake/engine.js: the same
// exports as zonos/engine/engine.js, no WebGPU): when it is offered, the download agreement and progress, the
// built-in voices, what each passage asks the engine for (the book's language, the voice, English text spelled
// out), streaming, failures, and the English text spelled out (zonosText).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const FRENCH = `${h.READER}?book=books/french.epub`;
const LATIN = `${h.READER}?book=books/latin.epub`;
const zonos = { 'spine:ttsEngine': 'zonos' };
const HF = 'https://huggingface.co/Zyphra/ZONOS3-Mini/resolve/d2d142a86b1e6aeb4252679673c86ecd86177bf8/web/';

async function page({ gpu = true, fail = '', origin = h.SITE } = {}) {
  const p = await h.newPage();
  await p.addInitScript(([gpu, fail, fake]) => {
    window.SPINE_TEST = { zonosEngine: fake };
    if (fail) window.zonosFakeFail = fail;
    // (Headless Chromium may or may not have WebGPU: decided here, either way.)
    Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => gpu ? {} : undefined });
  }, [gpu, fail, `${origin}/zonos-fake/engine.js`]);   // (from the page's own site, as the real engine must be)
  return p;
}
const optionOf = p => p.$eval('#ttsEngine option[value=zonos]', o => [o.textContent, o.disabled]);
const fake = p => p.evaluate(() => window.zonosFake ? JSON.parse(JSON.stringify(window.zonosFake)) : null);

test('ZONOS3 is offered for books in its languages and with WebGPU, and says why not otherwise', async () => {
  for (const [url, gpu, want] of [[LONG, true, ['ZONOS3', false]], [FRENCH, true, ['ZONOS3', false]],
    [LATIN, true, ["ZONOS3 (not in this book's language)", true]], [LONG, false, ['ZONOS3 (needs WebGPU)', true]]]) {
    const p = await page({ gpu });
    await h.openReader(p, url, { 'spine:ttsEngine': 'device' });
    await p.keyboard.press('r');
    await p.waitForSelector('#tts:not([hidden])');
    assert.deepEqual(await optionOf(p), want, `${url} ${gpu ? 'with' : 'without'} WebGPU`);
    await p.close();
  }
});

test('ZONOS3: agreeing to the download loads it, lists its voices, and reads the book in its language', async () => {
  const p = await page();
  await h.openReader(p, LONG, zonos);
  await p.keyboard.press('r');
  // Asked first, with the size.
  await p.waitForFunction(() => /ZONOS3: one-time ~900 MB download/.test(document.querySelector('#ttsStatus').textContent));
  assert.equal(await p.textContent('#ttsDownload'), 'Download');
  assert.equal(await fake(p), null, 'nothing loaded before agreeing');
  await p.click('#ttsDownload');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads after loading');
  const f = await fake(p);
  assert.equal(f.base, HF, 'models from Hugging Face (none on this site)');
  // Voices: built-in only, the book's language first, styles spelled properly.
  assert.deepEqual(await p.$$eval('#ttsVoice option', os => os.map(o => [o.value, o.textContent])), [
    ['default_savannah', 'Savannah (en, American, female)'], ['default_willow', 'Willow (en, ASMR, female)'],
    ['default_gaspard', 'Gaspard (fr, male)']]);
  const first = f.requests[0];
  assert.equal(first.language, 'en_us');
  assert.equal(first.speaker_embedding_id, 'default_savannah');
  assert.equal(first.stream, true);
  // English text is spelled out ("Chapter One", "First paragraph 1." -> "... one.").
  assert.ok(f.requests.some(r => /paragraph one\b/.test(r.text)) || f.requests.every(r => !/\d/.test(r.text)),
    JSON.stringify(f.requests.map(r => r.text)));
  assert.ok(f.requests.every(r => !/\d/.test(r.text)), 'no digits sent');
  // A reload doesn't ask again.
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads without asking again');
  assert.equal(await p.isHidden('#ttsDownload'), true);
});

test('ZONOS3: a French book is read in French, and a chosen voice is kept', async () => {
  const p = await page();
  await h.openReader(p, FRENCH, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.requests.length > 0, null, { timeout: 20000 });
  let f = await fake(p);
  assert.equal(f.requests[0].language, 'fr_fr');
  assert.equal(f.requests[0].speaker_embedding_id, 'default_gaspard', 'a voice in the book\'s language');
  await p.waitForFunction(() => window.zonosFake.requests.some(r => r.text.includes('Il était une fois')), null, { timeout: 20000 });
  assert.equal(await p.$eval('#ttsVoice option', o => o.value), 'default_gaspard', 'the book\'s language first');
  await p.selectOption('#ttsVoice', 'default_willow');
  await p.waitForFunction(() => window.zonosFake.requests.some(r => r.speaker_embedding_id === 'default_willow'), null, { timeout: 20000 });
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('spine:zonosVoice'))), 'default_willow');
});

test('ZONOS3: an engine that fails to start says so and can be tried again', async () => {
  const p = await page({ fail: 'No WebGPU adapter found' });
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  await p.waitForFunction(() => /Natural voice failed/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.match(await p.textContent('#ttsStatus'), /WebGPU isn't usable in this browser \(No WebGPU adapter found\)/);
  assert.equal(await p.textContent('#ttsDownload'), 'Try again');
  await p.evaluate(() => { delete window.zonosFakeFail; });
  await p.click('#ttsDownload');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads after trying again');
  assert.equal((await fake(p)).inits, 2);
});

test('ZONOS3: a lost GPU stops the voice, with the reason', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  // The GPU lost: the voice is marked failed, and reading stops with the reason.
  await p.evaluate(() => window.zonosFatal('GPU device lost: test'));
  await p.waitForFunction(() => /stopped working \(GPU device lost: test\)/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 10000 });
});

test('zonosText spells out English numbers, money, dates and abbreviations, and leaves other languages alone', async () => {
  const p = await page();
  await h.openReader(p, LONG);
  const out = await p.evaluate(() => [
    'In 1984, Dr. Smith paid $5.50 for chapter 12 on May 3rd.',
    'Chapter XII. The 21st of 1,250,000 people; 3.14 and 45% and £1 and $2.01 and €3 million.',
    'In 1066 and 1905 and 2000 and 2024, (etc.) and so on, etc. Then more.',
    'Room 12a, 3D, MP3, version 2.5.1, the 90s, the 1990s, at 10:30 and 9:05 and 12:00.',
    '$1.5 million, $5.5, US$5, Part C, Section D, Act IV; Genesis 1:1, 24:00, 3:15:20.',
    'Call 555-1234 or (555) 123-4567 on 1975-03-14; pages 10-20, 1990–1995, 20-10.',
    'Agent 007, 0800 hours; Elm St. and Oak Dr., not St. Paul or Dr. Who; the 1800\'s, -5 degrees, 1001 nights, in 1066.',
  ].map(t => SPINE_TEST.zonosText(t, 'en_us')).concat(SPINE_TEST.zonosText('Il y a 3 chats.', 'fr_fr')));
  assert.deepEqual(out, [
    'In nineteen eighty-four, Doctor Smith paid five dollars and fifty cents for chapter twelve on May third.',
    'Chapter twelve. The twenty-first of one million two hundred and fifty thousand people; three point one four and forty-five percent and one pound and two dollars and one cent and three million euros.',
    'In ten sixty-six and nineteen oh five and two thousand and twenty twenty-four, (et cetera) and so on, et cetera. Then more.',
    'Room 12a, 3D, MP3, version 2.5.1, the nineties, the nineteen nineties, at ten thirty and nine oh five and twelve o\'clock.',
    'one point five million dollars, $5.5, US$5, Part C, Section D, Act four; Genesis 1:1, 24:00, 3:15:20.',
    'Call 555-1234 or (555) 123-4567 on 1975-03-14; pages ten to twenty, nineteen ninety to nineteen ninety-five, 20-10.',
    'Agent zero zero seven, zero eight zero zero hours; Elm Street and Oak Drive, not Saint Paul or Doctor Who; the eighteen hundreds, minus five degrees, one thousand and one nights, in ten sixty-six.',
    'Il y a 3 chats.',
  ]);
});

test('ZONOS3: a passage cut off partway is asked for again, not kept (E-46 review)', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  // (The second request: a paragraph. The first piece read is a single sentence, so speech starts quickly; a single
  // sentence that fails stops reading with a notice, as with every engine.)
  await p.evaluate(() => { window.zonosFakeCutAt = 2; });
  await p.keyboard.press('r');
  const f = await h.waitFor(async () => { const f = await fake(p); return f?.cut === 1 && f.requests.length >= 4 && f; }, 20000);
  assert.ok(f, 'the cut-off passage was followed by more requests');
  // It was asked for again one sentence at a time: its first sentence comes back as a request of its own.
  const cutText = f.requests[1].text, firstSentence = cutText.split(/(?<=[.!?])\s/)[0];
  assert.ok(cutText.length > firstSentence.length, 'the cut passage had several sentences');
  assert.ok(f.requests.slice(2).some(r => r.text === firstSentence), JSON.stringify(f.requests.map(r => r.text.slice(0, 40))));
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads on');
});

test('ZONOS3: a lost GPU stops a passage that would wait for good, and "Try again" says to reload (E-46 review)', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.evaluate(() => { window.zonosFakeHang = true; });
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.requests.length > 0, null, { timeout: 20000 });
  await p.evaluate(() => window.zonosFatal('GPU device lost: test'));
  await p.waitForFunction(() => /reload the page/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 10000 });
  assert.equal(await p.textContent('#ttsDownload'), 'Try again');
  await p.click('#ttsDownload');
  await p.waitForTimeout(500);
  assert.match(await p.textContent('#ttsStatus'), /stopped working \(GPU device lost: test\); reload the page/);
  assert.equal((await fake(p)).inits, 1, 'not started again on a lost GPU');
  assert.equal(await p.evaluate(() => window.zonosFatals), 1, 'one failure callback');
});

test('ZONOS3 models are used from this site only when fetch-zonos.sh finished (E-46 review)', async () => {
  for (const [folder, local] of [['zonos-local', true], ['zonos-partial', false]]) {
    const p = await page();
    await h.openReader(p, `${h.SITE}/${folder}/index.html?book=/reader/books/long.epub`, { ...zonos, 'spine:agreed:zonos': true });
    await p.keyboard.press('r');
    await p.waitForFunction(() => window.zonosFake?.base, null, { timeout: 20000 });
    assert.equal((await fake(p)).base, local ? `${h.SITE}/${folder}/zonos/models/` : HF, folder);
    await p.close();
  }
});

test('zonosLang maps a book\'s language to ZONOS3\'s, skipping script subtags (E-46 review)', async () => {
  const p = await page();
  await h.openReader(p, LONG);
  assert.deepEqual(await p.evaluate(() => ['en', 'en-US', 'en-GB', 'en-Latn-GB', 'en-AU', 'fr-CA', 'zh-Hans-CN', 'pt', 'nb', 'he', 'iw', 'la', 'xx-YY']
    .map(t => SPINE_TEST.zonosLang(t))), ['en_us', 'en_us', 'en_gb', 'en_gb', 'en_gb', 'fr_fr', 'cmn', 'pt_br', 'no', 'he', 'he', null, null]);
});

test('ZONOS3: an engine that can\'t be found names the address it tried', async () => {
  const p = await h.newPage();
  await p.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({}) }); });
  await h.openReader(p, `${h.SITE}/zonos-partial/index.html?book=/reader/books/long.epub`, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  await p.waitForFunction(() => /couldn't be loaded from/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.match(await p.textContent('#ttsStatus'), new RegExp(`from ${h.SITE}/zonos-partial/zonos/engine/engine\\.js \\(zonos/engine/ in this page's folder\\)`));
});

test('ZONOS3: a site that answers missing files with a page and status 200 isn\'t taken to have the models', async () => {
  // zonos-partial has the manifests but no NOTICE.txt; this site answers its NOTICE.txt with a "not found" page.
  const p = await page({ origin: h.SOFT });
  await h.openReader(p, `${h.SOFT}/zonos-partial/index.html?book=/reader/books/long.epub`, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.base, null, { timeout: 20000 });
  assert.equal((await fake(p)).base, HF);
});

test('ZONOS3: a second visit reads the browser\'s copy; a copy not kept or dropped is explained, and storage is asked to persist', async () => {
  const p = await page();
  await p.addInitScript(() => {
    window.persistAsked = 0;
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => { window.persistAsked++; return false; };
  });
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  assert.equal(await p.evaluate(() => window.persistAsked), 1, 'asked once to keep the storage');
  assert.equal((await p.textContent('#notice')).includes('downloaded again'), false, 'nothing to say after a first download that was kept');
  // Second visit: from the browser's copy, nothing said, not asked again.
  await p.reload(); await h.waitForBook(p);
  const statuses = [];
  await p.exposeFunction('noteStatus', s => statuses.push(s)).catch(() => {});
  await p.evaluate(() => new MutationObserver(() => window.noteStatus(document.querySelector('#ttsStatus').textContent)).observe(document.querySelector('#ttsStatus'), { childList: true, characterData: true, subtree: true }));
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  assert.ok(statuses.some(s => /Loading ZONOS3 from this browser's copy/.test(s)), JSON.stringify(statuses));
  assert.ok(!statuses.some(s => /Downloading/.test(s)), JSON.stringify(statuses));
  assert.equal(await p.evaluate(() => window.persistAsked), 0, 'not asked again');
  // The browser dropped its copy: said so, with the storage figures.
  await p.evaluate(() => sessionStorage.setItem('x', '1'));
  await p.addInitScript(() => { window.zonosFakeDropped = true; });
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForFunction(() => /downloaded again: this browser didn't keep its copy since last time/.test(document.querySelector('#notice').textContent), null, { timeout: 20000 });
  assert.match(await p.textContent('#notice'), /This site uses \d+ MB of the \d+ MB the browser allows it, and the browser may clear it/);
});

test('ZONOS3: a browser that doesn\'t keep the downloaded models says so at once', async () => {
  const p = await page();
  await p.addInitScript(() => { window.zonosFakeNoKeep = true; });
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForFunction(() => /didn't keep a copy of ZONOS3's models, so they will be downloaded again next time/.test(document.querySelector('#notice').textContent), null, { timeout: 20000 });
});

test('ZONOS3: without room in the site\'s storage quota for the models, says so before downloading', async () => {
  const p = await page();
  await p.addInitScript(() => { window.zonosFakeNoKeep = true; navigator.storage.estimate = async () => ({ usage: 600 * 1048576, quota: 1000 * 1048576 }); });
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForFunction(() => /allows this site only 400 MB more storage, less than ZONOS3's 900 MB/.test(document.querySelector('#notice').textContent), null, { timeout: 20000 });
  assert.match(await p.textContent('#notice'), /this site uses 600 of its 1000 MB\)\. Free some space on the computer's disk, or lower \(or clear\) "Saved speech kept in this browser" in Settings/);
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads all the same');
});

// --- Custom voices (E-48) ---
const VOICES = `${h.SITE}/zonos-voices/index.html?book=/reader/books/long.epub`;
const voiceList = p => p.$$eval('#ttsVoice option', os => os.map(o => o.textContent));

test('ZONOS3 voices from recordings in reader-config.json: listed first, made once into an embedding, kept for later visits', async () => {
  const p = await page();
  await h.openReader(p, VOICES, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  // The bad entry (not a web address) is left out; the missing one is listed (it fails only when used).
  const names = await voiceList(p);
  assert.deepEqual(names.slice(0, 2), ['Site narrator (this site)', 'Missing (this site)']);
  assert.ok(!names.some(n => n.startsWith('Bad')));
  assert.equal(names[2], 'Savannah (en, American, female)', 'then the built-in voices');
  // Chosen: the recording is made into a voice once, then sent as its embedding with each passage.
  await p.selectOption('#ttsVoice', { label: 'Site narrator (this site)' });
  await p.waitForFunction(() => window.zonosFake.requests.filter(r => r.speaker_mode === 'embedding').length >= 2, null, { timeout: 20000 });
  let f = await fake(p);
  const custom = f.requests.filter(r => r.speaker_mode === 'embedding');
  assert.equal(f.speakers, 1, 'the recording made into a voice once');
  assert.ok(custom.every(r => r.embedding0 === custom[0].embedding0 && r.speaker_embedding_id === undefined));
  // Next visit: the embedding is kept in the browser, so nothing is made again.
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.requests.some(r => r.speaker_mode === 'embedding'), null, { timeout: 20000 });
  f = await fake(p);
  assert.equal(f.speakers || 0, 0, 'not made again on a later visit');
  // The missing one, chosen: reading stops with the reason.
  await p.selectOption('#ttsVoice', { label: 'Missing (this site)' });
  await p.waitForFunction(() => /recording for Missing isn't at \/tts-voices\/no-such\.wav \(404\)/.test(document.querySelector('#notice').textContent), null, { timeout: 20000 });
});

test('ZONOS3 voices from recordings in Settings: a bad entry is refused with the reason; Generate config lists them', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.click('#setBtn');
  await p.fill('#set-ZONOS_VOICES', 'Narrator = mailto:x');
  await p.locator('#set-ZONOS_VOICES').dispatchEvent('change');
  assert.match(await p.$eval('#set-ZONOS_VOICES', el => el.closest('.set-row').querySelector('.set-def').textContent), /Not changed: mailto:x isn't a web address/);
  await p.fill('#set-ZONOS_VOICES', 'Narrator = /tts-voices/narrator.wav | /tts-voices/second.wav');
  await p.locator('#set-ZONOS_VOICES').dispatchEvent('change');
  await p.click('#setGenerate');
  const cfg = await h.waitFor(async () => { const t = await p.$eval('#cfgText', el => el.value).catch(() => ''); return t && JSON.parse(t); }, 5000);
  assert.deepEqual(cfg.ZONOS_VOICES, [{ name: 'Narrator', url: '/tts-voices/narrator.wav' }, { name: 'second', url: '/tts-voices/second.wav' }]);
});

test('ZONOS3: a voice uploaded in Settings is kept, listed first and used; a file that isn\'t audio is refused', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.click('#setBtn');
  await p.setInputFiles('#znFile', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('NOTAUDIO not a recording') });
  await p.waitForFunction(() => /notes\.txt isn't a recording this browser can play/.test(document.querySelector('#znMsg').textContent));
  await p.setInputFiles('#znFile', require('node:path').join(__dirname, 'site', 'tts-voices', 'narrator.wav'));
  await p.waitForFunction(() => /Added narrator/.test(document.querySelector('#znMsg').textContent));
  assert.deepEqual(await p.$$eval('#znOwnList input', is => is.map(i => i.value)), ['narrator']);
  // Renamed in Settings, then chosen in the read-aloud bar.
  await p.fill('#znOwnList input', 'Me reading'); await p.locator('#znOwnList input').dispatchEvent('change');
  await p.waitForFunction(() => /Renamed to Me reading/.test(document.querySelector('#znMsg').textContent));
  await p.click('#setClose');
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  assert.equal((await voiceList(p))[0], 'Me reading (yours)');
  await p.selectOption('#ttsVoice', { label: 'Me reading (yours)' });
  await p.waitForFunction(() => window.zonosFake.requests.some(r => r.speaker_mode === 'embedding'), null, { timeout: 20000 });
  assert.equal((await fake(p)).speakers, 1);
  // Kept after a reload; deleted, it's gone from both lists.
  await p.reload(); await h.waitForBook(p);
  await p.click('#setBtn');
  await p.waitForFunction(() => document.querySelectorAll('#znOwnList li').length === 1);
  p.once('dialog', d => d.accept());
  await p.click('#znOwnList button:has-text("Delete")');
  await p.waitForFunction(() => /Deleted Me reading/.test(document.querySelector('#znMsg').textContent));
  assert.equal(await p.$$eval('#znOwnList li', l => l.length), 0);
});

test('ZONOS3: a voice recorded in Settings with the microphone is kept and listed', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  await p.click('#setBtn');
  await p.click('#znRecord');
  await p.waitForSelector('#znRec:not([hidden])');
  await p.waitForFunction(() => document.querySelector('#znTime').textContent === '0:02', null, { timeout: 10000 });
  await p.click('#znStop');
  await p.waitForSelector('.zn-save:not([hidden])');
  assert.equal(await p.isVisible('#znTake'), true, 'played back before saving');
  await p.fill('#znName', 'Recorded');
  await p.click('#znKeep');
  await p.waitForFunction(() => /Added Recorded/.test(document.querySelector('#znMsg').textContent), null, { timeout: 10000 });
  assert.deepEqual(await p.$$eval('#znOwnList input', is => is.map(i => i.value)), ['Recorded']);
  assert.equal(await p.isHidden('#znRec'), true);
});

test('ZONOS3: Settings closed while the browser asks for the microphone records nothing; a second Record meanwhile is ignored (round 34 review, H-56, H-57)', async () => {
  const p = await page();
  // (The browser's question answered after 1.5 s; every stream it gives kept, to see none is left on.)
  await p.addInitScript(() => {
    window.micStreams = [];
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async c => { const s = await real(c); window.micStreams.push(s); await new Promise(r => setTimeout(r, window.micDelay ?? 1500)); return s; };
  });
  await h.openReader(p, LONG, { ...zonos, 'spine:agreed:zonos': true });
  const live = () => p.evaluate(() => window.micStreams.filter(s => s.getTracks().some(t => t.readyState === 'live')).length);
  await p.click('#setBtn');
  await p.click('#znRecord');
  await p.click('#setClose');
  await p.waitForTimeout(2500);
  assert.equal(await live(), 0, 'the microphone is off');
  assert.equal(await p.isHidden('#znRec'), true);
  await p.click('#setBtn');
  await p.click('#znRecord');
  await p.click('#znRecord');
  await p.waitForSelector('#znRec:not([hidden])', { timeout: 5000 });
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => window.micStreams.length), 2, 'the second click asked for nothing more');
  await p.click('#znCancel');
  assert.equal(await live(), 0);
  // A take after these is whole, and saved.
  await p.evaluate(() => { window.micDelay = 0; });
  await p.click('#znRecord');
  await p.waitForFunction(() => document.querySelector('#znTime').textContent === '0:01', null, { timeout: 10000 });
  await p.click('#znStop');
  await p.waitForSelector('.zn-save:not([hidden])');
  await p.fill('#znName', 'After');
  await p.click('#znKeep');
  await p.waitForFunction(() => /Added After/.test(document.querySelector('#znMsg').textContent), null, { timeout: 10000 });
  assert.equal(await live(), 0);
});

test('ZONOS3: a lost GPU while a voice is being made from a recording stops reading with the reason (round 34 review, M-204)', async () => {
  const p = await page();
  await h.openReader(p, VOICES, { ...zonos, 'spine:agreed:zonos': true, 'spine:zonosVoice': `url:${h.SITE}/tts-voices/narrator.wav` });
  await p.evaluate(() => { window.zonosFakeHangSpeakers = true; });
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.speakerHangs > 0, null, { timeout: 20000 });
  await p.evaluate(() => window.zonosFatal('GPU device lost: test'));
  await p.waitForFunction(() => /reload the page/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 10000 });
});

test('ZONOS3: reading starts without waiting for the check of site voices not chosen (round 34 review, M-205)', async () => {
  await fetch(`${h.SITE}/__head?delay=6&path=no-such.wav`);
  try {
    const p = await page();
    await h.openReader(p, VOICES, { ...zonos, 'spine:agreed:zonos': true });
    const t0 = Date.now();
    await p.keyboard.press('r');
    await p.waitForFunction(() => window.zonosFake?.requests.length > 0, null, { timeout: 20000 });
    assert.ok(Date.now() - t0 < 4000, `first passage asked for after ${Date.now() - t0} ms`);
  } finally { await fetch(`${h.SITE}/__head?delay=0`); }
});

test('ZONOS3: a site voice\'s relative address is another voice in each folder (round 34 review, M-206)', async () => {
  const p = await page();
  const url = f => `${h.SITE}/${f}/index.html?book=/reader/books/long.epub`, id = f => `url:${h.SITE}/${f}/voice.wav`;
  await h.openReader(p, url('zonos-rel-a'), { ...zonos, 'spine:agreed:zonos': true, 'spine:zonosVoice': id('zonos-rel-a') });
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.requests.some(r => r.speaker_mode === 'embedding'), null, { timeout: 20000 });
  const a = (await fake(p)).requests.find(r => r.speaker_mode === 'embedding').embedding0;
  // The same browser (its storage kept) in the other folder, its voice chosen.
  await p.evaluate(v => localStorage.setItem('spine:zonosVoice', JSON.stringify(v)), id('zonos-rel-b'));
  await p.goto(url('zonos-rel-b')); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForFunction(() => window.zonosFake?.requests.some(r => r.speaker_mode === 'embedding'), null, { timeout: 20000 });
  const f = await fake(p);
  assert.equal(f.speakers, 1, 'made from this folder\'s recording');
  assert.notEqual(f.requests.find(r => r.speaker_mode === 'embedding').embedding0, a);
});

test('ZONOS3: a copy of the models from an older fetch-zonos.sh says to run it again (round 34 review, M-207)', async () => {
  const LOCAL = `${h.SITE}/zonos-local/index.html?book=/reader/books/long.epub`;
  let p = await page();
  await h.openReader(p, LOCAL, { ...zonos, 'spine:agreed:zonos': true, 'spine:zonosVoice': `url:${h.SITE}/tts-voices/narrator.wav` });
  await p.keyboard.press('r');
  await p.waitForFunction(() => /no speaker encoder.*run fetch-zonos\.sh again/.test(document.querySelector('#notice').textContent), null, { timeout: 20000 });
  assert.equal((await fake(p)).speakers || 0, 0, 'not handed to the engine');
  await p.close();
  p = await page({ fail: 'the edit manifest is a page' });
  await h.openReader(p, LOCAL, { ...zonos, 'spine:agreed:zonos': true });
  await p.keyboard.press('r');
  await p.waitForFunction(() => /older fetch-zonos\.sh: run it again/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
});
