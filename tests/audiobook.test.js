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

// Real AAC-LC frames (24 kHz mono), without their ADTS headers.
function aacFrames() {
  const file = path.join(tmp, 'tone.aac');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=24000:duration=3', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-f', 'adts', file]);
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
  await page.waitForFunction(() => document.querySelector('#abDialog').open);
}
async function exportAll(page, mode, count) {
  await page.check(`input[name="abMode"][value="${mode}"]`);
  const files = [];
  const got = new Promise(res => page.on('download', async d => { const f = path.join(tmp, d.suggestedFilename()); await d.saveAs(f); files.push(f); if (files.length === count) res(); }));
  await page.click('#abStart');
  await Promise.race([got, new Promise((_, rej) => setTimeout(() => rej(new Error('no downloads: ' + files.join())), 90000))]);
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
  assert.match(await page.textContent('#abSummary'), /^2 chapters/);
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

test('the device voice, or a browser without AAC, explains why export is not possible (E-10)', async () => {
  const page = await h.newPage();
  await h.openReader(page, ABC, { 'spine:ttsEngine': 'server' });
  await page.keyboard.press('r'); await page.waitForTimeout(300); await page.keyboard.press(' ');
  await page.click('#ttsExport');
  assert.match(await page.textContent('#abNote'), /can't make AAC audio/);
  assert.equal(await page.isDisabled('#abStart'), true);
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
  window.__files = {};
  const handle = name => ({ name, async createWritable() {
    let buf = new Uint8Array(0), pos = 0;
    const put = (data, at) => { const d = data instanceof Uint8Array ? data : new Uint8Array(data); if (at + d.length > buf.length) { const nb = new Uint8Array(at + d.length); nb.set(buf); buf = nb; } buf.set(d, at); return at + d.length; };
    return { async write(x) { if (x?.type === 'write') { put(x.data, x.position); } else pos = put(x, pos); },
      async close() { let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768)); window.__files[name] = btoa(s); },
      async abort() {} };
  } });
  window.showSaveFilePicker = async o => handle(o.suggestedName);
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
