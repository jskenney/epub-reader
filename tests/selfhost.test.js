// Self-hosted libraries and fonts, integrity checks, ALLOW_CDN, and the pinned Kokoro model.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

test('with libs/ and fonts/ fetched, nothing is loaded from other sites', async () => {
  for (const book of ['', '?book=books/notes.md', '?book=books/long.epub']) {
    const page = await h.newPage();
    await h.openReader(page, h.READER + book);
    assert.notEqual(await h.title(page), 'Spine Reader', `${book} should open`);
    assert.deepEqual(page.blocked, [], `${book || 'the sample'} reached other sites`);
    // (Under the reader policy the browser refuses such requests before they reach page.blocked: T-18.)
    assert.deepEqual(page.cspViolations, [], `${book || 'the sample'} tried to reach other sites`);
    const fonts = await page.evaluate(() => [document.querySelector('#uiFonts').href,
      document.querySelector('#page').contentDocument.querySelector('[id^="spine-font-"]').href]);
    assert.match(fonts[0], /\/reader\/fonts\/ui\.css$/);
    assert.match(fonts[1], /\/reader\/fonts\/literata\.css$/);
  }
});

test('ALLOW_CDN off with nothing self-hosted: the reader says what is missing instead of using a CDN', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-nocdn/index.html`).catch(() => {});
  assert.match(await h.notice(page), /ZIP library isn't on this site/);
  assert.deepEqual(page.blocked, []);
  assert.deepEqual(page.cspViolations, []);
  const voice = await h.newPage();
  await h.openReader(voice, `${h.SITE}/folder-novoice/index.html`, { 'spine:ttsEngine': 'kokoro' });
  await voice.keyboard.press('r');
  await voice.click('#ttsDownload').catch(() => {});
  const status = await h.waitFor(async () => { const t = await voice.textContent('#ttsStatus'); return /missing/.test(t) && t; });
  assert.match(status, /self-hosted Kokoro files are missing.*ALLOW_CDN is off/);
  assert.deepEqual(voice.blocked, []);
  assert.deepEqual(voice.cspViolations, []);
});

test('a library that does not match its pinned hash is refused', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-badlib/index.html`).catch(() => {});
  assert.match(await h.notice(page), /ZIP library isn't on this site/);
  assert.equal(await page.evaluate(() => window.JSZip?.tampered ?? null), null, 'the tampered file must not run');
});

// (It reaches cdnjs, so it needs internet access: NETWORK=1, as the CDN tests: REVIEW.md T-13.)
test('without local libraries the CDN copy is used, checked against the same hash', { skip: !process.env.NETWORK && 'set NETWORK=1 to run (reaches cdnjs)' }, async () => {
  const page = await h.newPage({ allow: ['cdnjs.cloudflare.com'] });
  const loaded = [];
  page.on('requestfinished', r => { if (/cdnjs/.test(r.url())) loaded.push(r.url()); });
  await h.openReader(page, `${h.SITE}/folder-cdn/index.html`);
  assert.equal(await h.title(page), 'Four Fables');
  assert.ok(loaded.some(u => u.endsWith('/jszip/3.10.1/jszip.min.js')), loaded.join(' '));
});

test('Kokoro model files come from the pinned revision', { skip: !fs.existsSync(path.join(__dirname, '..', 'kokoro', 'kokoro.web.js')) && 'kokoro/ not fetched' }, async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-partial/index.html`, { 'spine:ttsEngine': 'kokoro' });
  await page.keyboard.press('r');
  await page.click('#ttsDownload').catch(() => {});
  const hf = await h.waitFor(() => page.blocked.filter(u => /huggingface\.co/.test(u)).length && page.blocked.filter(u => /huggingface\.co/.test(u)), 30000);
  assert.ok(hf, 'the model should be requested from Hugging Face');
  assert.ok(hf.every(u => u.includes('/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/')), hf.join('\n'));
});

test('a self-hosted Pocket TTS model missing files of the precision in use comes from the CDN; complete folders from this site (M-27)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-pocket-partial/index.html`, { 'spine:ttsEngine': 'pocket' });
  await page.keyboard.press('r');
  await page.click('#ttsDownload').catch(() => {});
  const status = await h.waitFor(async () => { const t = await page.textContent('#ttsStatus'); return /stand-in/.test(t) && t; }, 15000);
  assert.ok(status, await page.textContent('#ttsStatus'));
  assert.match(status, /model https:\/\/huggingface\.co\/vlapky\/pocket-tts-onnx\//, 'the model from the CDN');
  assert.ok(status.includes(`ort ${h.SITE}/pocket-partial/pocket/ort/`), `the complete runtime folder from this site: ${status}`);
});

test('the self-hosted voice check reads only the first bytes of model files on this site, and sends no Range header to another site (T-20, L-91, L-103)', async () => {
  const page = await h.newPage();
  const probes = [];
  page.on('request', r => { if (/\.onnx$/.test(new URL(r.url()).pathname)) probes.push([r.url(), r.headers().range || '']); });
  await h.openReader(page, `${h.SITE}/folder-pocket-partial/index.html`, { 'spine:ttsEngine': 'pocket' });
  await page.keyboard.press('r');
  await page.click('#ttsDownload').catch(() => {});
  await h.waitFor(async () => probes.length >= 4, 15000);
  const local = probes.filter(([u]) => u.startsWith(h.SITE));
  assert.ok(local.length >= 4, JSON.stringify(probes));
  assert.ok(local.every(([, r]) => r === 'bytes=0-255'), JSON.stringify(local));
  // Voice files on another site (on the plain server, whose policy lets the page reach it).
  const other = await h.newPage(), seen = [];
  other.on('request', r => { if (r.url().startsWith('http://localhost:8792/voices/')) seen.push([r.url(), r.headers().range || '']); });
  await h.openReader(other, `${h.PLAIN}/folder-remotevoice/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'pocket' });
  await other.keyboard.press('r');
  await other.click('#ttsDownload').catch(() => {});
  await h.waitFor(async () => seen.length > 0, 15000);
  assert.ok(seen.length > 0, 'the other site was asked');
  assert.ok(seen.every(([, r]) => r === ''), JSON.stringify(seen));
});
