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
  for (let left = sec; left > 0; left -= 25) { await page.clock.fastForward(Math.min(25, left) * 1000); await page.waitForTimeout(150); }
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
  assert.deepEqual(page.cspViolations, []);   // (T-18)
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
  // (The saved position too: T-20.)
  assert.deepEqual(await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('spine:pos:') && !k.startsWith('spine:pos:loose:')).map(([, v]) => JSON.parse(v).i)), [0]);
});

test('reading passes picture pages and goes on to the text after them (T-20)', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, `${h.READER}?book=books/text-pictures-text.epub`, serverVoice);
  await startReading(page);
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(r => r.text.includes('Closing words')), 20000), 'the text after the plates is read');
  await page.waitForFunction(() => /spine 4\//.test(document.querySelector('#spinePos').textContent), null, { timeout: 10000 });
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

test('a chapter that failed to load while being looked at ahead is still read, not skipped (round 11 review)', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  // Chapter 2 can't be loaded until the first passage has been made and looked past (the look-ahead tries it
  // then), and loads normally after that.
  let failed = 0, down = true;
  await page.route('**/books/abc/OEBPS/c2.xhtml', route => down ? (failed++, route.abort()) : route.continue());
  await h.openReader(page, `${h.READER}?book=books/abc/`, serverVoice);
  await startReading(page);
  await h.waitFor(async () => (await h.breezeLog()).some(r => r.text.includes('Alpha words')), 10000, 50);
  await page.waitForTimeout(800);
  down = false;
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).some(r => r.text.includes('Charlie')), 30000), 'reads on to the end');
  const texts = (await h.breezeLog()).map(r => r.text).join(' | ');
  assert.ok(failed >= 1, 'the first request for chapter 2 failed');
  assert.match(texts, /Bravo words here/, `chapter 2 was read: ${texts}`);
});

test('reading aloud into a chapter that can\'t be loaded stops on the chapter before, and keeps that position (round 11 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/abc-missing/`, serverVoice);
  await startReading(page);
  await page.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  assert.equal(await playing(page), false, 'not left "playing" with nothing to play');
  assert.equal(await page.textContent('#curFile'), 'OEBPS/c1.xhtml');
  const pos = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('spine:pos:')).map(([, v]) => JSON.parse(v).i));
  assert.deepEqual(pos, [0]);
});

test('a voice server busy or away for a moment doesn\'t make passages read sentence by sentence for good (L-76)', async () => {
  const page = await h.newPage();
  // The first request for paragraph 1's passage finds the server away for a moment (a gateway error).
  let failed = 0;
  await page.route('**/tts/v1/audio/speech', route => !failed && /First paragraph 1\./.test(route.request().postDataBuffer()?.toString('latin1') || '')
    ? (failed++, route.fulfill({ status: 503, body: 'busy' })) : route.continue());
  await h.clearBreezeLog();
  await h.openReader(page, LONG, serverVoice);
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => failed, 20000, 50), 'the server was away once (round 25 review, T-46)');
  await page.waitForTimeout(1000);
  await h.clearBreezeLog();
  await page.keyboard.press('Escape'); await page.click('#ttsClose');
  await page.keyboard.press('r');   // the voice is back: read again from the top of the page
  const p1 = await h.waitFor(async () => (await h.breezeLog()).find(r => r.text.startsWith('First paragraph 1.')), 20000);
  assert.ok(p1, JSON.stringify((await h.breezeLog()).map(r => r.text.slice(0, 30))));
  assert.ok(p1.text.length > 60, `a whole passage, not one sentence: "${p1.text}"`);
});

test('choosing a chapter that can\'t be shown keeps the place reading aloud had on the page before (L-107)', async () => {
  const page = await h.newPage();
  await page.route('**/shelf-dir/OEBPS/c2.xhtml', route => route.abort());
  await h.openReader(page, `${h.READER}?book=books/shelf-dir/`, serverVoice);
  await startReading(page);
  await page.frameLocator('#page').locator('p', { hasText: 'First paragraph 3.' }).click({ position: { x: 5, y: 5 } });
  await h.waitFor(async () => (await h.spokenWord(page)) && (await page.evaluate(() => [...document.querySelector('#page').contentWindow.CSS.highlights.get('tts-sentence')][0].toString())).startsWith('First paragraph 3.'), 10000);
  await page.keyboard.press(' ');   // pause
  await page.click('#tocList a >> nth=1');   // Chapter Two: can't be loaded
  await page.waitForFunction(() => /couldn't/i.test(document.querySelector('#noticeText')?.textContent || ''));
  await page.click('#ttsPlay');
  const at = await h.waitFor(async () => { const w = await h.spokenWord(page); if (!w) return null; return page.evaluate(() => [...document.querySelector('#page').contentWindow.CSS.highlights.get('tts-sentence')][0].toString()); }, 10000);
  assert.ok(at && !at.startsWith('Chapter One') && !at.startsWith('First paragraph 1.'), `goes on from where it was, not the top of the page: "${at}"`);
});

// A server voice stream that stops: before any audio (L-100) or partway (L-75). The time allowed is cut to a
// second for the test (SPINE_TEST.svReplySec; 60 s otherwise), and the mock server stalls the first request.
for (const mode of ['headers', 'mid']) {
  test(`a server voice stream that stalls ${mode === 'headers' ? 'before any audio (L-100)' : 'partway (L-75)'} is given up on with a note; play then reads on (T-20)`, { timeout: 60000 }, async () => {
    const page = await h.newPage();
    await page.addInitScript(() => { window.SPINE_TEST = { svReplySec: 1 }; });
    await h.clearBreezeLog();
    await h.openReader(page, LONG, serverVoice);
    await fetch(`${h.SITE}/__breeze?stall=${mode}`);
    const t0 = Date.now();
    await page.keyboard.press('r');
    // Given up on within the time allowed (3 s before the first audio, 1 s between pieces), not left waiting: the
    // mock server holds the stream for 20 s, so only the reader's own time limit ends it this soon.
    const note = await h.waitFor(async () => {
      const t = `${await page.textContent('#notice')} ${await page.textContent('#ttsStatus')}`;
      return /voice server (isn't responding|stopped partway)/.test(t) && t;
    }, 10000);
    assert.ok(note, `${await page.textContent('#notice')} | ${await page.textContent('#ttsStatus')}`);
    assert.ok(Date.now() - t0 < (mode === 'headers' ? 7000 : 5000), `given up on after ${Date.now() - t0} ms`);
    assert.equal(await playing(page), false);
    assert.equal((await h.breezeLog())[0].stalled, mode);
    // Play again: the passage is asked for again and read.
    await h.waitFor(async () => !(await page.isDisabled('#ttsPlay')), 10000);
    await page.click('#ttsPlay');
    assert.ok(await h.waitFor(() => h.spokenWord(page), 20000), 'reading goes on');
    const log = await h.breezeLog();
    assert.ok(log.slice(1).some(e => e.text === log[0].text && !e.stalled), JSON.stringify(log.map(e => [e.text.slice(0, 20), e.stalled])));
  });
}
// A refused request's reason is shown, in either server's error format: Breeze's {"detail"} and the Mac
// server's {"error", "code"} (epub-reader-tts-server, mac/).
for (const [mode, reason] of [['breeze400', 'cfg_scale must be greater than 0.'], ['gust400', 'cfg_scale must be 1 without an instruction']]) {
  test(`a refused server voice request shows the server's reason (${mode === 'gust400' ? 'Mac server' : 'Breeze'} format)`, async () => {
    const page = await h.newPage();
    await h.clearBreezeLog();
    await h.openReader(page, LONG, serverVoice);
    await fetch(`${h.SITE}/__breeze?stall=${mode}&n=6`);   // (the paragraph, then its sentences one at a time)
    await page.keyboard.press('r');
    const note = await h.waitFor(async () => { const t = await page.textContent('#notice'); return t.includes('answered 400') && t; }, 10000);
    assert.ok(note && note.includes(`answered 400: ${reason}`), String(note));
  });
}
test.afterEach(() => h.clearBreezeLog());   // (a stall queued by a test that failed early mustn't stall the next one)

// Round 25 review, loop 3 (T-46).
test('the media keys play, pause, and go to the next and previous passage', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.__ms = {}; const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession); navigator.mediaSession.setActionHandler = (a, f) => { window.__ms[a] = f; try { set(a, f); } catch {} }; });
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  assert.deepEqual(await page.evaluate(() => ['play', 'pause', 'nexttrack', 'previoustrack'].map(a => typeof window.__ms[a])), ['function', 'function', 'function', 'function']);
  await page.evaluate(() => window.__ms.pause());
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'paused');
  await page.evaluate(() => window.__ms.play());
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing');
  await h.clearBreezeLog();
  await page.evaluate(() => window.__ms.nexttrack());
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).length, 15000), 'the next passage is asked for');
});

test('sleep timer: paused, it keeps the time it had left, and counts on when reading resumes (round 25 review, T-46)', async () => {
  const page = await h.newPage();
  await page.clock.install();
  await h.openReader(page, LONG, serverVoice);
  await startReading(page);
  await page.selectOption('#ttsSleep', '15');
  await fastForward(page, 300);
  await page.keyboard.press(' ');   // pause with about 10 minutes left
  assert.equal(await playing(page), false);
  const left = async () => { const m = /Stops in (\d+):(\d\d)/.exec(await page.$eval('#ttsSleep', s => s.selectedOptions[0].textContent)); return m && Number(m[1]) * 60 + Number(m[2]); };
  const before = await left();
  assert.ok(before > 500 && before <= 600, `left when paused: ${before}`);
  await fastForward(page, 600);
  assert.ok(Math.abs((await left()) - before) <= 2, 'unchanged while paused');
  await page.keyboard.press(' ');
  assert.ok(await h.waitFor(() => playing(page), 5000));
  await fastForward(page, 60);
  assert.ok((await left()) < before - 30, 'counting again');
});


// T-47: what LOOKAHEAD_SEC changes, seen from outside. (NCACHE_SEC only acts after minutes of audio played.)
test('LOOKAHEAD_SEC: 0 prepares nothing ahead of the passage being read; the default prepares the next ones while paused (round 25 review, T-47)', async () => {
  const counts = [];
  for (const ahead of [0, null]) {
    const page = await h.newPage();
    await h.clearBreezeLog();
    await h.openReader(page, LONG, { ...serverVoice, ...(ahead === null ? {} : { 'spine:set:LOOKAHEAD_SEC': ahead }) });
    await startReading(page);
    await page.keyboard.press(' ');   // (paused: only preparing ahead asks for more)
    await page.waitForTimeout(9000);
    counts.push((await h.breezeLog()).filter(e => !e.stalled).length);
    await page.close();
  }
  assert.equal(counts[0], 1, `with 0: ${counts[0]} passages asked for`);
  assert.ok(counts[1] >= 2, `by default: ${counts[1]} passages asked for`);
});
