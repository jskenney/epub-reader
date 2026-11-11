// Audiobook export (REVIEW.md E-10). Chromium as built for tests has no AAC encoder, so a stand-in
// AudioEncoder hands out real AAC frames made by ffmpeg (one per 1024 samples, as a real encoder does); the
// .m4b files the reader writes are then checked and fully decoded with ffprobe and ffmpeg.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const noFfmpeg = !(has('ffmpeg') && has('ffprobe')) && 'needs ffmpeg and ffprobe';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-ab-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Real AAC-LC frames (24 kHz mono by default), without their ADTS headers.
function aacFrames(rate = 24000, channels = 1) {
  const file = path.join(tmp, `tone-${rate}-${channels}.aac`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=330:sample_rate=${rate}:duration=3`, '-ac', String(channels), '-c:a', 'aac', '-b:a', '128k', '-f', 'adts', file]);
  const b = fs.readFileSync(file), frames = [];
  for (let at = 0; at + 7 <= b.length;) {
    const len = ((b[at + 3] & 3) << 11) | (b[at + 4] << 3) | (b[at + 5] >> 5), head = (b[at + 1] & 1) ? 7 : 9;
    frames.push(b.subarray(at + head, at + len).toString('base64')); at += len;
  }
  return frames.slice(4, -4);   // (steady ones, not the start or end)
}
// The stand-in encoder (for the page): takes any rate, gives one frame per 1024 samples.
function fakeAac(frames) {
  const pool = frames.map(f => Uint8Array.from(atob(f), c => c.charCodeAt(0)));
  let n = 0;
  window.AudioEncoder = class {
    static async isConfigSupported(c) { return { supported: c.codec === 'mp4a.40.2', config: c }; }
    constructor({ output, error }) { this.output = output; this.error = error; this.left = 0; this.first = true; this.encodeQueueSize = 0; }
    configure(c) { this.rate = c.sampleRate; this.ts = 0; }
    emit() {
      const data = pool[n++ % pool.length];
      const chunk = { byteLength: data.length, duration: Math.round(1024 / this.rate * 1e6), timestamp: this.ts, type: 'key', copyTo: d => d.set(data) };
      this.ts += chunk.duration;
      // AAC-LC, 24 kHz, mono: the AudioSpecificConfig ffmpeg's frames were made with.
      this.output(chunk, this.first ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: this.rate, numberOfChannels: 1, description: Uint8Array.of(0x13, 0x08).buffer } } : undefined);
      this.first = false;
    }
    encode(audio) { this.left += audio.numberOfFrames; audio.close?.(); while (this.left >= 1024) { this.left -= 1024; this.emit(); } }
    async flush() { if (this.left > 0) { this.left = 0; this.emit(); } }
    close() {}
  };
  // No pickers: files are downloaded, as in browsers without them.
  delete window.showSaveFilePicker; delete window.showDirectoryPicker;
  window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined;
}
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_chapters', '-show_format', '-show_streams', '-of', 'json', file]).toString());
const decodes = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

const ABC = `${h.READER}?book=books/abc.epub`;
async function openExport(page, url = ABC, settings = { 'spine:ttsEngine': 'server' }) {
  await h.openReader(page, url, settings);
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  await page.keyboard.press(' ');   // (pause: export is started from the bar)
  await page.click('#ttsExport');
  // (Measuring every chapter, and the format check, can take a while when the whole suite runs at once.)
  await page.waitForFunction(() => document.querySelector('#abDialog').open && document.querySelector('#abList').dataset.measured && document.querySelector('#abDialog').dataset.formats, null, { timeout: 60000 });
}
async function exportAll(page, mode, count) {
  await page.check(`input[name="abMode"][value="${mode}"]`);
  const files = [];
  let timer, listener;
  const got = new Promise(res => page.on('download', listener = async d => { const f = path.join(tmp, d.suggestedFilename()); await d.saveAs(f); files.push(f); if (files.length === count) res(); }));
  await page.click('#abStart');
  // (The listener and the time limit are removed afterwards: a later download isn't caught here, and a pending
  // timer doesn't keep the test process alive: round 13 review.)
  try { await Promise.race([got, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('no downloads: ' + files.join())), 90000); })]); }
  finally { clearTimeout(timer); page.off('download', listener); }
  await page.waitForFunction(() => document.querySelector('#abPause').hidden, null, { timeout: 10000 });
  return files.sort();
}

let FRAMES = null;
test('one file: chosen chapters, each a chapter marker, with title, author and cover; it decodes (E-10)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await h.clearBreezeLog();
  await openExport(page);
  const titles = await page.$$eval('#abList .ab-t', els => els.map(e => e.textContent));
  assert.deepEqual(titles, ['Alpha', 'Bravo', 'Charlie']);
  assert.match(await page.textContent('#abSummary'), /^3 chapters · about/);
  const [file] = await exportAll(page, 'one', 1);
  assert.equal(path.basename(file), 'ABC.m4b');
  const p = probe(file);
  assert.deepEqual(p.chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
  assert.equal(p.streams[0].codec_name, 'aac');
  // The chapters also as a QuickTime text track (what Apple's players read), with the same titles.
  const text = p.streams.find(s => s.codec_tag_string === 'text');
  assert.ok(text, JSON.stringify(p.streams.map(s => [s.codec_type, s.codec_tag_string])));
  const subs = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', `0:${text.index}`, '-c', 'copy', '-f', 'data', '-']).toString();
  for (const t of ['Alpha', 'Bravo', 'Charlie']) assert.match(subs, new RegExp(t));
  assert.equal(p.format.tags.title, 'ABC');
  assert.equal(p.format.tags.artist, 'Test Author');
  assert.ok(Number(p.format.duration) > 2, p.format.duration);
  assert.ok(Number(p.chapters[1].start_time) > 0 && Number(p.chapters[2].start_time) > Number(p.chapters[1].start_time));
  assert.equal(decodes(file), '', 'decodes without errors');
  const said = (await h.breezeLog()).map(r => r.text).join(' | ');
  for (const w of ['Alpha words here.', 'Bravo words here.', 'Charlie words here.']) assert.ok(said.includes(w), said);
  assert.match(await page.textContent('#abNow'), /ready/);
});

test('a file per chapter: numbered files with track numbers; a ZIP of them is offered; saved audio is reused (E-10)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page);
  await page.uncheck('#abList input >> nth=1');   // Bravo left out
  await page.waitForFunction(() => /^2 chapters/.test(document.querySelector('#abSummary').textContent));
  await h.clearBreezeLog();
  const files = await exportAll(page, 'each', 2);
  assert.deepEqual(files.map(f => path.basename(f)), ['01 - Alpha.m4b', '02 - Charlie.m4b']);
  const p = probe(files[1]);
  assert.equal(p.format.tags.title, 'Charlie');
  assert.equal(p.format.tags.album, 'ABC');
  assert.equal(p.format.tags.track, '2/2');
  assert.deepEqual(p.chapters.map(c => c.tags.title), ['Charlie']);
  assert.equal(decodes(files[0]), '');
  assert.equal(await page.isVisible('#abDone button'), true, 'Download all as a ZIP');
  const zip = page.waitForEvent('download');
  await page.click('#abDone button');
  const z = path.join(tmp, (await zip).suggestedFilename()); await (await zip).saveAs(z);
  const list = execFileSync('unzip', ['-l', z]).toString();
  assert.match(list, /01 - Alpha\.m4b/); assert.match(list, /02 - Charlie\.m4b/);
  execFileSync('unzip', ['-tq', z]);
  // Exporting again uses the saved audio: nothing new is asked of the voice.
  await h.clearBreezeLog();
  await exportAll(page, 'each', 2);
  assert.deepEqual(await h.breezeLog(), []);
});

test('the device voice explains why export is not possible; without AAC, .m4b is greyed out and another format chosen (E-10, E-17)', async () => {
  const page = await h.newPage();
  await h.openReader(page, ABC, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r'); await page.waitForTimeout(300); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abList').dataset.measured && document.querySelector('#abDialog').dataset.formats);
  // (The test browser has no AAC encoder, as Chrome on Linux: Opus, which it has, is chosen.)
  assert.equal(await page.isDisabled('input[name="abFormat"][value="aac"]'), true);
  assert.equal(await page.isChecked('input[name="abFormat"][value="opus"]'), true);
  assert.equal(await page.isDisabled('input[name="abFormat"][value="mp3"]'), false);
  assert.match(await page.textContent('#abFmtNote'), /\.m4b \(AAC\): this browser has no AAC encoder/);
  assert.equal(await page.isDisabled('#abStart'), false);
  await page.click('#abCancel');
  await page.selectOption('#ttsEngine', 'device');
  await page.click('#ttsExport');
  assert.match(await page.textContent('#abNote'), /natural voice/);
  assert.equal(await page.isDisabled('#abStart'), true);
});

test('the cover is included (an SVG cover drawn into a PNG); units follow the table of contents (E-10)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, h.READER);   // the built-in sample: an SVG cover
  const rows = await page.$$eval('#abList label', ls => ls.map(l => [l.querySelector('.ab-t').textContent, l.querySelector('input').checked]));
  assert.ok(rows.length >= 3, JSON.stringify(rows));
  await page.click('#abNone');
  await page.check('#abList input >> nth=1');
  const [file] = await exportAll(page, 'one', 1);
  const p = probe(file);
  const pic = p.streams.find(s => s.disposition?.attached_pic);
  assert.ok(pic, `a cover picture: ${JSON.stringify(p.streams.map(s => s.codec_name))}`);
  assert.equal(pic.codec_name, 'png');
  assert.equal(p.chapters.length, 1);
  assert.equal(p.chapters[0].tags.title, rows[1][0]);
  await page.screenshot({ path: path.join(tmp, 'dialog.png') });
});

// Stand-in file pickers: files written through them (including the write back at a position that fills in
// the size) are collected, then handed to the test as base64.
function fakePickers() {
  window.__files = {}; window.__removed = [];
  const handle = name => ({ name, async getFile() { return { size: window.__files[name] ? 1 : 0 }; }, async remove() { window.__removed.push(name); }, async createWritable() {
    let buf = new Uint8Array(0), pos = 0;
    const put = (data, at) => { const d = data instanceof Uint8Array ? data : new Uint8Array(data); if (at + d.length > buf.length) { const nb = new Uint8Array(at + d.length); nb.set(buf); buf = nb; } buf.set(d, at); return at + d.length; };
    return { async write(x) { if (x?.type === 'write') { put(x.data, x.position); } else pos = put(x, pos); },
      async close() { let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768)); window.__files[name] = btoa(s); },
      async abort() {} };
  } });
  window.showSaveFilePicker = async o => { window.__types = o.types; return handle(o.suggestedName); };
  window.showDirectoryPicker = async () => ({ getFileHandle: async name => handle(name) });
}
async function pickerFiles(page, count) {
  await page.waitForFunction(n => Object.keys(window.__files).length >= n && document.querySelector('#abPause').hidden, count, { timeout: 90000 });
  const files = await page.evaluate(() => window.__files);
  return Object.entries(files).sort().map(([name, b64]) => { const f = path.join(tmp, 'picked-' + name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f; });
}
test('with the browser\'s pickers, files are written as they are made, one or one per chapter (E-10)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.addInitScript(fakePickers);
  await openExport(page);
  await page.check('input[name="abMode"][value="one"]');
  await page.click('#abStart');
  const [one] = await pickerFiles(page, 1);
  assert.deepEqual(probe(one).chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
  assert.equal(decodes(one), '');
  await page.evaluate(() => { window.__files = {}; });
  await page.check('input[name="abMode"][value="each"]');
  await page.click('#abStart');
  const each = await pickerFiles(page, 3);
  assert.deepEqual(each.map(f => path.basename(f)), ['picked-01 - Alpha.m4b', 'picked-02 - Bravo.m4b', 'picked-03 - Charlie.m4b']);
  for (const f of each) assert.equal(decodes(f), '');
  assert.equal(await page.isVisible('#abDone button'), false, 'no ZIP offer: the files are already in the folder');
});

test('pause, resume, closing the dialog while it works, and cancel (E-10)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  assert.match(await page.textContent('#abSummary'), /making it takes about/, 'an estimate from the voice heard so far');
  await h.clearBreezeLog();
  const downloads = []; page.on('download', d => downloads.push(d.suggestedFilename()));
  await page.click('#abStart');
  await h.waitFor(async () => (await h.breezeLog()).length >= 3, 15000, 50);
  await page.click('#abPause');
  assert.equal(await page.textContent('#abPause'), 'Resume');
  await page.waitForTimeout(1500);   // (the passage in hand finishes)
  const n1 = (await h.breezeLog()).length;
  await page.waitForTimeout(4000);
  assert.equal((await h.breezeLog()).length, n1, 'nothing more is asked of the voice while paused');
  await page.keyboard.press('Escape');   // closing the dialog: the export carries on
  assert.equal(await page.evaluate(() => document.querySelector('#abDialog').open), false);
  assert.equal(await page.evaluate(() => document.querySelector('#ttsExport').classList.contains('busy')), true);
  await page.click('#ttsPlay');   // reading aloud waits meanwhile
  assert.match(await h.notice(page), /waits while the audiobook is being made/);
  await page.click('#ttsExport');
  await page.click('#abPause');   // resume
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).length >= n1 + 3, 15000), 'it goes on after Resume');
  await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent), null, { timeout: 30000 });
  assert.deepEqual(downloads, [], 'nothing is saved from a cancelled single file');
  assert.equal(await page.isDisabled('#abStart'), false, 'ready to start again');
});

test('chapters with no text (picture pages) are left out, not made into broken files (E-10 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/text-then-pictures.epub`);
  // The picture pages are found to have no text: unticked, and marked so.
  assert.equal((await page.locator('#abList input:checked').count()), 1);
  assert.deepEqual(await page.$$eval('#abList .ab-len', els => els.map(e => e.textContent)), ['<1 min', 'no text', 'no text']);
  await page.check('#abList input >> nth=1');   // ticked anyway: left out, with a note
  const files = await exportAll(page, 'each', 1);
  assert.deepEqual(files.map(f => path.basename(f)), ['01 - Words.m4b']);
  assert.equal(decodes(files[0]), '');
  assert.match(await page.textContent('#abNow'), /Left out, with no text to read: Plate 2\./);
  await page.click('#abNone'); await page.check('#abList input >> nth=1');
  await page.click('#abStart');
  await page.waitForFunction(() => /no text to read/.test(document.querySelector('#abNow').textContent) && document.querySelector('#abPause').hidden, null, { timeout: 20000 });
});

const fail500 = (route, detail, status = 500) => route.fulfill({ status, body: JSON.stringify({ detail }), contentType: 'application/json' });
const spoken = route => route.request().postDataBuffer()?.toString('latin1') || '';
test('a sentence the voice can\'t say is left silent and the export goes on (E-10 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.route('**/tts/v1/audio/speech', route => /Bravo/.test(spoken(route)) ? fail500(route, 'no', 422) : route.continue());   // (the text's fault: a 4xx)
  await openExport(page);
  const [file] = await exportAll(page, 'one', 1);
  assert.match(await page.textContent('#abNow'), /ready\. 1 sentence the voice couldn't say is silent\./);
  assert.deepEqual(probe(file).chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
  assert.equal(decodes(file), '');
});

test('the voice away for a few seconds: the export waits for it and loses nothing (round 13 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  // Gone for 5 s from line 30 on (well past what reading aloud prepared before the export).
  let until = 0, failed = 0;
  await page.route('**/tts/v1/audio/speech', route => {
    if (!until && /Line 30 /.test(spoken(route))) until = Date.now() + 5000;
    return Date.now() < until ? (failed++, fail500(route, 'restarting', 502)) : route.continue();
  });
  const [file] = await exportAll(page, 'one', 1);
  assert.ok(failed > 0, 'the outage happened during the export');
  assert.match(await page.textContent('#abNow'), /^The audiobook is ready\.$/, 'nothing left silent');
  assert.deepEqual(probe(file).chapters.map(c => c.tags.title), ['Lines']);
});

test('the voice going away for good stops the export, keeping what was made (E-10 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.addInitScript(() => { window.SPINE_TEST = { abWaitSec: 4 }; });   // (rather than five minutes)
  let gone = false;
  await page.route('**/tts/v1/audio/speech', route => gone || /paragraph 2\./.test(spoken(route)) ? (gone = true, fail500(route, 'gone')) : route.continue());
  await openExport(page, `${h.READER}?book=books/long.epub`);
  await page.click('#abNone'); await page.check('#abList input >> nth=0'); await page.check('#abList input >> nth=1');
  const [part] = await exportAll(page, 'one', 1);
  assert.match(await page.textContent('#abNow'), /Export stopped/);
  assert.match(await page.textContent('#abDone'), /1 finished file kept \(the last one up to where it stopped\)/);
  assert.deepEqual(probe(part).chapters.map(c => c.tags.title), ['Chapter One']);
  assert.equal(decodes(part), '');
});

test('a voice not yet downloaded: the dialog offers the download, and Export waits for it; reader keys wait behind the dialog (E-10 review)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { window.AudioEncoder = class { static async isConfigSupported() { return { supported: true }; } }; });
  await h.openReader(page, `${h.READER}?book=books/long.epub`, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r'); await page.waitForTimeout(500); await page.keyboard.press(' ');
  await page.selectOption('#ttsEngine', 'pocket');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abDialog').dataset.formats);
  assert.match(await page.textContent('#abNote'), /needs a one-time .* download/);
  assert.equal(await page.isVisible('#abLoad'), true);
  assert.equal(await page.isDisabled('#abStart'), true);
  const before = await page.textContent('#spinePos');
  for (const k of ['ArrowRight', 'PageDown', 'l', 't', 'r']) await page.keyboard.press(k);
  await page.waitForTimeout(300);
  assert.equal(await page.textContent('#spinePos'), before, 'no page turned behind the dialog');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), null, 'no theme change');
});

test('contents entries out of order within a file are put in the order of their headings (L-119)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await h.clearBreezeLog();
  await openExport(page, `${h.READER}?book=books/toc-order.epub`);
  assert.deepEqual(await page.$$eval('#abList li:not([hidden]) .ab-t', els => els.map(e => e.textContent)), ['First', 'Second', 'Third']);
  const [file] = await exportAll(page, 'one', 1);
  assert.deepEqual(probe(file).chapters.map(c => c.tags.title), ['First', 'Second', 'Third']);
  const said = (await h.breezeLog()).map(r => r.text);
  for (const t of ['First part text.', 'Second part text.', 'Third part text.']) assert.equal(said.filter(x => x.includes(t)).length, 1, `${t} once: ${JSON.stringify(said)}`);
});

test('a cancelled single-file export removes the new, empty file it was writing (L-113)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.addInitScript(fakePickers);
  await openExport(page, `${h.READER}?book=books/long.epub`);
  await page.check('input[name="abMode"][value="one"]');
  await page.click('#abStart');
  await page.waitForFunction(() => !document.querySelector('#abPause').hidden);
  await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent), null, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => window.__removed), ['The Long Book.m4b']);
  // A file chosen to be replaced (it has something in it) stays as it was when the export is cancelled.
  await page.evaluate(() => { window.__removed = []; window.__files['The Long Book.m4b'] = 'b2xk'; });
  await page.click('#abStart');
  await page.waitForFunction(() => !document.querySelector('#abPause').hidden);
  await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent) && document.querySelector('#abPause').hidden, null, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => window.__removed), []);
});

test('a chapter that can\'t be read says so, stays ticked, and is reported; opening another book asks first (round 13 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/abc-missing/`);
  assert.deepEqual(await page.$$eval('#abList .ab-len', els => els.map(e => e.textContent)), ['<1 min', "couldn't be read", '<1 min']);
  assert.equal(await page.isChecked('#abList input >> nth=1'), true);
  const [file] = await exportAll(page, 'one', 1);
  assert.match(await page.textContent('#abNow'), /Left out, as they couldn't be read: Bravo\./);
  assert.deepEqual(probe(file).chapters.map(c => c.tags.title), ['Alpha', 'Charlie']);
  // While an export runs, opening another book asks first; saying no leaves the export going. (The voice is held
  // back, so the export is still running.)
  await page.route('**/tts/v1/audio/speech', () => {});
  await page.click('#abCancel');
  await page.goto(`${h.READER}?book=books/short-lines.epub`); await h.waitForBook(page);
  await page.keyboard.press('r'); await page.waitForTimeout(300); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abList').dataset.measured && document.querySelector('#abDialog').dataset.formats);
  await page.click('#abStart');
  await page.waitForFunction(() => !document.querySelector('#abPause').hidden);
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.evaluate(() => document.querySelector('#abDialog').close());
  await page.setInputFiles('#fileInput', path.join(__dirname, 'site', 'reader', 'books', 'twin-b.epub'));
  await page.waitForTimeout(500);
  assert.match(asked, /Stop it and open the other book\?/);
  assert.equal(await h.title(page), 'Short Lines');
  assert.equal(await page.evaluate(() => document.querySelector('#ttsExport').classList.contains('busy')), true, 'still exporting');
});

test('a server that is well but answers 500 for one text: that sentence is left silent soon, the export goes on (loop 4 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.addInitScript(() => { window.SPINE_TEST = { abWaitSec: 60 }; });   // (long: it mustn't be what ends it)
  await page.route('**/tts/v1/audio/speech', route => /Bravo/.test(spoken(route)) ? fail500(route, 'model error') : route.continue());
  await openExport(page);
  const t0 = Date.now();
  const [file] = await exportAll(page, 'one', 1);
  assert.ok(Date.now() - t0 < 40000, `took ${Date.now() - t0} ms`);
  assert.match(await page.textContent('#abNow'), /ready\. 1 sentence the voice couldn't say is silent\./);
  assert.deepEqual(probe(file).chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
});

test('Cancel ends an export at once, while the voice never answers or while it waits for the voice (loop 4 review)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  let mode = 'hang';
  await page.route('**/tts/v1/audio/speech', route => mode === 'hang' ? undefined : fail500(route, 'gone', 502));
  for (const m of ['hang', 'gone']) {
    mode = m;
    await page.click('#abStart');
    await page.waitForTimeout(m === 'gone' ? 3000 : 1500);   // (waiting for the voice by now)
    if (m === 'gone') assert.match(await page.textContent('#abLeft'), /Waiting for the voice/);
    const t0 = Date.now();
    await page.click('#abCancel');
    await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent) && document.querySelector('#abPause').hidden, null, { timeout: 5000 });
    assert.ok(Date.now() - t0 < 1200, `${m}: took ${Date.now() - t0} ms`);
  }
});

// An encoder like Windows' (as far as known): 44.1 or 48 kHz, stereo only, 96 kbps and up.
function strictAac(frames) {
  const pool = frames.map(f => Uint8Array.from(atob(f), c => c.charCodeAt(0)));
  let n = 0;
  window.__enc = { configured: null, channels: [] };
  window.AudioEncoder = class {
    static async isConfigSupported(c) { return { supported: c.codec === 'mp4a.40.2' && [44100, 48000].includes(c.sampleRate) && c.numberOfChannels === 2 && c.bitrate >= 96000, config: c }; }
    constructor({ output }) { this.output = output; this.left = 0; this.first = true; this.encodeQueueSize = 0; }
    configure(c) { window.__enc.configured = c; this.rate = c.sampleRate; this.ts = 0; }
    emit() {
      const data = pool[n++ % pool.length];
      const chunk = { byteLength: data.length, duration: Math.round(1024 / this.rate * 1e6), timestamp: this.ts, type: 'key', copyTo: d => d.set(data) };
      this.ts += chunk.duration;
      this.output(chunk, this.first ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: this.rate, numberOfChannels: 2, description: Uint8Array.of(0x11, 0x90).buffer } } : undefined);
      this.first = false;
    }
    encode(audio) { window.__enc.channels.push(audio.numberOfChannels); this.left += audio.numberOfFrames; audio.close?.(); while (this.left >= 1024) { this.left -= 1024; this.emit(); } }
    async flush() { if (this.left > 0) { this.left = 0; this.emit(); } }
    close() {}
  };
  window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined;
}
test('an encoder that takes only 48 kHz stereo at 96 kbps and up (as Windows\' does) is used (user report)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  const frames = aacFrames(48000, 2);
  const page = await h.newPage();
  await page.addInitScript(strictAac, frames);
  await openExport(page);
  assert.equal(await page.isHidden('#abNote'), true, await page.textContent('#abNote'));
  const [file] = await exportAll(page, 'one', 1);
  const enc = await page.evaluate(() => window.__enc);
  assert.equal(enc.configured.sampleRate, 48000);
  assert.equal(enc.configured.numberOfChannels, 2);
  assert.equal(enc.configured.bitrate, 96000);
  assert.ok(enc.channels.every(c => c === 2));
  const p = probe(file);
  assert.equal(p.streams[0].channels, 2);
  assert.equal(p.streams[0].sample_rate, '48000');
  assert.equal(decodes(file), '');
});

test('the dialog says why there is no encoder: a page that isn\'t secure, or none in the browser (user report)', async () => {
  const page = await h.newPage();
  await page.addInitScript(() => { Object.defineProperty(window, 'isSecureContext', { value: false }); delete window.AudioEncoder; });
  await openExport(page);
  // (Not a secure page: no AAC or Opus, which need WebCodecs; MP3, in JavaScript, still works.)
  assert.match(await page.textContent('#abFmtNote'), /\.m4b \(AAC\): it needs the reader on a secure page.*\.opus \(Opus\): it needs the reader on a secure page/);
  assert.equal(await page.isChecked('input[name="abFormat"][value="mp3"]'), true);
  const none = await h.newPage();
  await none.addInitScript(() => { window.AudioEncoder = class { static async isConfigSupported() { return { supported: false }; } }; });
  await none.route('**/libs/lame.min.js', r => r.abort());
  await none.route('**/cdnjs.cloudflare.com/**', r => r.abort());
  await openExport(none);
  // (The MP3 encoder is looked for after the dialog opens: its answer waited for, which takes longer under load.)
  await none.waitForFunction(() => !/checking/.test(document.querySelector('#abNote').textContent), null, { timeout: 30000 });
  assert.match(await none.textContent('#abNote'), /No audiobook format can be made in this browser: \.m4b \(AAC\): this browser has no AAC encoder \(Chrome on Linux has none\); \.opus \(Opus\): this browser can't encode Opus; \.mp3 \(MP3\): the MP3 encoder couldn't be loaded/);
  assert.equal(await none.isDisabled('#abStart'), true);
});

test('.opus: chapters, title, author and cover in Ogg comments; it decodes (E-17)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  const page = await h.newPage();   // (the test browser's own Opus encoder)
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined; });   // (downloads)
  await openExport(page);
  await page.check('input[name="abFormat"][value="opus"]');
  const [file] = await exportAll(page, 'one', 1);
  assert.equal(path.basename(file), 'ABC.opus');
  const p = probe(file);
  assert.equal(p.streams[0].codec_name, 'opus');
  assert.deepEqual(p.chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
  assert.ok(Number(p.chapters[2].start_time) > Number(p.chapters[1].start_time) && Number(p.chapters[1].start_time) > 0);
  const tags = Object.fromEntries(Object.entries(p.streams[0].tags || {}).concat(Object.entries(p.format.tags || {})).map(([k, v]) => [k.toLowerCase(), v]));
  assert.equal(tags.title, 'ABC'); assert.equal(tags.artist, 'Test Author');
  assert.ok(Number(p.format.duration) > 2);
  assert.equal(decodes(file), '');
});

test('.mp3: chapters, title, author in ID3 tags; a file per chapter with track numbers; it decodes (E-17)', { skip: noFfmpeg, timeout: 180000 }, async () => {
  const page = await h.newPage();   // (lamejs, from libs/)
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined; });   // (downloads)
  await openExport(page);
  await page.check('input[name="abFormat"][value="mp3"]');
  const [file] = await exportAll(page, 'one', 1);
  assert.equal(path.basename(file), 'ABC.mp3');
  const p = probe(file);
  assert.equal(p.streams.find(s => s.codec_type === 'audio').codec_name, 'mp3');
  assert.deepEqual(p.chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie']);
  assert.equal(p.format.tags.title, 'ABC'); assert.equal(p.format.tags.artist, 'Test Author');
  assert.equal(decodes(file), '');
  const each = await exportAll(page, 'each', 3);
  assert.deepEqual(each.map(f => path.basename(f)), ['01 - Alpha.mp3', '02 - Bravo.mp3', '03 - Charlie.mp3']);
  assert.equal(probe(each[1]).format.tags.track, '2/3');
  // The choice is remembered.
  await page.reload(); await h.waitForBook(page);
  await page.keyboard.press('r'); await page.waitForTimeout(300); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abList').dataset.measured && document.querySelector('#abDialog').dataset.formats);
  assert.equal(await page.isChecked('input[name="abFormat"][value="mp3"]'), true);
});

test('while the chosen format is still being checked it stays chosen and Export waits (E-17 review)', async () => {
  const page = await h.newPage();
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/libs/lame.min.js', async r => { await held; await r.continue(); });
  await h.openReader(page, ABC, { 'spine:ttsEngine': 'server', 'spine:abFormat': 'mp3' });
  await page.keyboard.press('r'); await page.waitForTimeout(500); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abList').dataset.measured && /Checking whether this browser can make \.mp3/.test(document.querySelector('#abNoteText').textContent));
  assert.equal(await page.isChecked('input[name="abFormat"][value="mp3"]'), true);
  assert.equal(await page.isDisabled('#abStart'), true);
  release();
  await page.waitForFunction(() => document.querySelector('#abDialog').dataset.formats);
  assert.equal(await page.isChecked('input[name="abFormat"][value="mp3"]'), true);
  assert.equal(await page.isDisabled('#abStart'), false);
});

test('a saved format this version doesn\'t know is ignored; a failed MP3 load is tried again on the next opening (E-17 review)', async () => {
  const page = await h.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let block = true;
  await page.route('**/libs/lame.min.js', r => block ? r.abort() : r.continue());
  await page.route('**/cdnjs.cloudflare.com/**', r => block ? r.abort() : r.continue());
  await openExport(page, ABC, { 'spine:ttsEngine': 'server', 'spine:abFormat': 'flac' });
  assert.deepEqual(errors, []);
  assert.equal(await page.isChecked('input[name="abFormat"][value="opus"]'), true);   // (no AAC in the test browser)
  assert.equal(await page.isDisabled('input[name="abFormat"][value="mp3"]'), true);
  assert.match(await page.textContent('#abFmtNote'), /\.mp3 \(MP3\): the MP3 encoder couldn't be loaded/);
  block = false;
  await page.click('#abCancel');
  await page.evaluate(() => { delete document.querySelector('#abDialog').dataset.formats; });
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abDialog').dataset.formats);
  assert.equal(await page.isDisabled('input[name="abFormat"][value="mp3"]'), false);
});

test('.opus and .mp3 through the browser\'s file picker: the type offered, the tags written back in place (E-17 review)', { skip: noFfmpeg, timeout: 180000 }, async () => {
  const page = await h.newPage();
  await page.addInitScript(fakePickers);
  await openExport(page);
  for (const [f, ext, mime] of [['opus', 'opus', 'audio/ogg'], ['mp3', 'mp3', 'audio/mpeg']]) {
    await page.evaluate(() => { window.__files = {}; });
    await page.check(`input[name="abFormat"][value="${f}"]`);
    await page.check('input[name="abMode"][value="one"]');
    await page.click('#abStart');
    const [file] = await pickerFiles(page, 1);
    assert.equal(path.basename(file), `picked-ABC.${ext}`);
    assert.deepEqual(Object.keys((await page.evaluate(() => window.__types))[0].accept), [mime]);
    const p = probe(file);
    assert.deepEqual(p.chapters.map(c => c.tags.title), ['Alpha', 'Bravo', 'Charlie'], f);
    assert.ok(Number(p.chapters[2].start_time) > Number(p.chapters[1].start_time) && Number(p.chapters[1].start_time) > 0, f);
    assert.equal(decodes(file), '');
  }
});

test('a busy voice server (409) is waited for during an export, and nothing is left silent (T-20, M-58)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  // (A busy answer is asked again twice, not for a minute, so it reaches the export's own waiting: M-58.)
  await page.addInitScript(() => { window.SPINE_TEST = { svBusyTries: 2 }; });
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  // Busy for 4 s from line 20 on, as when someone else is using the server.
  let until = 0, busy = 0;
  await page.route('**/tts/v1/audio/speech', route => {
    if (!until && /Line 20 /.test(spoken(route))) until = Date.now() + 4000;
    return Date.now() < until ? (busy++, fail500(route, 'An inference request is already running.', 409)) : route.continue();
  });
  await exportAll(page, 'one', 1);
  assert.ok(busy > 0, 'the server was busy during the export');
  assert.match(await page.textContent('#abNow'), /^The audiobook is ready\.$/, 'nothing left silent');
});

test('Cancel after a few minutes of audio asks again, keeps its question up, and starts afresh next time (T-20, L-158)', { skip: noFfmpeg, timeout: 150000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/long.epub`);
  await h.clearBreezeLog();
  await page.click('#abStart');
  // (Over two minutes of speech made: the mock voice speaks 0.3 s a word.)
  const secs = async () => (await h.breezeLog()).filter(e => !e.aborted).reduce((t, e) => t + 0.3 * e.text.split(/\s+/).length + 0.3, 0);
  assert.ok(await h.waitFor(async () => (await secs()) > 170, 90000, 250), `only ${await secs()} s made`);
  await page.click('#abCancel');
  assert.equal(await page.textContent('#abCancel'), 'Click again to stop');
  await page.waitForTimeout(2500);   // (progress keeps being shown meanwhile)
  assert.match(await page.textContent('#abLeft'), /What is finished so far is kept/);
  await page.waitForTimeout(3500);   // (the question goes after five seconds)
  assert.equal(await page.textContent('#abCancel'), 'Cancel export');
  // Asked again and confirmed a second later: the first question's five seconds are still running.
  await page.click('#abCancel'); await page.waitForTimeout(1000); await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent), null, { timeout: 30000 });
  // A new export at once (the speech saved last time counts as made, so it asks at once): the old timer, due about
  // four seconds from now, mustn't take the new question away early.
  await page.click('#abStart');
  await page.waitForTimeout(300);
  assert.equal(await page.textContent('#abCancel'), 'Cancel export');
  await page.click('#abCancel');
  assert.equal(await page.textContent('#abCancel'), 'Click again to stop');
  await page.waitForTimeout(4000);
  assert.equal(await page.textContent('#abCancel'), 'Click again to stop', 'still asking: the earlier timer was cleared');
  await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent), null, { timeout: 30000 });
});

test('a stopped export keeps extra room in the saved audio (for a week); a finished one gives it back (T-20)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  await h.clearBreezeLog();
  await page.click('#abStart');
  assert.ok(await h.waitFor(async () => (await h.breezeLog()).length >= 2, 15000, 50), 'the export started');
  await page.click('#abCancel');
  await page.waitForFunction(() => /cancelled/.test(document.querySelector('#abNow').textContent), null, { timeout: 30000 });
  const room = JSON.parse(await page.evaluate(() => localStorage.getItem('spine:exportRoom')));
  assert.ok(room?.mb > 0 && Math.abs(Date.now() - room.t) < 60000, JSON.stringify(room));
  await exportAll(page, 'one', 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:exportRoom')), null);
});

test('the voice label stays while the server is away mid-export (T-20, L-161)', { skip: noFfmpeg, timeout: 120000 }, async () => {
  FRAMES ??= aacFrames();
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await openExport(page, `${h.READER}?book=books/short-lines.epub`);
  let until = 0;
  await page.route('**/tts/v1/audio/speech', route => {
    if (!until && /Line 25 /.test(spoken(route))) until = Date.now() + 5000;
    return Date.now() < until ? fail500(route, 'restarting', 502) : route.continue();
  });
  const labels = [];
  const done = exportAll(page, 'one', 1);
  while (!until) await page.waitForTimeout(100);
  while (Date.now() < until - 500) { labels.push(await page.textContent('#abVoice')); await page.waitForTimeout(400); }
  await done;
  assert.ok(labels.length > 3 && labels.every(l => /^Voice: /.test(l)), JSON.stringify(labels));
});

test('keepPart: an export that stops before any speech keeps no file; one that stops over a file already there doesn\'t replace it (T-20)', { skip: noFfmpeg, timeout: 150000 }, async () => {
  FRAMES ??= aacFrames();
  // The voice away from the first request (busy, waited for until it counts as gone): nothing to keep. (This
  // reaches keepPart with no speech; an empty file fails to finish anyway, so what's checked is that none appears.)
  const page = await h.newPage();
  await page.addInitScript(fakeAac, FRAMES);
  await page.addInitScript(() => { window.SPINE_TEST = { abWaitSec: 3, svBusyTries: 1 }; window.showSaveFilePicker = undefined; window.showDirectoryPicker = undefined; });
  await page.route('**/tts/v1/audio/speech', route => fail500(route, 'busy', 409));
  await openExport(page, `${h.READER}?book=books/long.epub`);
  const downloads = []; page.on('download', d => downloads.push(d.suggestedFilename()));
  await page.click('#abStart');
  await page.waitForFunction(() => /Export stopped/.test(document.querySelector('#abNow').textContent), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  assert.deepEqual(downloads, []);
  assert.doesNotMatch(await page.textContent('#abDone'), /kept/);
  // A file per chapter into a folder whose files count as already there (the stand-in folder's getFileHandle finds
  // every name, though it starts empty): the chapter it stopped in isn't replaced by a part of it.
  const p2 = await h.newPage();
  await p2.addInitScript(fakeAac, FRAMES);
  await p2.addInitScript(fakePickers);
  await p2.addInitScript(() => { window.SPINE_TEST = { abWaitSec: 3 }; });
  let gone = false;
  await p2.route('**/tts/v1/audio/speech', route => gone || /paragraph 2\./.test(spoken(route)) ? (gone = true, fail500(route, 'gone', 502)) : route.continue());
  await openExport(p2, `${h.READER}?book=books/long.epub`);
  await p2.click('#abNone'); await p2.check('#abList input >> nth=0'); await p2.check('#abList input >> nth=1');
  await p2.check('input[name="abMode"][value="each"]');
  await p2.click('#abStart');
  await p2.waitForFunction(() => /Export stopped/.test(document.querySelector('#abNow').textContent), null, { timeout: 60000 });
  await p2.waitForTimeout(500);
  const names = await p2.evaluate(() => Object.keys(window.__files));
  assert.ok(!names.some(n => /Chapter One/.test(n)), `the chapter it stopped in wasn't written: ${names}`);
});

// Round 25 review, loop 3.
test('the export list\'s first shift-click in another book doesn\'t use the previous book\'s last click (round 25 review, L-306)', async () => {
  const page = await h.newPage();
  await openExport(page);
  await page.click('#abList input >> nth=2');   // (the third, last clicked)
  await page.click('#abCancel');
  await page.click('#ttsClose');
  await page.goto(`${h.READER}?book=books/long.epub`); await h.waitForBook(page);
  await page.keyboard.press('r'); await page.waitForTimeout(500); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  await page.waitForFunction(() => document.querySelector('#abDialog').open && document.querySelector('#abList').dataset.measured);
  const before = await page.$$eval('#abList input', els => els.map(e => e.checked));
  await page.click('#abList input >> nth=0', { modifiers: ['Shift'] });
  const after = await page.$$eval('#abList input', els => els.map(e => e.checked));
  assert.deepEqual(after, before.map((c, i) => i === 0 ? !c : c));
  assert.deepEqual(page.errors, []);
});
