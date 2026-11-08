// Device voices (Web Speech, with a fake speechSynthesis that reports word boundaries) and publisher
// narration (Media Overlays) (REVIEW.md T-3).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

// A speechSynthesis that "speaks" a word every 40 ms, reporting boundaries and the end as browsers do, and
// records each utterance (text, voice, rate).
function fakeSpeech() {
  const voices = [{ name: 'Plain Voice', lang: 'en-US', voiceURI: 'plain', default: true, localService: true },
    { name: 'Natural Voice', lang: 'en-GB', voiceURI: 'natural', default: false, localService: true },
    { name: 'Voix', lang: 'fr-FR', voiceURI: 'fr', default: false, localService: true }];
  let timer = null, current = null;
  window.__spoken = [];
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    addEventListener() {}, removeEventListener() {},
    cancel() { clearTimeout(timer); if (current) { const u = current; current = null; u.onerror?.({ error: 'interrupted' }); } this.speaking = false; },
    pause() {}, resume() {},
    speak(u) {
      current = u; this.speaking = true;
      window.__spoken.push({ text: u.text, voice: u.voice?.name || null, rate: u.rate, lang: u.lang });
      const words = [...u.text.matchAll(/\S+/g)];
      let k = 0;
      const step = () => {
        if (current !== u) return;
        if (k < words.length) { const w = words[k++]; u.onboundary?.({ name: 'word', charIndex: w.index, charLength: w[0].length }); timer = setTimeout(step, 40); }
        else { current = null; synth.speaking = false; u.onend?.({}); }
      };
      timer = setTimeout(step, 10);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  // (The real utterance only takes real voices.)
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; } };
}

test('device voices: the best voice for the book is used, words are highlighted, and it reads on (T-3)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeSpeech);
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': 'device' });
  await page.keyboard.press('r');
  const words = new Set();
  await h.waitFor(async () => { const w = await h.spokenWord(page); if (w) words.add(w); return words.size >= 5; }, 15000, 20);
  assert.ok(words.size >= 5, `highlighted: ${[...words].join(' ')}; errors: ${page.errors}`);
  const spoken = await page.evaluate(() => window.__spoken);
  assert.ok(spoken.length >= 1);
  assert.equal(spoken[0].voice, 'Natural Voice', 'English voices only, "Natural" ones first');
  assert.match(spoken[0].lang, /^en/);
  // On to the next sentence when one ends.
  assert.ok(await h.waitFor(() => page.evaluate(() => window.__spoken.length >= 2), 15000), 'the next sentence follows');
  // Faster: the next utterance carries the new rate.
  await page.keyboard.press(']');
  assert.ok(await h.waitFor(() => page.evaluate(() => window.__spoken.some(s => s.rate > 1.05)), 15000), 'the rate change reaches the voice');
  // Space pauses: nothing more is spoken.
  await page.keyboard.press(' ');
  const n = await page.evaluate(() => window.__spoken.length);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.__spoken.length), n);
});

test("publisher narration: each paragraph is marked with the book's class while its clip plays, then the next (T-3)", async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/narrated.epub`);
  // A narrated book starts with its narration chosen.
  await page.keyboard.press('r');
  const order = [];
  await h.waitFor(async () => {
    const now = await h.inFrame(page, doc => [...doc.querySelectorAll('.now-reading')].map(e => e.id).join(','));
    if (now && order.at(-1) !== now) order.push(now);
    return order.includes('n3');
  }, 15000, 50);
  assert.deepEqual(order.slice(0, 3), ['n1', 'n2', 'n3'], order.join(' '));
  // At the end of the narrated chapter the reader moves on to the next.
  assert.ok(await h.waitFor(async () => /spine 2\/2/.test(await page.textContent('#spinePos')), 15000), 'on to the next chapter');
  assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('.now-reading').length), 0);
});
