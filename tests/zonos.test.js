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

async function page({ gpu = true, fail = '' } = {}) {
  const p = await h.newPage();
  await p.addInitScript(([gpu, fail, fake]) => {
    window.SPINE_TEST = { zonosEngine: fake };
    if (fail) window.zonosFakeFail = fail;
    // (Headless Chromium may or may not have WebGPU: decided here, either way.)
    Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => gpu ? {} : undefined });
  }, [gpu, fail, `${h.SITE}/zonos-fake/engine.js`]);
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
  ].map(t => SPINE_TEST.zonosText(t, 'en_us')).concat(SPINE_TEST.zonosText('Il y a 3 chats.', 'fr_fr')));
  assert.deepEqual(out, [
    'In nineteen eighty-four, Doctor Smith paid five dollars and fifty cents for chapter twelve on May third.',
    'Chapter twelve. The twenty-first of one million two hundred and fifty thousand people; three point one four and forty-five percent and one pound and two dollars and one cent and three million euros.',
    'In ten sixty-six and nineteen oh five and two thousand and twenty twenty-four, (et cetera) and so on, et cetera. Then more.',
    'Room 12a, 3D, MP3, version 2.5.1, the nineties, the nineteen nineties, at ten thirty and nine oh five and twelve o\'clock.',
    'Il y a 3 chats.',
  ]);
});
