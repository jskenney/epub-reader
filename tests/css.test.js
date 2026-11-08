// The book CSS cleaning (REVIEW.md L-20, L-25, L-29, T-10), run on the reader's own code taken from index.html:
// every form found so far, including ones XHTML can't hold (CR and FF in strings), must lose its remote
// address; then each result is loaded in Chromium, which must ask no other site for anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.after(h.close);

// The cleaning functions, with the few things they use from the rest of the page.
function cleaner(allowRemote = false) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const from = src.indexOf("/* A book's CSS is read with a tokenizer");
  const to = src.indexOf('\n}\n', src.indexOf('async function rewriteCss')) + 3;
  const line = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n', a)); };
  const body = [line('const isExternal = '), line('const urlText = '), line('const isRemote = '), src.slice(from, to)].join('\n');
  const files = { 'local.css': '.l{background:url(pic.png)}' };
  return new Function('ALLOW_REMOTE_CONTENT', 'book', 'resolve', 'readText', 'resourceURL', `${body}\nreturn { rewriteCss, cssTokens };`)(
    allowRemote, { zip: null }, (base, ref) => ref, async (zip, p) => files[p] ?? null, async p => (p.startsWith('missing') ? null : `blob:local/${p}`));
}

const R = 'http://evil.test';
const LEAKS = [
  `a{background-image:url(${R}/1.png)}`, `a{background-image:URL( "${R}/2.png" )}`, `a{background-image:u\\72l(${R}/3.png)}`, `a{background-image:url(\\68ttp://evil.test/4.png)}`,
  `a{background-image:url("${R}/5\\\n.png")}`, `a{background-image:url("${R}/5r\\\r\n.png")}`, `@import "${R}/6.css";`, `@\\69mport "${R}/7.css";`,
  `@import url(${R}/8.css) screen;`, `a{background-image:image-set(/*"*/"${R}/9.png" 1x)}`,
  `a{background-image:image-set(linear-gradient(red, rgb(0,0,0)) 1x, '${R}/10.png' 2x)}`, `a{background-image:im\\61ge-set('${R}/11.png' 1x)}`,
  `a{background-image:url('\\00005c\\00005cevil.test/12.png')}`, `@import u\\72l(a"b); @\\69mport "${R}/13.css";`,
  `@import url(a\\)"); @\\69mport "${R}/14.css";`, `@import "a\f; @\\69mport "${R}/15.css";`, `@import "a\r; @\\69mport "${R}/15r.css";`,
  `a{background-image:url(${' '.repeat(44)}a")} c{background-image:image-set(/*"*/"${R}/16.png" 1x)}`, `@import "${R}/a;b.css";`, `@import "${R}/eof.css"`,
  `a{background-image:src("${R}/17.png")}`, `@font-face{font-family:X;src:url("${R}/f.woff2") format("woff2"), local(x)} a{font-family:X}`,
  `a{background-image:-webkit-image-set("${R}/18.png" 1x)}`, `a{background:url(//evil.test/19.png)}`, `a{background:url(\\\\\\\\evil.test/20.png)}`,
  `a{background:url("ht\ttp://evil.test/21.png")}`, `a{background:url( "\\68ttp://evil.test/22.png" )}`,
];

test('every known form loses its remote address, in linear time (L-29, T-10)', async () => {
  const { rewriteCss } = cleaner();
  for (const css of LEAKS) {
    const out = await rewriteCss(css, 'x.css');
    assert.doesNotMatch(out, /evil\.test|\\68ttp|00005c/, `${JSON.stringify(css)} -> ${JSON.stringify(out)}`);
  }
  for (const big of ['a{b:url(' + 'x'.repeat(200000), '"'.repeat(100000), '/*'.repeat(50000), 'url('.repeat(50000), '\\aaaaaa'.repeat(30000), 'image-set('.repeat(30000), '@import '.repeat(30000)]) {
    const t0 = Date.now();
    await rewriteCss(big, 'x.css');
    assert.ok(Date.now() - t0 < 1000, `${big.slice(0, 12)}… took ${Date.now() - t0} ms`);
  }
});

test('everything else is left as written: strings, local files, fragments, data:, @namespace (L-21, L-29)', async () => {
  const { rewriteCss } = cleaner();
  const same = [`a{content:"see url(${R}/x.png) here"}`, `@namespace svg url(http://www.w3.org/2000/svg); svg|a{fill:url(#g)}`,
    `a{b:url(data:image/png;base64,AA)}`, `a{b:image("#x")}`, `a /* url(${R}/c.png) */ {color:red}`, `a{b:"\\"url(${R}/q.png)"}`,
    `a{background:url(ht\ttp://evil.test/bad-url.png)}`];   // (a raw tab: a bad url, which the browser never fetches)
  for (const css of same) assert.equal(await rewriteCss(css, 'x.css'), css);
  assert.equal(await rewriteCss('a{cursor:url(missing.cur), pointer}', 'x.css'), 'a{cursor:url(data:,), pointer}');
  assert.equal(await rewriteCss('@import "local.css"; x{y:url("pic (1).png")}', 'x.css'), '.l{background:url(blob:local/pic.png)} x{y:url(blob:local/pic%20%281%29.png)}');
  // With remote content allowed, remote addresses stay.
  assert.equal(await cleaner(true).rewriteCss(`a{b:url(${R}/x.png)}`, 'x.css'), `a{b:url(${R}/x.png)}`);
});

test('the cleaned CSS asks no other site for anything when the browser applies it (L-29, T-10)', async () => {
  const { rewriteCss } = cleaner();
  const page = await h.newPage();
  await page.setContent('<a>a</a><c>c</c><x class="l">x</x>');
  for (const css of LEAKS) {
    const out = await rewriteCss(css, 'x.css');
    await page.evaluate(t => { const s = document.createElement('style'); s.textContent = t; document.head.append(s); }, out);
  }
  await page.waitForTimeout(1000);
  assert.deepEqual(page.blocked.filter(u => /evil\.test/.test(u)), []);
  // ... while the same CSS uncleaned does (so the check can see a leak).
  for (const css of LEAKS.slice(0, 3)) await page.evaluate(t => { const s = document.createElement('style'); s.textContent = t; document.head.append(s); }, css);
  await page.waitForTimeout(1000);
  assert.ok(page.blocked.some(u => /evil\.test/.test(u)), 'the uncleaned CSS should have tried');
});
