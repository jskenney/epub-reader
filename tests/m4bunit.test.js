// The .m4b writer (index.html's abM4b) run in Node on real AAC frames from ffmpeg: a long book (far more
// frames than fit in a function's arguments) with more chapters than Nero markers hold (REVIEW.md E-10).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const has = cmd => { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const skip = !(has('ffmpeg') && has('ffprobe')) && 'needs ffmpeg and ffprobe';
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const body = src.slice(src.indexOf('// --- MP4 boxes (ISO BMFF)'), src.indexOf('// --- AAC encoding (WebCodecs)'));
const { abM4b, abMemorySink, abMp3, abOgg } = new Function('AB_KBPS', `${body}\nreturn { abM4b, abMemorySink, abMp3, abOgg };`)(64);

test('a 2 h 20 min book with 300 chapters: valid, every chapter listed, decodes (E-10 review)', { skip, timeout: 180000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-m4b-'));
  try {
    const aac = path.join(tmp, 'tone.aac');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=24000:duration=3', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-f', 'adts', aac]);
    const b = fs.readFileSync(aac), pool = [];
    for (let at = 0; at + 7 <= b.length;) { const len = ((b[at + 3] & 3) << 11) | (b[at + 4] << 3) | (b[at + 5] >> 5), head = (b[at + 1] & 1) ? 7 : 9; pool.push(new Uint8Array(b.subarray(at + head, at + len))); at += len; }
    const frames = 200000, rate = 24000, m4b = abM4b(abMemorySink());
    m4b.setFormat(rate, Uint8Array.of(0x13, 0x08));
    for (let i = 0; i < frames; i++) await m4b.add(pool[4 + i % (pool.length - 8)], 1024);
    const secs = frames * 1024 / rate, chapters = Array.from({ length: 300 }, (_, k) => ({ title: `Chapter ${k + 1} — café`, start: k * secs / 300 }));
    const out = await m4b.finish({ title: 'Long', album: 'Long', artist: 'A', chapters });
    const file = path.join(tmp, 'long.m4b');
    fs.writeFileSync(file, Buffer.from(await out.blob.arrayBuffer()));
    const p = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_chapters', '-show_format', '-of', 'json', file], { maxBuffer: 1 << 26 }).toString());
    assert.ok(Math.abs(Number(p.format.duration) - secs) < 1, `${p.format.duration} vs ${secs}`);
    assert.equal(p.chapters.length, 300);
    assert.equal(p.chapters[299].tags.title, 'Chapter 300 — café');
    assert.ok(Math.abs(Number(p.chapters[150].start_time) - secs / 2) < 0.1);
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('nothing made: no file, a clear error (E-10 review)', async () => {
  const m4b = abM4b(abMemorySink());
  await assert.rejects(m4b.finish({ title: 'x', album: 'x', chapters: [] }), /no audio/);
});

test('the SHA-1 used for font obfuscation where the browser has none (plain http) matches the real one (L-88)', async () => {
  const sha1src = src.slice(src.indexOf('async function sha1(bytes){'), src.indexOf('function zipSource(zip){'));
  const sha1 = new Function('crypto', `${sha1src}\nreturn sha1;`)({});   // (no crypto.subtle: the page's own version)
  for (const t of ['', 'abc', 'urn:isbn:9780000000001', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(1000)]) {
    const want = require('node:crypto').createHash('sha1').update(t).digest('hex');
    assert.equal(Buffer.from(await sha1(new TextEncoder().encode(t))).toString('hex'), want, JSON.stringify(t.slice(0, 10)));
  }
});

// The .mp3 and .opus writers (E-17), fed real frames from ffmpeg.
const probeAll = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_chapters', '-show_format', '-show_streams', '-of', 'json', file], { maxBuffer: 1 << 26 }).toString());
// The frames of a tag (ID3v2.3: plain sizes), as [id, body].
function id3Frames(b, at = 10, end = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9])) {
  const out = [];
  while (at + 10 <= end && b[at]) { const n = b.readUInt32BE(at + 4); out.push([b.toString('latin1', at, at + 4), b.subarray(at + 10, at + 10 + n)]); at += 10 + n; }
  return out;
}
test('.mp3 with 300 chapters with long non-Latin titles: every chapter read, tables of 255 (E-17 review)', { skip, timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-mp3-'));
  try {
    const raw = path.join(tmp, 'tone.mp3');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=24000:duration=60', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '0', '-id3v2_version', '0', raw]);
    const titles = Array.from({ length: 300 }, (_, k) => `Глава ${k + 1}: ${'я'.repeat(90)}`);   // (about 190 bytes in UTF-8)
    const mp3 = abMp3(abMemorySink('audio/mpeg'), { title: 'Книга', album: 'Книга', artist: 'Автор', titles });
    const data = new Uint8Array(fs.readFileSync(raw));
    for (let i = 0; i < data.length; i += 4096) await mp3.add(data.subarray(i, i + 4096), 60 * Math.min(1, (i + 4096) / data.length));
    const out = await mp3.finish({ chapters: titles.map((title, k) => ({ title, start: k * 0.2 })) });
    const file = path.join(tmp, 'book.mp3'), b = Buffer.from(await out.blob.arrayBuffer());
    fs.writeFileSync(file, b);
    assert.equal(b[3], 3);   // (ID3v2.3)
    const p = probeAll(file);
    assert.equal(p.chapters.length, 300);
    assert.equal(p.chapters[299].tags.title, titles[299]);
    assert.equal(p.format.tags.title, 'Книга'); assert.equal(p.format.tags.artist, 'Автор');
    const tocs = id3Frames(b).filter(([id]) => id === 'CTOC').map(([, f]) => { const z = f.indexOf(0); return { id: f.toString('latin1', 0, z), flags: f[z + 1], count: f[z + 2] }; });
    assert.deepEqual(tocs, [{ id: 'toc', flags: 3, count: 2 }, { id: 'toc1', flags: 1, count: 255 }, { id: 'toc2', flags: 1, count: 45 }]);
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// The packets of an Ogg stream.
function oggPackets(b) {
  const out = []; let cur = [];
  for (let at = 0; at < b.length;) {
    const n = b[at + 26], segs = b.subarray(at + 27, at + 27 + n); let p = at + 27 + n;
    for (const s of segs) { cur.push(b.subarray(p, p + s)); p += s; if (s < 255) { out.push(Buffer.concat(cur)); cur = []; } }
    at = p;
  }
  return out;
}
test('.opus with 1005 chapters: the first 999 kept with the right titles, track tags, the end trimmed (E-17 review)', { skip, timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-opus-'));
  try {
    const raw = path.join(tmp, 'tone.opus');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=30', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', raw]);
    const packets = oggPackets(fs.readFileSync(raw)).slice(2);   // (after OpusHead and OpusTags)
    const titles = Array.from({ length: 1005 }, (_, k) => `Chap ${k + 1}`);
    const ogg = abOgg(abMemorySink('audio/ogg'), { title: 'Many', album: 'Many', titles, track: [2, 7] });
    ogg.setFormat(48000, null, 1);
    for (const pk of packets) await ogg.add(new Uint8Array(pk), 960);
    const secs = (packets.length * 960 - 312 - 500) / 48000;   // (as if the last frame were partly padding)
    const out = await ogg.finish({ chapters: titles.map((title, k) => ({ title, start: k * 0.025 })), seconds: secs });
    const file = path.join(tmp, 'many.opus');
    fs.writeFileSync(file, Buffer.from(await out.blob.arrayBuffer()));
    const p = probeAll(file);
    assert.equal(p.chapters.length, 999);
    assert.equal(p.chapters[99].tags.title, 'Chap 100');
    assert.equal(p.chapters[998].tags.title, 'Chap 999');
    const tags = Object.fromEntries(Object.entries({ ...p.format.tags, ...p.streams[0].tags }).map(([k, v]) => [k.toLowerCase(), v]));
    assert.equal(tags.track, '2'); assert.equal(tags.tracktotal, '7');
    // (ffprobe's duration counts the pre-skip: 312 samples at 48 kHz.)
    assert.ok(Math.abs(Number(p.format.duration) - (secs + 312 / 48000)) < 0.001, `${p.format.duration} vs ${secs}`);
    assert.ok(Math.abs(out.secs - secs) < 0.001);
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
