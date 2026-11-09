// The book CSS cleaning (REVIEW.md L-20, L-25, L-29, T-10), run on the reader's own code taken from index.html:
// every form found so far, including ones XHTML can't hold (CR and FF in strings), must lose its remote
// address; then each result is loaded in Chromium, which must ask no other site for anything.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

// The cleaning functions, with the few things they use from the rest of the page.
function cleaner(allowRemote = false) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const from = src.indexOf("/* A book's CSS is read with a tokenizer");
  const to = src.indexOf('\n}\n', src.indexOf('async function rewriteCss')) + 3;
  const line = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n', a)); };
  const body = [line('const isExternal = '), line('const urlText = '), line('const isRemote = '), src.slice(from, to)].join('\n');
  const files = { 'local.css': '.l{background:url(pic.png)}', 'tail.css': 'a{background:url(', 'tail2.css': 'a{background:u',
    'tail3.css': 'a{background-image:image-set(', 'open-comment.css': '/* never closed', 'open-string.css': 'a{content:"never closed', 'red.css': 'x{color:rgb(255, 0, 0)}',
    // H-6: sheets that import themselves or each other many times.
    'self.css': '@import "self.css";\n'.repeat(30) + '/*' + 'x'.repeat(1000) + '*/ s{color:red}',
    'f1.css': '@import "f2.css";\n'.repeat(30) + 'a{b:c}', 'f2.css': '@import "f3.css";\n'.repeat(30) + 'a{b:c}',
    'f3.css': '@import "f4.css";\n'.repeat(30) + 'a{b:c}', 'f4.css': '/*' + 'y'.repeat(1000) + '*/ a{b:c}',
    // A book's ordinary nesting with big font sheets (round 8 review): nothing may be left out.
    'base.css': '@import "fonts.css"; .b{color:blue}', 'fonts.css': '@font-face{font-family:F;src:url(f1.ttf)} @font-face{font-family:G;src:url(f2.ttf)}' + '/*' + 'z'.repeat(2e6) + '*/',
    // A sheet reached first at the depth limit, then directly (round 8 review): the second use is complete.
    'd1.css': '@import "d2.css";', 'd2.css': '@import "d3.css";', 'd3.css': '@import "d4.css";', 'd4.css': '@import "dd.css";', 'dd.css': '@import "ee.css"; .d{}', 'ee.css': '.e{color:red}',
    // L-86: a pasted sheet with its own namespace.
    'ns.css': '@namespace svg url(http://www.w3.org/2000/svg); svg|rect{fill:red}', 'plain.css': 'a{color:blue}' };
  return new Function('ALLOW_REMOTE_CONTENT', 'book', 'resolve', 'readText', 'resourceURL', `${body}\nreturn { rewriteCss, cssTokens, cssRefs, cssPreprocess };`)(
    allowRemote, { zip: null }, (base, ref) => ref.split('#')[0], async (zip, p) => files[p] ?? null, async p => (p.startsWith('missing') ? null : `blob:local/${p}`));
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
  // From the round 5 review: tokenizer differences from Chromium.
  `a{x:1.url(a"b)} a{background:url(${R}/23.png)}`, `a{background:url(${R}/24.png\\`, `a{background:url(${R}/nul\0x.png)}`,
  `a{background:url("${R}/25.png"`, `a{background:url( "${R}/26.png" `,
];

// Imports whose text, pasted into the importing sheet, would join with it into a new address (or run on).
const JOINS = [`@import "tail.css";${R}/27.png)}`, `@import "tail2.css";rl(${R}/28.png)}`, `@import "tail3.css";"${R}/29.png" 1x)}`,
  `@import "open-comment.css"; b{color:red}`, `@import "open-string.css"; b{color:red}`];

test('every known form loses its remote address, in linear time (L-29, T-10)', async () => {
  const { rewriteCss, cssRefs, cssPreprocess } = cleaner();
  for (const css of LEAKS) {
    const out = await rewriteCss(css, 'x.css');
    assert.doesNotMatch(out, /evil\.test|\\68ttp|00005c/, `${JSON.stringify(css)} -> ${JSON.stringify(out)}`);
  }
  // Imported sheets don't join into new addresses, or run on into the rest (the browser reads each on its own):
  // no remote address is left as a reference in the result, read as the browser will read it.
  for (const css of JOINS) {
    const out = await rewriteCss(css, 'x.css');
    const left = cssRefs(cssPreprocess(out)).filter(r => /evil/.test(r.ref));
    assert.deepEqual(left, [], `${css} -> ${out}`);
  }
  for (const css of JOINS.slice(3)) assert.match(await rewriteCss(css, 'x.css'), /\n b\{color:red\}$/, css);
  for (const big of ['@import '.repeat(30000) + '{', '@namespace '.repeat(30000) + '{', 'a{b:url(' + 'x'.repeat(200000), '"'.repeat(100000), '/*'.repeat(50000), 'url('.repeat(50000), '\\aaaaaa'.repeat(30000), 'image-set('.repeat(30000), '@import '.repeat(30000)]) {
    const t0 = Date.now();
    await rewriteCss(big, 'x.css');
    assert.ok(Date.now() - t0 < 3000, `${big.slice(0, 12)}… took ${Date.now() - t0} ms`);
  }
});

test('everything else is left as written: strings, local files, fragments, data:, @namespace (L-21, L-29)', async () => {
  const { rewriteCss } = cleaner();
  const same = [`a{content:"see url(${R}/x.png) here"}`, `@namespace svg url(http://www.w3.org/2000/svg); svg|a{fill:url(#g)}`,
    `a{b:url(data:image/png;base64,AA)}`, `a{b:image("#x")}`, `a /* url(${R}/c.png) */ {color:red}`, `a{b:"\\"url(${R}/q.png)"}`,
    `a{background:url(ht\ttp://evil.test/bad-url.png)}`];   // (a raw tab: a bad url, which the browser never fetches)
  for (const css of same) assert.equal(await rewriteCss(css, 'x.css'), css);
  assert.equal(await rewriteCss('a{cursor:url(missing.cur), pointer}', 'x.css'), 'a{cursor:url(data:,), pointer}');
  assert.equal(await rewriteCss('@import "local.css"; x{y:url("pic (1).png")}', 'x.css'), '.l{background:url(blob:local/pic.png)}\n x{y:url(blob:local/pic%20%281%29.png)}');
  // With remote content allowed, remote addresses stay.
  assert.equal(await cleaner(true).rewriteCss(`a{b:url(${R}/x.png)}`, 'x.css'), `a{b:url(${R}/x.png)}`);
});

test('stylesheets importing themselves or each other many times stay small and fast (H-6)', async () => {
  const { rewriteCss } = cleaner();
  for (const [css, max] of [['@import "self.css";', 4000], ['@import "f1.css";', (8 << 20) + 200000]]) {
    const t0 = Date.now();
    const out = await rewriteCss(css, 'x.css');
    assert.ok(Date.now() - t0 < 3000, `${css}: ${Date.now() - t0} ms`);
    assert.ok(out.length <= max, `${css}: ${out.length} characters`);
  }
  assert.match(await rewriteCss('@import "self.css";', 'x.css'), /s\{color:red\}/, 'the sheet itself is still used, once');
  const nested = await rewriteCss('@import "base.css"; .a{}', 'x.css');
  assert.match(nested, /\.b\{color:blue\}/); assert.match(nested, /font-family:G/);
  const both = await rewriteCss('@import "d1.css"; @import "dd.css";', 'x.css');
  assert.match(both.slice(both.lastIndexOf('.d{}') - 40), /\.e\{color:red\}[\s\S]*\.d\{\}/, 'dd.css pasted directly includes ee.css');
  // @import in a style attribute means nothing: dropped, not pasted in.
  assert.equal(await rewriteCss('@import "red.css"; color: blue', 'x.css', { attr: true }), ' color: blue');
});

test("a pasted-in import keeps its conditions, and imports the browser would ignore are dropped (L-35)", async () => {
  const { rewriteCss } = cleaner();
  const t = async css => (await rewriteCss(css, 'x.css')).replace(/\s+/g, ' ').trim();
  assert.equal(await t('@import "red.css" print;'), '@media print{ x{color:rgb(255, 0, 0)} }');
  assert.equal(await t('@import url("red.css") layer(base) supports(display: grid) screen and (min-width: 10px);'),
    '@layer base{ @supports (display: grid){ @media screen and (min-width: 10px){ x{color:rgb(255, 0, 0)} } } }');
  assert.equal(await t('@import "red.css" layer;'), '@layer{ x{color:rgb(255, 0, 0)} }');
  assert.equal(await t('@import url(red.css) supports(selector(:has(a)));'), '@supports (selector(:has(a))){ x{color:rgb(255, 0, 0)} }');
  // Allowed before an import: @charset and @layer statements. After anything else, the import is ignored.
  assert.equal(await t('@charset "utf-8"; @layer a, b; @import "red.css";'), '@charset "utf-8"; @layer a, b; x{color:rgb(255, 0, 0)}');
  assert.equal(await t('a{b:c} @import "red.css";'), 'a{b:c}');
  assert.equal(await t('@namespace svg url(http://www.w3.org/2000/svg); @import "red.css";'), '@namespace svg url(http://www.w3.org/2000/svg);');
  assert.equal(await t('@media screen{} @import "red.css";'), '@media screen{}');
  // In Chromium: a print-only import doesn't apply on screen; a screen one does.
  const page = await h.newPage();
  await page.setContent('<x>x</x>');
  const color = async css => page.evaluate(t => { document.head.querySelectorAll('style').forEach(e => e.remove());
    const st = document.createElement('style'); st.textContent = t; document.head.append(st); return getComputedStyle(document.querySelector('x')).color; }, await rewriteCss(css, 'x.css'));
  assert.notEqual(await color('@import "red.css" print;'), 'rgb(255, 0, 0)');
  assert.equal(await color('@import "red.css" screen;'), 'rgb(255, 0, 0)');
  assert.notEqual(await color('a{b:c} @import "red.css";'), 'rgb(255, 0, 0)');
});

test('the cleaned CSS asks no other site for anything when the browser applies it (L-29, T-10)', async () => {
  const { rewriteCss } = cleaner();
  const page = await h.newPage();
  await page.setContent('<a>a</a><c>c</c><x class="l">x</x>');
  for (const css of [...LEAKS, ...JOINS]) {
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

test('a fragment in a CSS url is kept (L-84); a remote import after a pasted one stays, above it (L-85); a pasted sheet keeps its namespace (L-86)', async () => {
  const { rewriteCss } = cleaner(true);
  assert.equal(await rewriteCss('.x{background:url(sprite.svg#star)}', 'x.css'), '.x{background:url(blob:local/sprite.svg#star)}');
  const out = await rewriteCss('@import "plain.css"; @import "https://fonts.example/f.css"; p{color:red}', 'x.css');
  assert.match(out, /^@import "https:\/\/fonts\.example\/f\.css";/, out);
  assert.match(out, /a\{color:blue\}/); assert.match(out, /p\{color:red\}/);
  const ns = await rewriteCss('@import "plain.css"; @import "ns.css"; p{}', 'x.css');
  assert.match(ns, /^@namespace svg url\(http:\/\/www\.w3\.org\/2000\/svg\);/, ns);
  assert.match(ns, /svg\|rect\{fill:red\}/);
});
