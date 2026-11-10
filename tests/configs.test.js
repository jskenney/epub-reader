// Settings from a folder's reader-config.json that had no test (REVIEW.md T-16), the If-Range header on range
// requests, the checksum lists against the fetch scripts, and the test server's file types against nginx's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const REPO = path.join(__dirname, '..');
const CFG = `${h.SITE}/folder-cfg/index.html`;

test('a folder config: SEARCH_MAX, COMIC_PART, KEEP_POSITIONS_DAYS 0 and BOOKSHELF (T-16)', async () => {
  const page = await h.newPage();
  const ancient = { i: 0, f: 0, t: Date.now() - 5000 * 86400000 };
  await h.openReader(page, `${CFG}?book=/reader/books/long.epub`, { 'spine:pos:url:/old.epub': ancient, 'spine:posSweep': 0 });
  // KEEP_POSITIONS_DAYS 0: kept forever, and remembered as the site-wide time.
  assert.notEqual(await page.evaluate(() => localStorage.getItem('spine:pos:url:/old.epub')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:keepDays')), '0');
  // SEARCH_MAX 2.
  await page.fill('#searchBox', 'paragraph'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchResults'), /Showing the first 2 matches/);
  assert.match(await page.textContent('#searchStatus'), /of 2\+ matches/);
  // COMIC_PART 10: 90 pages in sections of 10.
  await page.goto(`${CFG}?book=/reader/books/comic.cbz`); await h.waitForBook(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#tocList a').length), 9);
  // BOOKSHELF "/shelf2" (no slash at the end): a book not next to the page is looked for there.
  await page.goto(`${CFG}?book=second-shelf.md`); await h.waitForBook(page);
  assert.equal(await h.title(page), 'Second Shelf');
});

test('a folder config: TTS_SERVER elsewhere, SPAN_MAX for the server voice, SAVED_AUDIO_MB 0 (T-16)', async () => {
  const page = await h.newPage();
  await h.clearBreezeLog();
  await h.openReader(page, `${h.SITE}/folder-alttts/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r');
  assert.ok(await h.waitFor(() => h.spokenWord(page), 20000), 'reading should start');
  await page.waitForTimeout(3000);   // (a few passages: the one read and those prepared ahead)
  const log = await h.breezeLog();
  assert.ok(log.length >= 2, JSON.stringify(log));
  assert.ok(log.every(e => e.path === '/alt-tts/v1/audio/speech'), 'the API named in the config');
  assert.ok(log.every(e => e.ref_bytes > 1000), 'the voice clip from the voices folder named in the config');
  // (Sentences are joined up to 60 characters; a sentence longer than that, up to 220, is still sent whole.)
  assert.ok(log.every(e => e.text.length <= 60 || !/[.!?]["'”’)]*\s+\S/.test(e.text)), log.map(e => e.text).join(' | '));
  await page.keyboard.press(' ');
  // Nothing saved for rereading.
  const saved = await page.evaluate(() => new Promise(res => {
    const rq = indexedDB.open('spine-voice-audio', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('clips', { keyPath: 'key' }).createIndex('used', 'used');
    rq.onsuccess = () => { const c = rq.result.transaction('clips').objectStore('clips').count(); c.onsuccess = () => res(c.result); c.onerror = () => res(-1); };
    rq.onerror = () => res(-1);
  }));
  assert.equal(saved, 0);
  assert.deepEqual(page.blocked, []);
});

test('range requests for a book carry If-Range, tying every part to the version first seen (T-16)', async () => {
  const page = await h.newPage();
  const ranged = [];
  page.on('request', r => { const hd = r.headers(); if (hd.range && /long\.epub/.test(r.url())) ranged.push(hd['if-range'] || ''); });
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  assert.ok(ranged.length >= 2, `range requests: ${ranged.length}`);
  // (The first finds the version; every later one names it.)
  assert.ok(ranged.slice(1).every(v => v && !v.startsWith('W/')), JSON.stringify(ranged));
});

test('the checksum lists name exactly the files the fetch scripts download (T-16)', () => {
  const list = (script, args) => {
    const r = spawnSync('bash', [script, '--list', ...args], { cwd: REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split('\n').filter(Boolean).map(l => l.split('\t')[1]);
  };
  for (const [name, runs] of [['libs', [['fetch-libs.sh', []]]], ['kokoro', [['fetch-kokoro.sh', []]]],
    ['pocket', [['fetch-pocket.sh', ['all']], ['fetch-pocket.sh', ['--int8', 'all']]]]]) {
    const listed = [...new Set(runs.flatMap(([s, a]) => list(s, a)))].sort();
    const pinned = fs.readFileSync(path.join(REPO, 'checksums', `${name}.sha256`), 'utf8').split('\n').filter(Boolean).map(l => l.slice(66)).sort();
    assert.deepEqual(listed, pinned, name);
  }
});

test("the test server sends nginx.conf.example's types for the files whose types it sets (T-16)", async () => {
  const conf = fs.readFileSync(path.join(REPO, 'nginx.conf.example'), 'utf8');
  const types = [...conf.matchAll(/location ~\*\s+\\\.\(?([a-z|]+)\)?\$\s*\{\s*types \{ \} default_type ([^;]+);/g)]
    .flatMap(m => m[1].split('|').map(ext => [ext, m[2].trim()]));
  assert.ok(types.length >= 4, JSON.stringify(types));
  const files = { mjs: '/reader/kokoro/ort/ort-wasm-simd-threaded.jsep.mjs', wasm: '/pocket-partial/pocket/ort/ort-wasm-simd-threaded.wasm',
    epub: '/reader/books/long.epub', cbz: '/reader/books/comic.cbz', md: '/reader/books/notes.md' };
  for (const [ext, type] of types) {
    if (!files[ext]) continue;
    const r = await fetch(h.SITE + files[ext], { method: 'HEAD' });
    if (r.status === 404) continue;   // (not in this test site)
    assert.equal((r.headers.get('content-type') || '').split(';')[0], type, ext);
  }
});
