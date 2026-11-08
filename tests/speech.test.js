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

test("a second narrated book with the same audio path plays its own recording, not the first one's (M-17)", async () => {
  const page = await h.newPage();
  // Keep a reference to every Audio element the page makes, to see which recording narration plays.
  await page.addInitScript(() => { const A = window.Audio; window.__audios = []; window.Audio = function (...a) { const x = new A(...a); window.__audios.push(x); return x; }; window.Audio.prototype = A.prototype; });
  await h.openReader(page, `${h.READER}?book=books/narrated.epub`);
  await page.keyboard.press('r');
  await h.waitFor(() => h.inFrame(page, doc => !!doc.querySelector('.now-reading')), 10000, 50);
  await page.keyboard.press(' ');
  await page.setInputFiles('#fileInput', require('node:path').join(__dirname, 'site', 'reader', 'books', 'narrated-b.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Narrated Book B', null, { timeout: 15000 });
  await h.waitForBook(page);
  await page.keyboard.press('r');
  const duration = await h.waitFor(() => page.evaluate(() => {
    // (Not the silent clip that keeps media controls showing: the one playing the book's narration.)
    const a = window.__audios.find(x => !x.paused && x.duration > 0.5 && Math.abs(x.duration - 10) > 0.5);
    return a ? a.duration : 0;
  }), 10000, 100);
  assert.ok(Math.abs(duration - 6) < 0.3, `narration plays a ${duration} s recording (B's is 6 s, A's 1.8 s)`);
});

test('closing the bar while the voice server is being checked: nothing starts reading afterwards (M-18)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeSpeech);
  // The voice server hangs, then fails: the reader would fall back to the device voice.
  await page.route('**/tts/health', async route => { await new Promise(r => setTimeout(r, 3000)); await route.fulfill({ status: 503, body: 'down' }); });
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  await page.click('#ttsClose');
  await page.waitForTimeout(5000);
  assert.equal(await page.isVisible('#tts'), false);
  assert.deepEqual(await page.evaluate(() => window.__spoken.map(s => s.text)), [], 'nothing is spoken once the bar is closed');
});

test('clicking a picture-only page while paused stays on it (L-49); focus and announcements in the bar (L-54)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeSpeech);
  await h.openReader(page, h.READER, { 'spine:ttsEngine': 'device' });   // the sample opens on its cover picture
  await page.keyboard.press('r');   // (the cover has no text: reading moves on to the next section)
  await page.waitForFunction(() => /spine 2\//.test(document.querySelector('#spinePos').textContent), null, { timeout: 10000 });
  await page.keyboard.press(' ');   // paused, bar open
  await page.click('#tocList a >> nth=0');   // back to the cover
  await page.waitForFunction(() => /spine 1\//.test(document.querySelector('#spinePos').textContent) && document.querySelector('#page').contentDocument?.querySelector('img'), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => { const f = document.querySelector('#page').getBoundingClientRect(), r = document.querySelector('#page').contentDocument.querySelector('img').getBoundingClientRect(); return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1000);
  assert.match(await page.textContent('#spinePos'), /spine 1\//, 'still on the cover');
  // (The visible status changes at every download step; a hidden live region announces it only when its kind
  // changes: L-68.)
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#notice').getAttribute('role'), document.querySelector('#ttsStatus').getAttribute('role'),
    document.querySelector('#ttsAnnounce').getAttribute('role')]), ['alert', null, 'status']);
  await page.click('#ttsClose');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'ttsBtn', 'focus goes to the read-aloud button, not the page');
});

test('a chosen engine that is unavailable stays shown, so choosing Device instead is saved (L-55)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeSpeech);
  await page.route('**/tts/health', route => route.fulfill({ status: 503, body: 'down' }));
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r');
  await page.waitForFunction(() => document.querySelector('#ttsEngine').selectedOptions[0]?.textContent === 'Server (unavailable)', null, { timeout: 10000 });
  await page.selectOption('#ttsEngine', 'device');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('spine:ttsEngine'))), 'device');
});

test('a new reader sees Device for a book without narration, not an unavailable narration (round 8 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(fakeSpeech);
  await h.openReader(page, `${h.READER}?book=books/long.epub`);   // nothing stored: the default engine
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  assert.equal(await page.$eval('#ttsEngine', s => s.selectedOptions[0].textContent), 'Device');
  assert.equal(await page.getAttribute('#ttsEngine', 'title'), '');
  // Space pauses with the position ribbon focused (it isn't a control that wants Space).
  await page.focus('#ribbon');
  await page.keyboard.press(' ');
  await page.waitForFunction(() => document.querySelector('#ttsPlay').getAttribute('aria-label') === 'Play', null, { timeout: 5000 });
});

test('narration paused: a click after the last narrated paragraph stays in the chapter (L-49)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/narrated.epub`);
  await page.keyboard.press('r');
  await h.waitFor(() => h.inFrame(page, doc => !!doc.querySelector('.now-reading')), 10000, 50);
  await page.keyboard.press(' ');
  const box = await page.evaluate(() => { const f = document.querySelector('#page').getBoundingClientRect(), r = document.querySelector('#page').contentDocument.querySelector('#unnarrated').getBoundingClientRect(); return { x: f.left + r.left + 5, y: f.top + r.top + r.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1000);
  assert.match(await page.textContent('#spinePos'), /spine 1\/2/);
});

test('the read-aloud status is announced, and again after the bar is closed and reopened (L-68)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-novoice/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'kokoro' });
  await page.keyboard.press('r');
  await page.click('#ttsDownload').catch(() => {});
  const said = () => page.evaluate(() => document.querySelector('#ttsAnnounce').textContent);
  const first = await h.waitFor(async () => { const t = await said(); return /missing|failed/.test(t) && t; }, 15000);
  assert.ok(first, 'the error is announced');
  assert.equal(first, await page.textContent('#ttsStatus'));
  await page.click('#ttsClose');
  assert.equal(await said(), '');
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(async () => (await said()) === first, 10000), 'announced again on reopening');
});
