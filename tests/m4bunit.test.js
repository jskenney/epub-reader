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
const { abM4b, abMemorySink } = new Function('AB_KBPS', `${body}\nreturn { abM4b, abMemorySink };`)(64);

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
