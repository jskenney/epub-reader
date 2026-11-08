// The CDN version of the reader policy in nginx.conf.example (REVIEW.md T-5): with nothing self-hosted, the
// reader loads its libraries, fonts and (with SLOW=1) voice models from the CDNs that policy allows, and the
// policy refuses none of it. Needs internet access, so it runs only with NETWORK=1 (see the scheduled
// workflow in .github/workflows/slow.yml); every other test blocks other sites.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const network = !process.env.NETWORK && 'set NETWORK=1 to run (loads from the CDNs)';
const slow = !process.env.SLOW && 'set SLOW=1 too (loads a real voice model)';
const CDNS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'huggingface.co', 'hf.co'];
// folder-cdn's config points LIB_FILES at a folder that doesn't exist, and it has no voice files.
const URL = `${h.CDN}/folder-cdn/index.html?book=/reader/books/long.epub`;

// Offline, the CDN requests are answered with the self-hosted copies of the same files: the browser still
// applies the policy to those hosts, so this checks the policy allows them, without internet access.
test('the CDN policy allows the CDN hosts the reader uses for libraries and fonts (answered locally) (T-5)', async () => {
  const repo = path.join(__dirname, '..');
  const font = fs.readFileSync(path.join(repo, 'fonts', fs.readFileSync(path.join(repo, 'fonts', 'SHA256SUMS'), 'utf8').split('\n')[0].split(/\s+/)[1]));
  const page = await h.newPage();
  const seen = [];
  await page.route(/^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => {
    const u = route.request().url();
    seen.push(u);
    if (/jszip\.min\.js$/.test(u)) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(repo, 'libs', 'jszip.min.js')), headers: { 'access-control-allow-origin': '*' } });
    if (/marked\.min\.js$/.test(u)) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(repo, 'libs', 'marked.min.js')), headers: { 'access-control-allow-origin': '*' } });
    if (/fonts\.googleapis\.com/.test(u)) return route.fulfill({ contentType: 'text/css', headers: { 'access-control-allow-origin': '*' },
      body: ['IBM Plex Sans', 'IBM Plex Mono', 'Literata'].map(f => `@font-face{font-family:'${f}';src:url(https://fonts.gstatic.com/s/test/${f.replace(/ /g, '')}.woff2) format('woff2')}`).join('\n') });
    return route.fulfill({ contentType: 'font/woff2', body: font, headers: { 'access-control-allow-origin': '*' } });
  });
  await h.openReader(page, URL);
  assert.equal(await h.title(page), 'The Long Book');
  assert.ok(seen.some(u => /cdnjs\.cloudflare\.com\/.*jszip\.min\.js$/.test(u)), seen.join(' '));
  assert.ok(await h.waitFor(() => seen.some(u => /fonts\.gstatic\.com/.test(u)), 10000), seen.join(' '));
  assert.deepEqual(page.cspViolations, []);
  assert.deepEqual(page.blocked, []);
});

test('nothing self-hosted: libraries and fonts come from the CDNs, and the CDN policy refuses none of it (T-5)', { skip: network, timeout: 120000 }, async () => {
  const page = await h.newPage({ allow: CDNS });
  const loaded = [];
  page.on('requestfinished', r => loaded.push(r.url()));
  await h.openReader(page, URL);
  assert.equal(await h.title(page), 'The Long Book');
  assert.ok(loaded.some(u => /cdnjs\.cloudflare\.com\/.*jszip\.min\.js$/.test(u)), 'JSZip from cdnjs');
  assert.ok(await h.waitFor(() => loaded.some(u => /fonts\.gstatic\.com\//.test(u)), 20000), 'fonts from Google Fonts');
  assert.deepEqual(page.cspViolations, []);
});

for (const engine of ['kokoro', 'pocket'])
test(`${engine} from the CDNs speaks under the CDN policy (T-5)`, { skip: network || slow, timeout: 900000 }, async () => {
  const page = await h.newPage({ allow: CDNS });
  await h.openReader(page, URL, { 'spine:ttsEngine': engine });
  await page.keyboard.press('r');
  await page.click('#ttsDownload').catch(() => {});
  assert.ok(await h.waitFor(() => h.spokenWord(page), 840000, 1000), await page.textContent('#ttsStatus'));
  assert.deepEqual(page.cspViolations, [], 'the CDN policy must allow every host the voice uses');
});
