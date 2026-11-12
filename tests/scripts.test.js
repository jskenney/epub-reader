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
// Temporary folders, removed after the tests even when one fails (REVIEW.md T-15). (Removing a folder of links
// removes the links, not what they point to.)
const temps = [];
const tempDir = prefix => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temps.push(d); return d; };
test.after(() => { for (const d of temps) fs.rmSync(d, { recursive: true, force: true }); });
// A copy of the repository's scripts, checksums and downloaded libraries, so nothing needs downloading.
function sandbox() {
  const dir = tempDir('spine-scripts-');
  for (const f of ['fetch-libs.sh', 'fetch-kokoro.sh', 'fetch-pocket.sh', 'fetch-fonts.sh', 'index.html']) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
  fs.cpSync(path.join(REPO, 'checksums'), path.join(dir, 'checksums'), { recursive: true });
  fs.cpSync(path.join(REPO, 'libs'), path.join(dir, 'libs'), { recursive: true, dereference: true });
  return dir;
}
// A PATH with every command except sha256sum and shasum.
function pathWithoutHashTools() {
  const bin = tempDir('spine-bin-');
  for (const d of ['/usr/local/bin', '/usr/bin', '/bin']) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (/^(sha256sum|shasum)$/.test(f) || fs.existsSync(path.join(bin, f))) continue;
      try { fs.symlinkSync(path.join(d, f), path.join(bin, f)); } catch {}
    }
  }
  return bin;
}
// A stub command in a folder of links to the real ones: the link is removed first, so writing the stub can
// never write through it to the real program (as root, that replaced /usr/bin/curl: REVIEW.md T-12).
function stub(bin, name, text) {
  const file = path.join(bin, name);
  fs.rmSync(file, { force: true });
  fs.writeFileSync(file, text, { mode: 0o755 });
  assert.equal(fs.lstatSync(file).isSymbolicLink(), false);
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
  stub(bin, 'curl', '#!/bin/sh\nexit 7\n');
  fs.symlinkSync(fs.realpathSync(spawnSync('sh', ['-c', 'command -v sha256sum']).stdout.toString().trim()), path.join(bin, 'sha256sum'));
  const bad = run(dir, 'fetch-libs.sh', [], { PATH: bin });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /BAD +libs\/marked\.min\.js \(removed\)/);
  assert.equal(fs.existsSync(path.join(dir, 'libs', 'marked.min.js')), false);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

test('a file the script downloads but its checksum list leaves out fails the check, rather than passing unchecked (L-89)', { skip: !libsFetched && 'libs/ not fetched' }, () => {
  const dir = sandbox();
  const sums = path.join(dir, 'checksums', 'libs.sha256');
  fs.writeFileSync(sums, fs.readFileSync(sums, 'utf8').split('\n').filter(l => !l.endsWith('libs/marked.min.js')).join('\n'));
  const r = run(dir, 'fetch-libs.sh');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /UNPINNED libs\/marked\.min\.js/);
  assert.doesNotMatch(r.out, /All files match/);
  assert.equal(fs.existsSync(path.join(dir, 'libs', 'marked.min.js')), true, 'kept: it may be right, it just can\'t be checked');
  fs.rmSync(dir, { recursive: true, force: true });
});

test("fetch scripts: a stale partial download from another address starts afresh; a server that can't resume restarts it (L-58)", { skip: !libsFetched && 'libs/ not fetched' }, () => {
  const dir = sandbox();
  fs.rmSync(path.join(dir, 'libs', 'marked.min.js'));
  fs.writeFileSync(path.join(dir, 'libs', 'marked.min.js.part'), 'stale bytes from an older version');
  fs.writeFileSync(path.join(dir, 'libs', 'marked.min.js.part.url'), 'https://cdnjs.cloudflare.com/ajax/libs/marked/1.0.0/marked.min.js\n');
  // A curl that logs its calls, can't resume (exit 33, as for a server ignoring ranges), and otherwise "downloads"
  // the real file (appending to what is there, as -C - would).
  const bin = tempDir('spine-bin-'), log = path.join(bin, 'log');
  stub(bin, 'curl', `#!/bin/sh
echo "$*" >> "${log}"
out=""; prev=""; for a; do [ "$prev" = "-o" ] && out=$a; prev=$a; done
case " $* " in *" -C "*) [ -s "$out" ] && exit 33 ;; esac
cat "${REPO}/\${out%.part}" >> "$out"
`);
  const r = run(dir, 'fetch-libs.sh', [], { PATH: `${bin}:${process.env.PATH}` });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /All files match their checksums/);
  assert.equal(fs.existsSync(path.join(dir, 'libs', 'marked.min.js.part.url')), false);
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(l => l.includes('marked.min.js'));
  assert.equal(calls.length, 1, 'the stale partial file (another address) was dropped, so one fresh download: ' + calls.join(' | '));
  // A partial file from the same address, on a server that can't resume: started again from the beginning.
  fs.rmSync(path.join(dir, 'libs', 'marked.min.js'));
  fs.writeFileSync(path.join(dir, 'libs', 'marked.min.js.part'), 'partial');
  fs.writeFileSync(path.join(dir, 'libs', 'marked.min.js.part.url'), 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js\n');
  fs.writeFileSync(log, '');
  const r2 = run(dir, 'fetch-libs.sh', [], { PATH: `${bin}:${process.env.PATH}` });
  assert.equal(r2.code, 0, r2.out);
  const calls2 = fs.readFileSync(log, 'utf8').split('\n').filter(l => l.includes('marked.min.js'));
  assert.deepEqual(calls2.map(c => / -C /.test(` ${c} `)), [true, false], calls2.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

const fontsFetched = fs.existsSync(path.join(REPO, 'fonts', 'SHA256SUMS'));
test('fetch-fonts.sh --strict fails on a changed file or a font file not in the list, replacing nothing (L-6)', { skip: !fontsFetched && 'fonts/ not fetched' }, () => {
  const dir = sandbox();
  fs.cpSync(path.join(REPO, 'fonts'), path.join(dir, 'fonts'), { recursive: true, dereference: true });
  // Offline: Google's stylesheet now names a font file that isn't in fonts/SHA256SUMS; nothing else answers.
  const bin = tempDir('spine-bin-');
  stub(bin, 'curl', '#!/bin/sh\nfor a; do u=$a; done\ncase $u in *googleapis*) echo "@font-face{src:url(https://fonts.gstatic.com/s/new/v1/x.woff2)}";; *) exit 7;; esac\n');
  const env = { PATH: `${bin}:${process.env.PATH}` };
  assert.equal(run(dir, 'fetch-fonts.sh', ['--bogus'], env).code, 2);
  const first = fs.readFileSync(path.join(dir, 'fonts', 'SHA256SUMS'), 'utf8').split('\n')[0].split(/\s+/)[1];
  const file = path.join(dir, 'fonts', first);
  fs.appendFileSync(file, 'x');
  const changed = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(changed.code, 1, changed.out);
  assert.match(changed.out, /changed or missing on disk \(--strict: nothing was replaced\)/);
  assert.ok(fs.existsSync(file), 'the changed file is left for you to look at');
  // A listed file that's gone is an error too, not something to fetch and trust again.
  const sums = fs.readFileSync(path.join(dir, 'fonts', 'SHA256SUMS'), 'utf8');
  fs.rmSync(file);
  const missing = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(missing.code, 1, missing.out);
  assert.match(missing.out, /MISSING/);
  assert.equal(fs.readFileSync(path.join(dir, 'fonts', 'SHA256SUMS'), 'utf8'), sums, 'the list is never rewritten with --strict');
  fs.copyFileSync(path.join(REPO, 'fonts', first), file);
  const unknown = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(unknown.code, 1, unknown.out);
  assert.match(unknown.out, /files\/new\/v1\/x\.woff2 isn't in fonts\/SHA256SUMS/);
  // No list to check against: --strict refuses to start.
  fs.renameSync(path.join(dir, 'fonts', 'SHA256SUMS'), path.join(dir, 'fonts', 'SUMS.bak'));
  const nolist = run(dir, 'fetch-fonts.sh', ['--strict'], env);
  assert.equal(nolist.code, 1, nolist.out);
  assert.match(nolist.out, /No fonts\/SHA256SUMS to check against/);
  fs.renameSync(path.join(dir, 'fonts', 'SUMS.bak'), path.join(dir, 'fonts', 'SHA256SUMS'));
  // Without --strict a changed file is still removed to be fetched again (trust on first use).
  fs.appendFileSync(file, 'x');
  assert.match(run(dir, 'fetch-fonts.sh', [], env).out, /BAD .*\(removed\)/);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
});

test('versions pinned in index.html and in the fetch scripts agree, read from their definitions (D-3, T-19)', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const page = read('index.html'), libs = read('fetch-libs.sh'), kokoro = read('fetch-kokoro.sh'), pocket = read('fetch-pocket.sh');
  const v = (src, name) => src.match(new RegExp(`^${name}=(\\S+)`, 'm'))?.[1];
  // Each value from where index.html defines it (a match in a comment elsewhere doesn't count).
  const def = re => page.match(re)?.[1];
  const block = name => page.slice(page.indexOf(`const ${name} = {`), page.indexOf('};', page.indexOf(`const ${name} = {`)));
  assert.equal(def(/jszip: \{ file: 'libs\/jszip\.min\.js', cdn: '[^']*\/jszip\/([^/]+)\/jszip\.min\.js'/), v(libs, 'JSZIP'), 'JSZIP');
  assert.equal(def(/^const MARKED_URL = '[^']*\/marked\/([^/]+)\/marked\.min\.js';/m), v(libs, 'MARKED'), 'MARKED');
  assert.equal(def(/lamejs: \{ file: 'libs\/lame\.min\.js', cdn: '[^']*\/lamejs\/([^/]+)\/lame\.min\.js'/), v(libs, 'LAMEJS'), 'LAMEJS');
  assert.equal(def(/^const CM_VERSION = '([^']+)';/m), v(libs, 'CODEMIRROR'), 'CODEMIRROR');
  assert.equal(block('KOKORO').match(/lib: '[^']*kokoro-js@([^/]+)\//)?.[1], v(kokoro, 'KOKORO_JS'), 'KOKORO_JS');
  assert.equal(block('KOKORO').match(/revision: '([^']+)'/)?.[1], v(kokoro, 'REV'), 'Kokoro REV');
  assert.equal(block('POCKET').match(/lib: '[^']*pocket-tts-js@([^/]+)\//)?.[1], v(pocket, 'POCKET_JS'), 'POCKET_JS');
  assert.equal(block('POCKET').match(/ort: '[^']*onnxruntime-web@([^/]+)\//)?.[1], v(pocket, 'ORT'), 'ORT');
  assert.equal(block('POCKET').match(/model: '[^']*pocket-tts-onnx\/resolve\/([^/]+)\//)?.[1], v(pocket, 'REV'), 'Pocket REV');
  // TRANSFORMERS is the transformers.js inside kokoro-js: its runtime files must come from the same version.
  const bundle = path.join(__dirname, '..', 'kokoro', 'kokoro.web.js');
  if (fs.existsSync(bundle)) assert.ok(fs.readFileSync(bundle, 'utf8').includes(`"${v(kokoro, 'TRANSFORMERS')}"`), `TRANSFORMERS ${v(kokoro, 'TRANSFORMERS')} isn't the version kokoro.web.js bundles`);
});

test('the Subresource Integrity hashes in LIBS match the files in libs/, each its own (T-9, T-19)', { skip: !libsFetched && 'libs/ not fetched' }, () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const libs = Object.fromEntries([...page.matchAll(/(\w+): \{ file: 'libs\/([^']+)'[^}]*?integrity: '([^']+)'/g)].map(m => [m[2], m[3]]));
  assert.deepEqual(Object.keys(libs).sort(), ['emoji.json', 'highlight.min.js', 'jszip.min.js', 'lame.min.js', 'marked.min.js', 'temml.min.js']);
  for (const file of Object.keys(libs)) {
    const want = 'sha384-' + require('node:crypto').createHash('sha384').update(fs.readFileSync(path.join(__dirname, '..', 'libs', file))).digest('base64');
    assert.equal(libs[file], want, file);
  }
  // CodeMirror's files (E-21): every one fetch-libs.sh downloads is in CM_FILES, with its own hash.
  const block = page.slice(page.indexOf('const CM_FILES = ['), page.indexOf('];', page.indexOf('const CM_FILES = [')));
  const cm = Object.fromEntries([...block.matchAll(/\['([^']+)', '(sha384-[^']+)'\]/g)].map(m => [m[1], m[2]]));
  const dir = path.join(__dirname, '..', 'libs', 'codemirror');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(dir, path.join(d, e.name)).split(path.sep).join('/')]);
  assert.deepEqual(Object.keys(cm).sort(), walk(dir).sort());
  for (const [file, hash] of Object.entries(cm)) assert.equal(hash, 'sha384-' + require('node:crypto').createHash('sha384').update(fs.readFileSync(path.join(dir, file))).digest('base64'), file);
});

test("the Kokoro worker's source, written inside a template string in index.html, parses (L-7)", () => {
  const src = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const start = src.indexOf('const KOKORO_WORKER = `') + 'const KOKORO_WORKER = '.length;
  let end = start + 1;
  while (!(src[end] === '`' && src[end - 1] !== '\\')) end++;
  const file = path.join(tempDir('spine-worker-'), 'worker.mjs');
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

test('the version in Settings is one above the latest release tag, and tools/stamp-version.py writes it so', () => {
  const page = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const shown = page.match(/<span id="setVer">(v\d+\.\d+\.\d+) - (\d{8}\.\d{4})<\/span>/);
  assert.ok(shown, 'a version line');
  const tags = spawnSync('git', ['-C', REPO, 'tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' }).stdout.split('\n').filter(t => /^v\d+\.\d+\.\d+$/.test(t));
  const r = spawnSync('python3', [path.join(REPO, 'tools', 'stamp-version.py'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /^v\d+\.\d+\.\d+ - \d{8}\.\d{4}$/);
  if (!tags.length) return;   // (a clone without tags: nothing to compare with)
  const [maj, min, pat] = tags[0].slice(1).split('.').map(Number);
  assert.equal(shown[1], `v${maj}.${min}.${pat + 1}`);
  assert.equal(r.stdout.split(' ')[0], `v${maj}.${min}.${pat + 1}`);
});

// Round 25 review (M-120, M-121): the stamp keeps line endings; the hook doesn't stamp a temporary index; the hook
// and the scripts are checked out with LF everywhere.
test('stamp-version.py keeps the page\'s line endings; the pre-commit hook leaves a commit of named paths unstamped, so the index isn\'t left behind (round 25 review)', () => {
  const d = tempDir('stamp-');
  const git = (...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });
  fs.mkdirSync(path.join(d, 'tools')); fs.mkdirSync(path.join(d, '.githooks'));
  fs.copyFileSync(path.join(REPO, 'tools', 'stamp-version.py'), path.join(d, 'tools', 'stamp-version.py'));
  fs.copyFileSync(path.join(REPO, '.githooks', 'pre-commit'), path.join(d, '.githooks', 'pre-commit'));
  fs.chmodSync(path.join(d, '.githooks', 'pre-commit'), 0o755);
  const page = '<p>\r\n<span id="setVer">v0.0.1 - 20000101.0000</span>\r\n</p>\r\n';
  fs.writeFileSync(path.join(d, 'index.html'), page);
  git('init', '-q'); git('config', 'core.hooksPath', '.githooks'); git('config', 'core.autocrlf', 'false');
  git('add', '.'); assert.equal(git('commit', '-q', '--no-verify', '-m', 'one').status, 0); git('tag', 'v1.2.3');
  const r = spawnSync('python3', [path.join(d, 'tools', 'stamp-version.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const stamped = fs.readFileSync(path.join(d, 'index.html'), 'utf8');
  assert.match(stamped, /^<p>\r\n<span id="setVer">v1\.2\.4 - \d{8}\.\d{4}<\/span>\r\n<\/p>\r\n$/);
  // A commit of named paths: not stamped (git gives the hook a temporary index), and nothing left half-staged.
  fs.writeFileSync(path.join(d, 'index.html'), page.replace('<p>', '<p class="x">'));
  const c = git('commit', '-q', '-m', 'two', '--', 'index.html');
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stderr, /committing named paths, so the version line wasn't stamped/);
  assert.equal(git('status', '--porcelain').stdout.trim(), '');
  // A plain commit of the staged page: stamped.
  fs.writeFileSync(path.join(d, 'index.html'), page.replace('<p>', '<p class="y">'));
  git('add', 'index.html');
  assert.equal(git('commit', '-q', '-m', 'three').status, 0);
  assert.match(git('show', 'HEAD:index.html').stdout, /v1\.2\.4 - \d{8}\.\d{4}/);
  assert.equal(git('status', '--porcelain').stdout.trim(), '');
});

// (Only in a git checkout: a copy without .git has no attributes to ask about: round 26 review, T-52.)
test('the hook, scripts and page are checked out with LF line endings, whatever core.autocrlf says (round 25 review, M-121)', { skip: !fs.existsSync(path.join(REPO, '.git')) && 'not a git checkout' }, () => {
  for (const f of ['.githooks/pre-commit', 'tools/stamp-version.py', 'fetch-libs.sh', 'index.html', 'checksums/libs.sha256', '.github/workflows/slow.yml']) {
    const r = spawnSync('git', ['-C', REPO, 'check-attr', 'eol', '--', f], { encoding: 'utf8' });
    assert.match(r.stdout, /eol: lf$/m, f);
  }
});

test('fetch-fonts.sh reads ADDITIONAL_FONTS from ./reader-config.json and --config files, by the reader\'s rules (--list fetches nothing)', () => {
  const d = tempDir('fonts-');
  fs.copyFileSync(path.join(REPO, 'fetch-fonts.sh'), path.join(d, 'fetch-fonts.sh'));
  fs.copyFileSync(path.join(REPO, 'index.html'), path.join(d, 'index.html'));
  fs.writeFileSync(path.join(d, 'reader-config.json'), JSON.stringify({ ADDITIONAL_FONTS: ['Merriweather', 'bad<name>', 'Noto Serif:ital,wght@0,400;1,400'] }));
  const other = path.join(d, 'other.json');
  fs.writeFileSync(other, JSON.stringify({ ADDITIONAL_FONTS: 'Lora, Merriweather' }));
  const r = spawnSync('bash', ['fetch-fonts.sh', '--list', '--config', other], { cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const extra = r.stdout.trim().split('\n').filter(l => l.startsWith('g-'));
  assert.deepEqual(extra, [
    'g-merriweather https://fonts.googleapis.com/css2?family=Merriweather&display=swap',
    'g-noto-serif https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;1,400&display=swap',
    'g-lora https://fonts.googleapis.com/css2?family=Lora&display=swap']);
  assert.match(r.stdout, /^lexend https:\/\/fonts\.googleapis\.com\/css2\?family=Lexend/m, 'the built-in fonts too');
  assert.match(r.stderr, /"bad<name>" isn't a Google Fonts family name \(skipped\)/);
  assert.equal(fs.existsSync(path.join(d, 'fonts')), false, 'nothing fetched');
});

test('fetch-fonts.sh: --config as typed from another folder; a family starting with a digit; the menu\'s own fonts left out; one family named twice with and without styles (round 26 review, L-349, L-350, L-356)', () => {
  const d = tempDir('fonts2-');
  fs.mkdirSync(path.join(d, 'site')); fs.mkdirSync(path.join(d, 'cfg'));
  fs.copyFileSync(path.join(REPO, 'fetch-fonts.sh'), path.join(d, 'site', 'fetch-fonts.sh'));
  fs.copyFileSync(path.join(REPO, 'index.html'), path.join(d, 'site', 'index.html'));
  fs.writeFileSync(path.join(d, 'cfg', 'a.json'), JSON.stringify({ ADDITIONAL_FONTS: ['Noto Serif:wght@400;700', '42dot Sans', 'Merriweather', 'Lexend:wght@400;700', 'Georgia'] }));   // (Georgia: the device's, in the menu: L-371)
  fs.writeFileSync(path.join(d, 'cfg', 'b.json'), JSON.stringify({ ADDITIONAL_FONTS: 'Merriweather:ital,wght@0,400;1,400' }));
  const r = spawnSync('bash', ['site/fetch-fonts.sh', '--list', '--config', 'cfg/a.json', '--config', 'cfg/b.json'], { cwd: d, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n').filter(l => l.startsWith('g-')), [
    'g-noto-serif https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&display=swap',
    'g-42dot-sans https://fonts.googleapis.com/css2?family=42dot+Sans&display=swap',
    'g-merriweather https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;1,400&display=swap']);
});
