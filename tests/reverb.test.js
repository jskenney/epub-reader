// Reverb-TTS in the browser (REVIEW.md E-50), with a stand-in engine (tests/site/reverb-fake/reverb.js: the exports
// the reader uses from reverb/engine/reverb.js, no WebGPU): when it is offered, the download agreement and size by
// precision and GPU, where the files come from, the preset voices, what each passage asks for (the book's language,
// the voice's codes and transcript, text spelled out), failures, a lost GPU, and a site that turns it off.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const FRENCH = `${h.READER}?book=books/french.epub`;
const LATIN = `${h.READER}?book=books/latin.epub`;
const reverb = { 'spine:ttsEngine': 'reverb' };
const HUB = 'https://huggingface.co/software-mansion/Reverb-TTS/resolve/f5759ca1b6c4efc4a5b7113068560323730628a5/';
const CODEC = 'https://huggingface.co/software-mansion/higgs-audio-v2-tokenizer-Reverb/resolve/e0d9ccd2935d7f953764a83b09444dc0677a44a0/combined/safetensors/d8e8/model.safetensors';

// gpu: false (no WebGPU), or the adapter's features. Preset voices from "Hugging Face" are answered here.
async function page({ gpu = ['shader-f16'], fail = '', origin = h.SITE } = {}) {
  const p = await h.newPage();
  await p.addInitScript(([gpu, fail, fake]) => {
    window.SPINE_TEST = { reverbEngine: fake };
    if (fail) window.reverbFakeFail = fail;
    const g = gpu && { requestAdapter: async () => ({ features: new Set(gpu) }) };
    Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => g || undefined });
  }, [gpu, fail, `${origin}/reverb-fake/reverb.js`]);
  p.hub = [];
  await p.route('https://huggingface.co/**', route => {
    const u = route.request().url();
    p.hub.push(u);
    const m = /\/voices\/([a-z_0-9]+)\.json$/.exec(u);
    if (!m) return route.abort();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: m[1], language: m[1].slice(0, 2),
      transcript: `Hub ${m[1]}.`, frames: 2, duration: 0.08, speech_frames: 2, codes: Array.from({ length: 16 }, (_, i) => i) }) });
  });
  return p;
}
const optionOf = p => p.$eval('#ttsEngine option[value=reverb]', o => [o.textContent, o.disabled, o.hidden]);
const fake = p => p.evaluate(() => window.reverbFake ? JSON.parse(JSON.stringify(window.reverbFake)) : null);
const status = p => p.textContent('#ttsStatus');
async function openBar(p, url, settings) {
  await h.openReader(p, url, settings);
  await p.keyboard.press('r');
  await p.waitForSelector('#tts:not([hidden])');
}

test('Reverb is offered for books in its languages and with WebGPU, says why not otherwise, and a site can turn it off', async () => {
  for (const [url, gpu, want] of [[LONG, undefined, ['Reverb', false, false]], [FRENCH, undefined, ['Reverb', false, false]],
    [LATIN, undefined, ['Reverb (en, de, fr, es, it, pl, pt)', true, false]], [LONG, false, ['Reverb (needs WebGPU)', true, false]],
    [`${h.SITE}/reverb-off/?book=/reader/books/long.epub`, undefined, ['Reverb (off on this site)', true, true]]]) {
    const p = await page({ gpu });
    await openBar(p, url, { 'spine:ttsEngine': 'device' });
    assert.deepEqual(await optionOf(p), want, `${url} ${gpu === false ? 'without' : 'with'} WebGPU`);
    await p.close();
  }
});

test('Reverb: agreeing to the download loads fp16 from Hugging Face, lists the voices, and reads in the book\'s language', async () => {
  const p = await page();
  await openBar(p, LONG, reverb);
  // Asked first, with the size (full precision: fp16 weights, the codec and the tokenizer).
  await p.waitForFunction(() => /Reverb: one-time ~753 MB download/.test(document.querySelector('#ttsStatus').textContent));
  assert.equal(await fake(p), null, 'nothing loaded before agreeing');
  // The voices are listed before the download: English first, in the book's language.
  const voices = await p.$$eval('#ttsVoice option', os => os.map(o => [o.value, o.textContent]));
  assert.deepEqual(voices.slice(0, 2), [['en_female_narrator', 'Narrator (en, female)'], ['en_male_narrator_1', 'Narrator 1 (en, male)']]);
  assert.equal(voices.length, 16);
  assert.deepEqual(voices[5], ['de_female_standard', 'Standard (de, female)']);
  await p.click('#ttsDownload');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads after loading');
  const f = await fake(p);
  assert.deepEqual(f.opts, { modelPath: HUB + 'model/safetensors/fp16/model.safetensors', codecPath: CODEC,
    tokenizerPath: HUB + 'model/tokenizer.json', dtype: 'f16' });
  assert.equal(f.cache, 'spine-reverb-f5759ca1', 'kept in the browser under the revision');
  assert.deepEqual(f.gpuOpts, { device: { optionalFeatures: ['subgroups', 'shader-f16'] } });
  const first = f.requests[0];
  assert.equal(first.language, 'en');
  assert.equal(first.transcript, 'Hub en_female_narrator.', "the voice's own transcript goes with its codes");
  assert.equal(first.seed, 0);
  assert.ok(f.requests.every(r => !/\d/.test(r.spoken)), JSON.stringify(f.requests.map(r => r.spoken)));
  assert.ok(p.hub.includes(HUB + 'voices/en_female_narrator.json'));
  assert.deepEqual(p.blocked, []);
  // A reload doesn't ask again.
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads without asking again');
  assert.equal(await p.isHidden('#ttsDownload'), true);
});

test('Reverb: full precision on a GPU without shader-f16 uses int8 in 32-bit math; off, int4', async () => {
  let p = await page({ gpu: [] });
  await openBar(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => window.reverbFake?.requests.length > 0, null, { timeout: 20000 });
  let f = await fake(p);
  assert.equal(f.opts.modelPath, HUB + 'model/runntime/int8/model.safetensors');
  assert.equal(f.opts.dtype, 'f32');
  await p.close();
  p = await page();
  await openBar(p, LONG, { ...reverb, 'spine:set:FULL_PRECISION': false });
  await p.waitForFunction(() => /Reverb: one-time ~368 MB download/.test(document.querySelector('#ttsStatus').textContent));
  await p.click('#ttsDownload');
  await p.waitForFunction(() => window.reverbFake?.requests.length > 0, null, { timeout: 20000 });
  f = await fake(p);
  assert.equal(f.opts.modelPath, HUB + 'model/runntime/int4/model.safetensors');
  assert.equal(f.opts.dtype, null, "runntime's own choice on a GPU with fp16");
});

test('Reverb: a French book is read in French, and a chosen voice is kept', async () => {
  const p = await page();
  await openBar(p, FRENCH, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => window.reverbFake?.requests.length > 0, null, { timeout: 20000 });
  let f = await fake(p);
  assert.equal(f.requests[0].language, 'fr');
  assert.equal(f.requests[0].transcript, 'Hub fr_female_standard.', "the book's language's voice first");
  assert.deepEqual((await p.$$eval('#ttsVoice option', os => os.map(o => o.value))).slice(0, 2), ['fr_female_standard', 'fr_male_standard']);
  await p.selectOption('#ttsVoice', 'en_male_narrator_2');
  await p.waitForFunction(() => window.reverbFake.requests.some(r => r.transcript === 'Hub en_male_narrator_2.'), null, { timeout: 20000 });
  f = await fake(p);
  assert.equal(f.requests.at(-1).language, 'fr', 'any voice reads the book in its language');
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  await p.waitForSelector('#tts:not([hidden])');
  assert.equal(await p.$eval('#ttsVoice', s => s.value), 'en_male_narrator_2');
});

test('Reverb files are used from this site only when fetch-reverb.sh finished, and with the weights asked for', async () => {
  for (const [folder, precision, local] of [['reverb-local', false, true], ['reverb-partial', false, false], ['reverb-local', true, false]]) {
    const p = await page();
    await openBar(p, `${h.SITE}/${folder}/?book=/reader/books/long.epub`, { ...reverb, 'spine:agreed:reverb:int4': true,
      'spine:agreed:reverb:full': true, 'spine:set:FULL_PRECISION': precision });
    await p.waitForFunction(() => window.reverbFake?.requests.length > 0, null, { timeout: 20000 });
    const f = await fake(p), base = `${h.SITE}/${folder}/reverb/models/`;
    if (local) {
      assert.deepEqual(f.opts, { modelPath: base + 'model/runntime/int4/model.safetensors', codecPath: base + 'codec/model.safetensors',
        tokenizerPath: base + 'model/tokenizer.json', dtype: null });
      assert.equal(f.requests[0].transcript, 'Local en_female_narrator.', 'voices from this site too');
      assert.deepEqual(p.hub, [], 'nothing from Hugging Face');
    } else assert.ok(f.opts.modelPath.startsWith(HUB), `${folder} ${precision}: ${f.opts.modelPath}`);
    await p.close();
  }
});

test('Reverb: without the files here and with ALLOW_CDN off, says to run fetch-reverb.sh', async () => {
  const p = await page();
  await openBar(p, `${h.SITE}/folder-novoice/?book=/reader/books/long.epub`, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => /Natural voice failed/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.match(await status(p), /self-hosted Reverb files are missing \(run fetch-reverb\.sh\); ALLOW_CDN is off/);
  assert.equal((await fake(p))?.loads, undefined, 'nothing downloaded');
});

test('Reverb: an engine that fails to start says so and can be tried again', async () => {
  const p = await page({ fail: 'out of memory' });
  await openBar(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => /Natural voice failed: out of memory/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.equal(await p.textContent('#ttsDownload'), 'Try again');
  await p.evaluate(() => { delete window.reverbFakeFail; });
  await p.click('#ttsDownload');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads after trying again');
  assert.equal((await fake(p)).loads, 2);
});

test('Reverb: no GPU adapter is explained', async () => {
  const p = await page();
  await p.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => null }) }));
  await openBar(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => /Natural voice failed/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.match(await status(p), /WebGPU isn't usable in this browser \(WebGPU found no GPU to use\)/);
});

test('Reverb: a lost GPU stops the voice with the reason, and "Try again" says to reload', async () => {
  const p = await page();
  await openBar(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  await p.evaluate(() => window.reverbLose('GPU device lost: test'));
  await p.waitForFunction(() => /stopped working \(GPU device lost: test\)/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 10000 });
  assert.equal(await p.textContent('#ttsDownload'), 'Try again');
  await p.click('#ttsDownload');
  await p.waitForFunction(() => /reload the page/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 10000 });
  assert.equal((await fake(p)).loads, 1, 'not loaded again on a lost GPU');
});

test('Reverb: Generate config gives REVERB, and readAloud "reverb" is kept', async () => {
  const p = await page();
  await openBar(p, LONG, reverb);
  await p.keyboard.press('Escape');
  await p.click('#setBtn');
  await p.click('#setGenerate');
  const cfg = await h.waitFor(async () => { const t = await p.$eval('#cfgText', el => el.value).catch(() => ''); return t && JSON.parse(t); }, 5000);
  assert.equal(cfg.REVERB, true);
  assert.equal(cfg.readAloud, 'reverb');
});
