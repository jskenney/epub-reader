// Listening: read-aloud with the server voice (mock), media controls, the sleep timer and time left.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const serverVoice = { 'spine:ttsEngine': 'server' };
async function startReading(page) {
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page), 20000), 'reading should start');
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
  await page.clock.fastForward('15:05');
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
  await page.clock.fastForward('15:05');
  assert.ok(await h.waitFor(async () => /Stopping after this passage/.test(await page.$eval('#ttsSleep', s => s.selectedOptions[0].textContent)), 5000));
  await page.keyboard.press(' ');   // pause
  await page.waitForTimeout(300);
  assert.equal(await page.inputValue('#ttsSleep'), 'off');
  await page.clock.fastForward('02:00');
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

test('time left in the chapter and the book', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  const left = await h.waitFor(async () => { const t = await page.textContent('#timeLeft'); return /left in chapter/.test(t) && t; }, 10000);
  assert.match(left, /· \d+ min left in chapter · \d+ min in book/);
  assert.match(await page.getAttribute('#timeLeft', 'title'), /reading speed/);
});
