// The in-place ZIP reader (index.html's lazyZip), run in Node on archives built in memory: what the browser
// tests can't easily reach (REVIEW.md T-10, L-26, L-30).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const body = src.slice(src.indexOf('const u16 = (b, o) =>'), src.indexOf('const zipFromBlob ='));
const { lazyZip, crc32 } = new Function(`${body}\nreturn { lazyZip, crc32 };`)();

// A stored (uncompressed) ZIP of { name: bytes }: [archive, { name: offset of its data }].
function zip(files) {
  const parts = [], central = [], offsets = {};
  let at = 0;
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(at, 42);
    central.push(c, n);
    offsets[name] = at + 30 + n.length;
    parts.push(local, n, data);
    at += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return [Buffer.concat([...parts, cd, end]), offsets];
}
const reader = buf => async (o, l) => new Uint8Array(buf.subarray(o, o + l));

test('checksums: every read of a file up to 32 MB is checked; larger files only the first time (L-26, T-10)', async () => {
  const big = Buffer.alloc((32 << 20) + 1000, 7), small = Buffer.from('small file '.repeat(100));
  const [buf, at] = zip({ 'big.bin': big, 'small.txt': small, 'pic.png': Buffer.alloc(300000, 3) });
  const z = await lazyZip(reader(buf), buf.length);
  assert.equal((await z.file('big.bin').async('uint8array')).length, big.length);
  assert.equal((await z.file('pic.png').async('uint8array')).length, 300000);
  // The same bytes changed on the server, the sizes unchanged.
  buf[at['big.bin'] + 5] ^= 1; buf[at['pic.png'] + 5] ^= 1;
  await assert.rejects(z.file('pic.png').async('uint8array'), /pic\.png: damaged archive, or the book changed while it was open/);
  assert.equal((await z.file('big.bin').async('uint8array'))[5], 6, 'a file over 32 MB already checked once is not checked again');
  // A small text file is kept after its first read, so it isn't read (or checked) again.
  assert.match(await z.file('small.txt').async('string'), /^small file/);
});

test('a wrong checksum: refused by default, used with a warning when lenient (uploads) (L-30, T-10)', async () => {
  const [buf, at] = zip({ 'a.txt': Buffer.from('hello world') });
  buf[at['a.txt']] = 'j'.charCodeAt(0);   // "jello world": the archive's checksum is now wrong
  await assert.rejects((await lazyZip(reader(buf), buf.length)).file('a.txt').async('string'), /checksum doesn't match/);
  const warn = console.warn, warned = [];
  console.warn = m => warned.push(m);
  try { assert.equal(await (await lazyZip(reader(buf), buf.length, { lenientChecksums: true })).file('a.txt').async('string'), 'jello world'); }
  finally { console.warn = warn; }
  assert.match(warned.join(' '), /a\.txt: its checksum doesn't match/);
});

test('an archive with data before it (a self-extracting archive) is read in place, its offsets moved (L-149)', async () => {
  const [plain] = zip({ 'a.txt': Buffer.from('hello world'), 'b.txt': Buffer.from('second file') });
  const buf = Buffer.concat([Buffer.alloc(1234, 0x4d), plain]);   // (1234 bytes of "program" first)
  const z = await lazyZip(reader(buf), buf.length);
  assert.ok(z, 'read in place');
  assert.equal(await z.file('a.txt').async('string'), 'hello world');
  assert.equal(await z.file('b.txt').async('string'), 'second file');
});
