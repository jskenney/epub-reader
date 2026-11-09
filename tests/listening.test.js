// Listening: read-aloud with the server voice (mock), media controls, the sleep timer and time left.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

// The sleep timer and time left are off unless a config turns them on (E-12, E-13): this folder's does.
const LONG = `${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`;
const serverVoice = { 'spine:ttsEngine': 'server' };
async function startReading(page) {
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page), 20000), 'reading should start');
}
// Move the page's clock on in steps of under a minute, with real time between them for the voice stream to
// arrive, as real time passes (one big jump would also look like a stalled stream: REVIEW.md L-75).
async function fastForward(page, sec) {
  for (let left = sec; left > 0; left -= 40) { await page.clock.fastForward(Math.min(40, left) * 1000); await page.waitForTimeout(150); }
}
const playing = page => page.evaluate(() => document.querySelector('#ttsPlay').classList.contains('playing'));

test('the server voice reads, streams, and nothing leaves the site', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  const log = await h.breezeLog();
  assert.ok(log.length >= 1 && log[0].ref_text === 'A test clip.' && log[0].ref_bytes > 1000, JSON.stringify(log[0]));
  assert.deepEqual(page.blocked, []);
});

test('media controls show the book while reading aloud, and follow play and pause', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  const ms = () => page.evaluate(() => ({ state: navigator.mediaSession.playbackState,
    title: navigator.mediaSession.metadata?.title, album: navigator.mediaSession.metadata?.album }));
  assert.deepEqual(await ms(), { state: 'playing', title: 'Chapter One', album: 'The Long Book' });
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  assert.equal((await ms()).state, 'paused');
  await page.click('#ttsClose');
  assert.equal((await ms()).state, 'none');
});

test('sleep timer: stops at the end of a sentence once the time is up, and can be resumed', async () => {
  const page = await h.newPage();
  await page.clock.install();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  await page.selectOption('#ttsSleep', '15');
  assert.match(await page.$eval('#ttsSleep', s => s.selectedOptions[0].textContent), /Stops in 1[45]:\d\d/);
  await fastForward(page, 905);
  // It stops at the end of the passage being read (a long paragraph here: up to ~20 s).
  const stopped = await h.waitFor(async () => !(await playing(page)) && await page.textContent('#ttsStatus'), 60000);
  assert.match(stopped, /Sleep timer: reading stopped/);
  assert.equal(await page.inputValue('#ttsSleep'), 'off');
  await page.keyboard.press(' ');   // play again: carries on from the next sentence
  assert.ok(await h.waitFor(() => playing(page), 5000));
});

test('sleep timer: pausing while it waits for the passage to end turns it off, so play carries on (M-3)', async () => {
  const page = await h.newPage();
  await page.clock.install();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  await page.selectOption('#ttsSleep', '15');
  await fastForward(page, 905);
  assert.ok(await h.waitFor(async () => /Stopping after this passage/.test(await page.$eval('#ttsSleep', s => s.selectedOptions[0].textContent)), 5000));
  await page.keyboard.press(' ');   // pause
  await page.waitForTimeout(300);
  assert.equal(await page.inputValue('#ttsSleep'), 'off');
  await fastForward(page, 120);
  await page.keyboard.press(' ');   // play again, more than a minute later
  await page.waitForTimeout(3000);
  assert.equal(await playing(page), true, 'reading should carry on');
});

test('sleep timer: "stop at chapter end" stops instead of going on to the next chapter', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, serverVoice);
  // Find the last paragraph of chapter two with search, and read from there.
  await page.keyboard.press('/');
  await page.keyboard.type("don't think");
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page').contentWindow.CSS.highlights?.has('search-current'));
  await page.keyboard.press('Escape');   // clears the search
  await page.keyboard.press('Escape');   // leaves the search box
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page)), 'reading should start');
  await page.selectOption('#ttsSleep', 'chapter');
  await page.frameLocator('#page').locator('p', { hasText: 'don’t think' }).click();   // jump to it while reading
  const status = await h.waitFor(async () => { const t = await page.textContent('#ttsStatus'); return /chapter/.test(t) && t; }, 60000);
  assert.match(status, /stopped at the end of the chapter/);
  assert.match(await page.textContent('#spinePos'), /spine 2\/3/, 'still in chapter two');
  assert.equal(await playing(page), false);
});

test('by default the read-aloud bar is compact: short voice names, no sleep timer, no time left (E-12, E-13)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`, serverVoice);
  await startReading(page);
  const names = await page.$$eval('#ttsEngine option:not([hidden])', os => os.map(o => o.textContent));
  assert.deepEqual(names.filter(n => n !== 'Publisher narration'), ['Device', 'Kokoro', 'Pocket', 'Server']);
  assert.equal(await page.isVisible('#ttsSleep'), false);
  await page.waitForTimeout(1500);
  assert.equal((await page.textContent('#timeLeft')).trim(), '');
});

test('time left in the chapter and the book', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  const left = await h.waitFor(async () => { const t = await page.textContent('#timeLeft'); return /left in chapter/.test(t) && t; }, 10000);
  assert.match(left, /· \d+ min left in chapter · \d+ min in book/);
  assert.match(await page.getAttribute('#timeLeft', 'title'), /reading speed/);
});

test('a comic has no text to read: R says so and the page and saved position stay put (M-23)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`, serverVoice);
  const positions = () => page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('spine:pos:')).map(([k, v]) => [k, JSON.parse(v).i, JSON.parse(v).f]));
  const before = await positions();
  await page.keyboard.press('r');
  await page.waitForTimeout(1500);
  assert.match(await page.textContent('#spinePos'), /spine 1\//);
  assert.match(await h.notice(page), /no text to read aloud/);
  assert.equal(await page.evaluate(() => document.querySelector('#tts').hidden), true, 'the bar stays closed');
  assert.deepEqual(await positions(), before);
});

test('reading past the last text stops there, not on the last picture page (M-23)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/text-then-pictures.epub`, serverVoice);
  await startReading(page);
  await page.waitForFunction(() => /End of book/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 20000 });
  assert.match(await page.textContent('#spinePos'), /spine 1\//, 'still on the text');
  assert.equal(await playing(page), false);
});

test('opening another book while reading stops reading; a comic closes the bar (L-72, M-23)', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  const books = require('node:path').join(__dirname, 'site', 'reader', 'books');
  await page.setInputFiles('#fileInput', require('node:path').join(books, 'twin-b.epub'));
  await page.waitForFunction(() => document.querySelector('#bookTitle').textContent === 'Twin Title');
  await page.waitForTimeout(2000);
  assert.equal(await playing(page), false, 'not reading the new book on its own');
  assert.ok(!(await h.breezeLog()).some(r => r.text.includes('twin-b')), 'nothing of the new book was asked for');
  await page.keyboard.press(' ');   // play: reads the new book
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(r => r.text.includes('twin-b')), 10000));
  await page.setInputFiles('#fileInput', require('node:path').join(books, 'comic.cbz'));
  await page.waitForFunction(() => /spine 1\/3/.test(document.querySelector('#spinePos').textContent));
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => document.querySelector('#tts').hidden), true, 'the bar is closed for a comic');
  assert.match(await page.textContent('#spinePos'), /spine 1\/3/);
});

test('a voice chosen while paused applies when playing again, instead of the old audio resuming (L-73)', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  await page.keyboard.press(' ');
  await page.waitForFunction(() => document.querySelector('#ttsPlay').getAttribute('aria-label') === 'Play');
  await page.waitForTimeout(500);
  const sentence = await page.evaluate(() => [...document.querySelector('#page').contentWindow.CSS.highlights.get('tts-sentence')][0].toString());
  await h.clearBreezeLog();
  await page.selectOption('#ttsVoice', { label: 'Second narrator' });
  await page.keyboard.press(' ');
  // (Passages after it are made in the new voice anyway: the one paused in must be too.)
  const again = await h.waitFor(async () => (await h.breezeLog()).find(r => r.ref_text === 'Another clip.' && r.text.startsWith(sentence.slice(0, 15))), 10000);
  assert.ok(again, `the paused passage ("${sentence.slice(0, 30)}…") is made again in the new voice: ${JSON.stringify((await h.breezeLog()).map(r => [r.ref_text, r.text.slice(0, 25)]))}`);
});
