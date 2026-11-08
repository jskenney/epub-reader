// The fetch scripts, run offline in a temporary copy of the repository: option parsing, and checksum
// verification that fails closed (REVIEW.md L-3 to L-5, M-4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const run = (cwd, script, args = [], env = {}) => {
  const r = spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
};
// A copy of the repository's scripts, checksums and downloaded libraries, so nothing needs downloading.
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-scripts-'));
  for (const f of ['fetch-libs.sh', 'fetch-kokoro.sh', 'fetch-pocket.sh', 'fetch-fonts.sh', 'index.html']) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
  fs.cpSync(path.join(REPO, 'checksums'), path.join(dir, 'checksums'), { recursive: true });
  fs.cpSync(path.join(REPO, 'libs'), path.join(dir, 'libs'), { recursive: true, dereference: true });
  return dir;
}
// A PATH with every command except sha256sum and shasum.
function pathWithoutHashTools() {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-bin-'));
  for (const d of ['/usr/local/bin', '/usr/bin', '/bin']) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (/^(sha256sum|shasum)$/.test(f) || fs.existsSync(path.join(bin, f))) continue;
      try { fs.symlinkSync(path.join(d, f), path.join(bin, f)); } catch {}
    }
  }
  return bin;
}
const libsFetched = fs.existsSync(path.join(REPO, 'libs', 'jszip.min.js'));

test('options work in any order, and unknown ones are refused (L-5)', () => {
  const a = run(REPO, 'fetch-pocket.sh', ['--int8', '--list', 'en']);
  const b = run(REPO, 'fetch-pocket.sh', ['--list', 'en', '--int8']);
  assert.equal(a.code, 0, a.out);
  assert.equal(a.out, b.out);
  assert.match(a.out, /flow_lm_main_int8\.onnx/);
  // 5 languages x 7 files + library, runtime and licences (French isn't offered).
  assert.equal(run(REPO, 'fetch-pocket.sh', ['--list', 'all']).out.split('\n').filter(Boolean).length, 44);
  const fr = run(REPO, 'fetch-pocket.sh', ['--list', 'fr']);
  assert.equal(fr.code, 1);
  assert.match(fr.out, /French isn't available/);
  assert.equal(run(REPO, 'fetch-kokoro.sh', ['--bogus']).code, 2);
  assert.equal(run(REPO, 'fetch-libs.sh', ['--list', '--no-verify']).code, 0);
});

test('downloads are checked, and the check fails closed (L-3, L-4)', { skip: !libsFetched && 'libs/ not fetched' }, () => {
  const dir = sandbox();
  assert.match(run(dir, 'fetch-libs.sh').out, /All files match their checksums/);
  // No SHA-256 tool: stop with an error, unless told to skip the check.
  const bin = pathWithoutHashTools();
  const noTool = run(dir, 'fetch-libs.sh', [], { PATH: bin });
  assert.equal(noTool.code, 1, noTool.out);
  assert.match(noTool.out, /Neither sha256sum nor shasum is installed/);
  const skipped = run(dir, 'fetch-libs.sh', ['--no-verify'], { PATH: bin });
  assert.equal(skipped.code, 0, skipped.out);
  assert.match(skipped.out, /Checksums not checked/);
  // No checksum list: stop too.
  fs.renameSync(path.join(dir, 'checksums', 'libs.sha256'), path.join(dir, 'checksums', 'gone'));
  assert.equal(run(dir, 'fetch-libs.sh').code, 1);
  fs.renameSync(path.join(dir, 'checksums', 'gone'), path.join(dir, 'checksums', 'libs.sha256'));
  // A file whose name is only part of a listed path isn't counted as pinned.
  fs.writeFileSync(path.join(dir, 'libs', 'jszip.min'), 'x');
  assert.match(run(dir, 'fetch-libs.sh').out, /note +libs\/jszip\.min has no pinned checksum/);
  // A changed file is removed, and the run fails (with downloading disabled by an unusable curl).
  fs.appendFileSync(path.join(dir, 'libs', 'marked.min.js'), '\n');
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nexit 7\n', { mode: 0o755 });
  fs.symlinkSync(fs.realpathSync(spawnSync('sh', ['-c', 'command -v sha256sum']).stdout.toString().trim()), path.join(bin, 'sha256sum'));
  const bad = run(dir, 'fetch-libs.sh', [], { PATH: bin });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /BAD +libs\/marked\.min\.js \(removed\)/);
  assert.equal(fs.existsSync(path.join(dir, 'libs', 'marked.min.js')), false);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

const fontsFetched = fs.existsSync(path.join(REPO, 'fonts', 'SHA256SUMS'));
test('fetch-fonts.sh --strict fails on a changed file or a font file not in the list, replacing nothing (L-6)', { skip: !fontsFetched && 'fonts/ not fetched' }, () => {
  const dir = sandbox();
  fs.cpSync(path.join(REPO, 'fonts'), path.join(dir, 'fonts'), { recursive: true, dereference: true });
  // Offline: Google's stylesheet now names a font file that isn't in fonts/SHA256SUMS; nothing else answers.
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-bin-'));
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nfor a; do u=$a; done\ncase $u in *googleapis*) echo "@font-face{src:url(https://fonts.gstatic.com/s/new/v1/x.woff2)}";; *) exit 7;; esac\n', { mode: 0o755 });
  const env = { PATH: `${bin}:${process.env.PATH}` };
  assert.equal(run(dir, 'fetch-fonts.sh', ['--bogus'], env).code, 2);
  const first = fs.readFileSync(path.join(dir, 'fonts', 'SHA256SUMS'), 'utf8').split('\n')[0].split(/\s+/)[1];
  const file = path.join(dir, 'fonts', first);
  fs.appendFileSync(file, 'x');
  const changed = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(changed.code, 1, changed.out);
  assert.match(changed.out, /changed on disk \(--strict: nothing was replaced\)/);
  assert.ok(fs.existsSync(file), 'the changed file is left for you to look at');
  fs.copyFileSync(path.join(REPO, 'fonts', first), file);
  const unknown = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(unknown.code, 1, unknown.out);
  assert.match(unknown.out, /files\/new\/v1\/x\.woff2 isn't in fonts\/SHA256SUMS/);
  // Without --strict a changed file is still removed to be fetched again (trust on first use).
  fs.appendFileSync(file, 'x');
  assert.match(run(dir, 'fetch-fonts.sh', [], env).out, /BAD .*\(removed\)/);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

test('versions pinned in index.html and in the fetch scripts agree (D-3)', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const page = read('index.html'), libs = read('fetch-libs.sh'), kokoro = read('fetch-kokoro.sh'), pocket = read('fetch-pocket.sh');
  const v = (src, name) => src.match(new RegExp(`^${name}=(\\S+)`, 'm'))?.[1];
  assert.ok(page.includes(`/jszip/${v(libs, 'JSZIP')}/jszip.min.js`), 'JSZIP');
  assert.ok(page.includes(`/marked/${v(libs, 'MARKED')}/marked.min.js`), 'MARKED');
  assert.ok(page.includes(`kokoro-js@${v(kokoro, 'KOKORO_JS')}/`), 'KOKORO_JS');
  assert.ok(page.includes(`revision: '${v(kokoro, 'REV')}'`), 'Kokoro REV');
  assert.ok(page.includes(`pocket-tts-js@${v(pocket, 'POCKET_JS')}/`), 'POCKET_JS');
  assert.ok(page.includes(`onnxruntime-web@${v(pocket, 'ORT')}/`), 'ORT');
  assert.ok(page.includes(`pocket-tts-onnx/resolve/${v(pocket, 'REV')}/`), 'Pocket REV');
});

test('the Subresource Integrity hashes in LIBS match the files in libs/ (T-9)', { skip: !libsFetched && 'libs/ not fetched' }, () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const file of ['jszip.min.js', 'marked.min.js']) {
    const want = 'sha384-' + require('node:crypto').createHash('sha384').update(fs.readFileSync(path.join(__dirname, '..', 'libs', file))).digest('base64');
    assert.ok(page.includes(`file: 'libs/${file}'`) && page.includes(`integrity: '${want}'`), `${file}: ${want} isn't in LIBS`);
  }
});

test("the Kokoro worker's source, written inside a template string in index.html, parses (L-7)", () => {
  const src = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const start = src.indexOf('const KOKORO_WORKER = `') + 'const KOKORO_WORKER = '.length;
  let end = start + 1;
  while (!(src[end] === '`' && src[end - 1] !== '\\')) end++;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'spine-worker-')), 'worker.mjs');
  fs.writeFileSync(file, eval(src.slice(start, end + 1)));   // the text the worker is given
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('no GNU-only sed escapes (a tab written as \\t) in the scripts (M-4)', () => {
  for (const f of ['fetch-libs.sh', 'fetch-kokoro.sh', 'fetch-pocket.sh', 'fetch-fonts.sh']) {
    const sedCalls = fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').filter(l => /\bsed\b/.test(l) && !l.trim().startsWith('#'));
    for (const l of sedCalls) assert.doesNotMatch(l, /\\t/, `${f}: ${l}`);
  }
});
