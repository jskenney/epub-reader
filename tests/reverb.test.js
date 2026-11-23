// Reverb-TTS in the browser (REVIEW.md E-50), with a stand-in engine (tests/site/reverb-fake/reverb.js: the exports
// the reader uses from reverb/engine/reverb.js, no WebGPU): when it is offered, the download agreement and size by
// precision and GPU, where the files come from, the preset voices, what each passage asks for (the book's language,
// the voice's codes and transcript, text spelled out), failures, a lost GPU, and a site that turns it off.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

// (Reverb is off unless a site turns it on, REVERB: true: reverb-on is the reader with that config.)
const ON = `${h.SITE}/reverb-on/`;
const LONG = `${ON}?book=/reader/books/long.epub`;
const FRENCH = `${ON}?book=/reader/books/french.epub`;
const LATIN = `${ON}?book=/reader/books/latin.epub`;
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

test('Reverb is off unless a site turns it on; then offered for books in its languages and with WebGPU, saying why not otherwise', async () => {
  for (const [url, gpu, want] of [[LONG, undefined, ['Reverb', false, false]], [FRENCH, undefined, ['Reverb', false, false]],
    [LATIN, undefined, ['Reverb (en, de, fr, es, it, pl, pt)', true, false]], [LONG, false, ['Reverb (needs WebGPU)', true, false]],
    [`${h.SITE}/reverb-off/?book=/reader/books/long.epub`, undefined, ['Reverb (off on this site)', true, true]],
    [`${h.READER}?book=books/long.epub`, undefined, ['Reverb (off on this site)', true, true]]]) {
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
    tokenizerPath: HUB + 'model/tokenizer.json', dtype: 'f16', verbalize: false });
  assert.equal(f.cache, 'spine-reverb-f5759ca1', 'kept in the browser under the revision');
  assert.deepEqual(f.gpuOpts, { device: { optionalFeatures: ['subgroups', 'shader-f16'] } });
  const first = f.requests[0];
  assert.equal(first.language, 'en');
  assert.equal(first.transcript, 'Hub en_female_narrator.', "the voice's own transcript goes with its codes");
  assert.equal(first.seed, 0);
  assert.ok(f.requests.every(r => !/\d/.test(r.text)), 'the reader spells the text out: ' + JSON.stringify(f.requests.map(r => r.text)));
  assert.equal(f.opts.verbalize, false, 'runntime is given no verbalize, which would drop the voices\' speechFrames (round 40 review, M-214)');
  assert.equal(first.speechFrames, 2, 'the preset voice\'s speechFrames reach runntime');
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
  // (The voice's words spelled out in its own language, as the reader now does: "2" as "two", M-214.)
  await p.waitForFunction(() => window.reverbFake.requests.some(r => r.transcript === 'Hub en_male_narrator_two.'), null, { timeout: 20000 });
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
        tokenizerPath: base + 'model/tokenizer.json', dtype: null, verbalize: false });
      assert.equal(f.requests[0].transcript, 'Local en_female_narrator.', 'voices from this site too');
      assert.deepEqual(p.hub, [], 'nothing from Hugging Face');
    } else assert.ok(f.opts.modelPath.startsWith(HUB), `${folder} ${precision}: ${f.opts.modelPath}`);
    await p.close();
  }
});

test('Reverb: without the files here and with ALLOW_CDN off, says to run fetch-reverb.sh', async () => {
  const p = await page();
  await openBar(p, `${h.SITE}/reverb-nocdn/?book=/reader/books/long.epub`, { ...reverb, 'spine:agreed:reverb:full': true });
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

// Custom voices (E-50): yours from Settings (with their words and language) and the site's (REVERB_VOICES).
const NARRATOR = require('node:path').join(__dirname, 'site', 'tts-voices', 'reverb-clip.wav');
const listed = p => p.$$eval('#ttsVoice option', os => os.map(o => o.textContent));

test('Reverb: a voice uploaded in Settings is listed once its words are given, made once from them, and used', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.click('#setBtn');
  await p.setInputFiles('#znFile', NARRATOR);
  await p.waitForFunction(() => /Added reverb-clip.*for Reverb, give the words said in it/.test(document.querySelector('#znMsg').textContent));
  await p.click('#setClose');
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  assert.ok(!(await listed(p)).some(t => /reverb-clip \(/.test(t) && /yours/.test(t)), 'not listed without its words');
  // Its words and language given in Settings: listed first.
  await p.click('#ttsClose');
  await p.click('#setBtn');
  await p.fill('#znOwnList .zn-text', 'A test clip, 2 seconds long.');
  await p.locator('#znOwnList .zn-text').dispatchEvent('change');
  await p.waitForFunction(() => /its words kept; Reverb lists it/.test(document.querySelector('#znMsg').textContent));
  await p.selectOption('#znOwnList .zn-lang', 'de');
  await p.waitForFunction(() => /its words kept/.test(document.querySelector('#znMsg').textContent));
  await p.click('#setClose');
  await p.keyboard.press('r');
  await p.waitForSelector('#tts:not([hidden])');
  await p.waitForFunction(() => document.querySelector('#ttsVoice option')?.textContent === 'reverb-clip (de, yours)');
  await p.selectOption('#ttsVoice', { label: 'reverb-clip (de, yours)' });
  await p.waitForFunction(() => window.reverbFake.requests.some(r => r.transcript === 'A test clip, de2 seconds long.'), null, { timeout: 20000 });
  let f = await fake(p);
  assert.equal(f.made.length, 1, 'made once');
  assert.deepEqual(f.made[0], { seconds: 4, rate: 24000, transcript: 'A test clip, de2 seconds long.', language: 'de' }, 'its words spelled out in its own language');
  assert.equal(f.makerCodec, CODEC, 'the voice maker uses the codec already loaded');
  assert.equal(f.requests.at(-1).speechFrames, 3, 'the made voice\'s speechFrames reach runntime (M-214)');
  assert.equal(f.requests.at(-1).language, 'en', 'the book read in its language');
  // Kept: after a reload it isn't made again.
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  f = await fake(p);
  assert.equal(f.made, undefined, 'not made again');
  assert.equal(f.requests[0].transcript, 'A test clip, de2 seconds long.');
  // Deleted: gone from the list, and the choice falls back to a preset voice.
  await p.click('#ttsClose');
  await p.click('#setBtn');
  p.once('dialog', d => d.accept());
  await p.click('#znOwnList button:has-text("Delete")');
  await p.waitForFunction(() => /Deleted reverb-clip/.test(document.querySelector('#znMsg').textContent));
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('spine:reverbVoice'))), '');
  const keys = await p.evaluate(() => new Promise(res => { const rq = indexedDB.open('spine-zonos-voices'); rq.onsuccess = () => { const g = rq.result.transaction('emb').objectStore('emb').getAllKeys(); g.onsuccess = () => res(g.result); }; }));
  assert.deepEqual(keys.filter(k => String(k).startsWith('rv|')), [], 'its made voice deleted too');
});

test('Reverb: a voice recorded in Settings takes the passage read as its words', async () => {
  const p = await page();
  await p.addInitScript(() => {
    // (A microphone that plays a tone.)
    navigator.mediaDevices.getUserMedia = async () => { const c = new AudioContext(), o = c.createOscillator(), d = c.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; };
  });
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.click('#setBtn');
  await p.click('#znRecord');
  await p.waitForSelector('#znStop:not([hidden])');
  await p.waitForTimeout(1500);
  await p.click('#znStop');
  await p.waitForSelector('.zn-save:not([hidden])');
  await p.fill('#znName', 'Recorded');
  await p.click('#znKeep');
  await p.waitForFunction(() => /Added Recorded.*or Reverb's/.test(document.querySelector('#znMsg').textContent));
  await p.waitForSelector('#znOwnList .zn-text', { state: 'attached' });
  assert.match(await p.$eval('#znOwnList .zn-text', i => i.value), /^The old house stood at the end of the lane.*come back to it\.$/);
  assert.equal(await p.$eval('#znOwnList .zn-lang', s => s.value), 'en');
});

test('Reverb site voices (REVERB_VOICES): words given or beside the recording, made once each; a voice without words says why', async () => {
  const p = await page();
  const url = `${h.SITE}/reverb-voices/?book=/reader/books/long.epub`;
  await openBar(p, url, { ...reverb, 'spine:agreed:reverb:full': true });
  assert.deepEqual((await listed(p)).slice(0, 3), ['Site narrator (fr, this site)', 'Teller (en, this site)', 'No words (en, this site)'], 'bad entries left out');
  await p.selectOption('#ttsVoice', { label: 'Teller (en, this site)' });
  await p.waitForFunction(() => window.reverbFake?.made?.some(m => m.transcript === 'Words beside the teller.'), null, { timeout: 20000 });
  await p.selectOption('#ttsVoice', { label: 'Site narrator (fr, this site)' });
  await p.waitForFunction(() => window.reverbFake.requests.some(r => r.transcript === "The narrator's words."), null, { timeout: 20000 });
  let f = await fake(p);
  assert.deepEqual(f.made.map(m => [m.transcript, m.language]), [['Words beside the teller.', 'en'], ["The narrator's words.", 'fr']]);
  // Without words (no "text", no .txt): reading stops with the reason.
  await p.selectOption('#ttsVoice', { label: 'No words (en, this site)' });
  await p.waitForFunction(() => /words \(a \.txt beside the recording\) for No words isn't at .*second\.txt/.test(document.querySelector('#notice')?.textContent || ''), null, { timeout: 20000 });
  // Generate config gives the list back.
  await p.click('#ttsClose');
  await p.click('#setBtn');
  await p.click('#setGenerate');
  const cfg = await h.waitFor(async () => { const t = await p.$eval('#cfgText', el => el.value).catch(() => ''); return t && JSON.parse(t); }, 5000);
  assert.deepEqual(cfg.REVERB_VOICES, [
    { name: 'Site narrator', url: '/tts-voices/reverb-clip.wav', text: "The narrator's words.", language: 'fr' },
    { name: 'Teller', url: '/tts-voices/teller.wav', language: 'en' }, { name: 'No words', url: '/tts-voices/second.wav', language: 'en' }]);
});

test('Reverb: a recording the voice maker refuses stops reading with the reason', async () => {
  const p = await page();
  await p.addInitScript(() => { window.reverbFakeMakerFail = 'too quiet'; });
  await openBar(p, `${h.SITE}/reverb-voices/?book=/reader/books/long.epub`, { ...reverb, 'spine:agreed:reverb:full': true, 'spine:reverbVoice': 'url:' + `${h.SITE}/tts-voices/teller.wav` });
  await p.waitForFunction(() => /Teller couldn't be made into a voice \(too quiet\)/.test(document.querySelector('#notice')?.textContent || ''), null, { timeout: 20000 });
});

// Round 40 review.
const VOICES = `${h.SITE}/reverb-voices/?book=/reader/books/long.epub`;
const opfs = (p, fn) => p.evaluate(fn);

test('Reverb: a site voice\'s version is kept, so a visit where its check fails still plays its saved speech (round 40 review, M-215)', async () => {
  let p = await page();
  await openBar(p, VOICES, { ...reverb, 'spine:agreed:reverb:full': true, 'spine:reverbVoice': `url:${h.SITE}/tts-voices/reverb-clip.wav` });
  await p.waitForFunction(() => window.reverbFake?.requests.length >= 2, null, { timeout: 20000 });
  await p.keyboard.press(' ');
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('spine:reverbVersions')));
  assert.ok(kept[`${h.SITE}/tts-voices/reverb-clip.wav`], JSON.stringify(kept));
  // The recording now unreachable (offline, say): saved speech still plays, and the voice isn't made again.
  await p.route('**/tts-voices/reverb-clip.wav', r => r.abort());
  await p.reload(); await h.waitForBook(p);
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), 'reads from saved speech');
  const f = await fake(p);
  assert.equal(f?.made, undefined, 'not made again');
  // (Passages beyond those saved are made with the kept voice, its recording not needed.)
  assert.ok((f?.requests || []).every(r => r.transcript === "The narrator's words."), JSON.stringify(f?.requests));
  assert.doesNotMatch(await h.notice(p), /couldn't be fetched/);
});

test('Reverb: a site voice\'s words corrected in its .txt make it again (round 40 review, L-452)', async () => {
  const fs = require('node:fs'), txt = require('node:path').join(__dirname, 'site', 'tts-voices', 'teller.txt');
  const before = fs.readFileSync(txt, 'utf8');
  try {
    let p = await page();
    await openBar(p, VOICES, { ...reverb, 'spine:agreed:reverb:full': true, 'spine:reverbVoice': `url:${h.SITE}/tts-voices/teller.wav` });
    await p.waitForFunction(() => window.reverbFake?.made?.length === 1, null, { timeout: 20000 });
    await p.keyboard.press(' ');
    fs.writeFileSync(txt, 'Corrected words beside the teller.\n');
    const t = new Date(Date.now() + 5000); fs.utimesSync(txt, t, t);
    await p.reload(); await h.waitForBook(p);
    await p.keyboard.press('r');
    await p.waitForFunction(() => window.reverbFake?.made?.some(m => m.transcript === 'Corrected words beside the teller.'), null, { timeout: 20000 });
  } finally { fs.writeFileSync(txt, before); }
});

test('Reverb: runntime\'s reason is shown, not only its code (round 40 review, L-454)', async () => {
  const p = await page();
  await openBar(p, VOICES, { ...reverb, 'spine:agreed:reverb:full': true, 'spine:reverbVoice': `url:${h.SITE}/tts-voices/teller.wav` });
  await p.evaluate(() => { window.reverbFakeMakerFail = 'longer than 30 s this device takes'; });
  assert.match(await h.noticeLike(p, /longer than 30 s this device takes/, 20000), /longer than 30 s this device takes/);
});

test('Reverb: other revisions\' copies are removed after loading (this one\'s kept); a copy not kept, or no place to keep one, is said (round 40 review, L-455)', async () => {
  let p = await page();
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await opfs(p, async () => {
    const root = await navigator.storage.getDirectory();
    const old = await root.getDirectoryHandle('spine-reverb-00000000', { create: true });
    await (await old.getFileHandle('st_reverb-v1_old', { create: true })).createWritable().then(async w => { await w.write('x'); await w.close(); });
    const cur = await root.getDirectoryHandle('spine-reverb-f5759ca1', { create: true });
    await (await cur.getFileHandle('st_reverb-v1_huggingface.co_other_precision', { create: true })).createWritable().then(async w => { await w.write('x'); await w.close(); });
  });
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  const left = await opfs(p, async () => {
    const root = await navigator.storage.getDirectory(), out = [];
    for await (const [n, hd] of root.entries()) { if (!n.startsWith('spine-reverb-')) continue; out.push(n); if (hd.kind === 'directory') for await (const k of hd.keys()) out.push('  ' + k); }
    return out;
  });
  assert.ok(!left.includes('spine-reverb-00000000'), left.join('\n'));
  // (The current revision's other copies stay: another folder of the site may use them: round 41.)
  assert.ok(left.some(k => /other_precision/.test(k)), left.join('\n'));
  assert.equal(left.filter(k => /^  st_reverb-v1_huggingface/.test(k)).length, 3, 'the weights and codec in use stay: ' + left.join('\n'));
  await p.close();
  // A browser that didn't keep its copy.
  p = await page();
  await p.addInitScript(() => { window.reverbFakeNoKeep = true; });
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.keyboard.press('r');
  assert.match(await h.noticeLike(p, /didn't keep a copy of Reverb's files/, 20000), /didn't keep a copy of Reverb's files/);
  await p.close();
  // ... and one with no private file system.
  p = await page();
  await p.addInitScript(() => { window.reverbFakeNoOpfs = true; });
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.keyboard.press('r');
  assert.match(await h.noticeLike(p, /can't keep a copy of Reverb's files/, 20000), /can't keep a copy of Reverb's files/);
});

test('Reverb: a GPU lost while it loads leaves it failed with the reason, not ready (round 40 review, L-456)', async () => {
  const p = await page();
  await p.addInitScript(() => { window.reverbFakeLoseDuringLoad = true; });
  await openBar(p, LONG, { ...reverb, 'spine:agreed:reverb:full': true });
  await p.waitForFunction(() => /stopped working \(lost while loading\)/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.equal(await p.textContent('#ttsDownload'), 'Try again');
});

test('Reverb off (the default): its option hidden, a stored choice of it reads with the device voice, "Your voices" says nothing of it, Generate config gives REVERB false (round 40 review, L-457, T-66)', async () => {
  const p = await page();
  await openBar(p, `${h.READER}?book=books/long.epub`, { ...reverb, 'spine:agreed:reverb:full': true });
  assert.deepEqual(await optionOf(p), ['Reverb (off on this site)', true, false], 'shown, as it is the choice stored, but not usable');
  assert.equal(await p.isHidden('#ttsDownload'), true, 'no download offered');
  await p.waitForTimeout(500);
  assert.equal(await fake(p), null, 'nothing loaded');
  await p.click('#ttsClose');
  await p.click('#setBtn');
  await p.setInputFiles('#znFile', NARRATOR);
  await p.waitForFunction(() => /Added reverb-clip/.test(document.querySelector('#znMsg').textContent));
  assert.doesNotMatch(await p.textContent('#znMsg'), /Reverb/);
  assert.equal(await p.isHidden('#znOwnList .zn-words'), true);
  assert.equal(await p.isHidden('#znRvNote'), true);
  await p.click('#setGenerate');
  const cfg = await h.waitFor(async () => { const t = await p.$eval('#cfgText', el => el.value).catch(() => ''); return t && JSON.parse(t); }, 5000);
  assert.equal(cfg.REVERB, false);
});

test('Reverb: download progress in MB is announced by quarters, not every step (round 40 review, L-458)', async () => {
  const p = await page();
  await p.addInitScript(() => { window.reverbFakeSteps = 40; });
  await openBar(p, LONG, reverb);
  await p.evaluate(() => { window.said = []; new MutationObserver(() => window.said.push(document.querySelector('#ttsAnnounce').textContent)).observe(document.querySelector('#ttsAnnounce'), { childList: true, characterData: true, subtree: true }); });
  await p.click('#ttsDownload');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  const said = await p.evaluate(() => window.said.filter(t => /Downloading Reverb/.test(t)));
  assert.ok(said.length >= 1 && said.length <= 5, said.join(' | '));
});

// Round 41.
test('Reverb: a first download shows no notice; two folders of a site keep their own copies (round 41)', async () => {
  const p = await page();
  await h.openReader(p, LONG, { ...reverb, 'spine:agreed:reverb:int4': true, 'spine:set:FULL_PRECISION': false });
  await p.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(p), 20000));
  await p.waitForTimeout(800);
  assert.equal(await h.notice(p), '', 'no notice on a first download');
  // Another folder with its own copy, then the first again: neither downloads again.
  const local = `${h.SITE}/reverb-local/?book=/reader/books/long.epub`;
  for (const url of [local, LONG, local]) {
    await p.goto(url); await h.waitForBook(p);
    await p.keyboard.press('r');
    assert.ok(await h.waitFor(() => h.spokenWord(p), 20000), url);
    await p.waitForTimeout(800);
    assert.equal(await h.notice(p), '', `${url}: no notice`);
  }
  const f = await fake(p);
  assert.equal(f.opts.modelPath.startsWith(`${h.SITE}/reverb-local/`), true);
  const loads = await p.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('spine-reverb-f5759ca1'); const n = []; for await (const k of d.keys()) n.push(k); return n; });
  assert.equal(loads.filter(k => /int4/.test(k)).length, 2, 'both folders\' int4 copies kept: ' + loads.join(' '));
});

test('Reverb on: a voice of your own stored before shows its words field; Settings shows the credits, and the download offer says where (round 41)', async () => {
  const p = await page();
  await h.openReader(p, LONG, reverb);
  await p.click('#setBtn');
  await p.setInputFiles('#znFile', NARRATOR);
  await p.waitForFunction(() => /Added reverb-clip/.test(document.querySelector('#znMsg').textContent));
  await p.reload(); await h.waitForBook(p);
  await p.click('#setBtn');
  await p.waitForSelector('#znOwnList .zn-words');
  assert.equal(await p.isVisible('#znOwnList .zn-words'), true, 'its words field, drawn before the config, shown now');
  assert.equal(await p.isVisible('#rvCredits'), true);
  assert.match(await p.textContent('#rvCredits'), /Built with Higgs Materials licensed from Boson AI USA, Inc\..*based on Meta Llama 3/);
  assert.match(await p.textContent('#rvCredits'), /CC BY-NC 4\.0/);
  await p.click('#setClose');
  await p.keyboard.press('r');
  await p.waitForFunction(() => /credits and licences in Settings/.test(document.querySelector('#ttsStatus').textContent));
});
