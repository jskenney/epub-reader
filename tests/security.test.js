// Book pages: nothing from other sites loads (by default), and links never navigate the page frame away.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

for (const [where, base] of [['behind the reader policy', h.SITE], ['with no reader policy', h.PLAIN]])
for (const [label, ref] of [['from an EPUB file', 'books/hostile.epub'], ['from an extracted folder', 'books/hostile-dir/']])
test(`a hostile book reaches no other site, and its own pictures still show (${label}, ${where}) (T-14)`, async () => {
  const page = await h.newPage();
  const sameSite = [];
  page.on('request', r => { if (/missing-local|\/base\/|\/refresh/.test(r.url())) sameSite.push(r.url()); });
  await h.clearRemoteLog();
  await h.openReader(page, `${base}/reader/index.html?book=${ref}`);
  // Wait for every picture in the page to finish (or fail), then a little longer than the page's meta refresh.
  await page.waitForFunction(() => [...document.querySelector('#page').contentDocument.images].every(i => i.complete), null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  assert.deepEqual(await h.remoteLog(), [], 'requests reached the other site');
  assert.deepEqual(page.blocked, [], 'requests went to a blocked site');
  // (A book opened from a folder can only find out a file is missing by asking its own folder for it.)
  const outside = sameSite.filter(u => !(ref.endsWith('/') && u.startsWith(`${base}/reader/${ref}`)));
  assert.deepEqual(outside, [], 'requests went to this site outside the book');
  const state = await h.inFrame(page, doc => ({
    remoteImg: doc.querySelector('#remote-img').getAttribute('src'),
    local: doc.querySelector('#local-img').naturalWidth,
    data: doc.querySelector('#data-img').naturalWidth,
    autoplay: doc.querySelector('#aud').hasAttribute('autoplay'),
    poster: doc.querySelector('#vid').getAttribute('poster'),
    links: doc.body.querySelectorAll('link').length,
    ping: doc.querySelector('#ping-link').hasAttribute('ping'),
    bypassSrcs: [...doc.querySelectorAll('img.bypass')].map(i => i.getAttribute('src')).filter(Boolean),
    iframes: doc.querySelectorAll('iframe').length,
    base: doc.querySelectorAll('base').length,
    refresh: doc.querySelectorAll('meta[http-equiv="refresh" i]').length,
    animations: doc.querySelectorAll('set').length,
    policy: doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
    where: doc.defaultView.location.href,
    still: /Hostile/.test(doc.body.textContent),
    objectFallback: doc.querySelector('#object-fallback')?.naturalWidth || 0, objects: doc.querySelectorAll('object').length,
    tableBg: doc.querySelector('#bg-table')?.getAttribute('background') || '', use: doc.querySelector('#sprite-use')?.getAttribute('href') || '',
    paint: doc.querySelector('#paint')?.getAttribute('fill') || '',
    injected: doc.querySelectorAll('#injected').length, afterStyle: !!doc.querySelector('#after-style'),
    shadow: [!!doc.querySelector('#shadow-host')?.shadowRoot, doc.querySelectorAll('template').length],
    strUrl: doc.defaultView.getComputedStyle(doc.querySelector('#str-url'), '::before').content,
    cursors: [...doc.querySelectorAll('#cursor-missing, .cursor-remote')].map(e => doc.defaultView.getComputedStyle(e).cursor),
  }));
  assert.equal(state.remoteImg, null);
  assert.ok(state.local > 0, 'the picture inside the book should load');
  assert.ok(state.data > 0, 'a data: picture should load');
  assert.equal(state.autoplay, false);
  assert.equal(state.poster, null);
  assert.equal(state.links, 0);
  assert.equal(state.ping, false);
  assert.deepEqual(state.bypassSrcs.filter(u => !(ref.endsWith('/') && u.startsWith(`${base}/reader/${ref}`))), [],
    'protocol-relative, tab-in-scheme, upper-case and missing pictures are removed');
  assert.deepEqual([state.iframes, state.base, state.refresh, state.animations], [0, 0, 0, 0], 'upper-case IFRAME, BASE, META and SVG set are removed');
  assert.ok(ref.endsWith('/') ? state.policy.startsWith(`default-src 'none'; img-src data: blob: ${base}/reader/books/hostile-dir/`) : /^default-src 'none'; img-src data: blob:;/.test(state.policy), state.policy);
  assert.deepEqual([state.where, state.still], ['about:srcdoc', true], 'the page is still the book');
  // A missing or remote cursor image falls back to the next cursor, rather than dropping the declaration (L-21).
  assert.deepEqual(state.cursors.map(c => c.replace(/^url\("[^"]*"\), /, '')), ['pointer', 'pointer', 'pointer']);
  // L-40: an <object> gives way to its fallback; background attributes and <use> sprites are localized; remote
  // paint is removed.
  assert.ok(state.objectFallback > 0 && state.objects === 0, 'the object fallback picture shows');
  assert.match(state.tableBg, ref.endsWith('/') ? /hostile-dir\/OEBPS\/pic\.png$/ : /^blob:/);
  assert.match(state.use, ref.endsWith('/') ? /pic\.png#frag$/ : /^blob:.*#frag$/);
  assert.doesNotMatch(state.paint, /localhost:8792|paint\.svg/);
  assert.deepEqual([state.injected, state.afterStyle], [0, true], "an imported sheet can't close a body <style> and add markup (M-13)");
  assert.deepEqual(state.shadow, [false, 0], 'declarative shadow DOM is removed with its template (H-7)');
  assert.match(state.strUrl, /^"see url\([^"]*\) "$/, 'a url( inside a string must not end the string');
  // The cleaning leaves nothing for the policies to refuse, so the console stays quiet (L-19).
  assert.deepEqual(page.cspViolations, []);
});

test('an HTML page: base and meta refresh are removed before parsing, whatever their quoting; the text stays (L-24, T-9)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, `${h.READER}?book=books/controls.html`);
  await page.waitForTimeout(1500);   // longer than the refresh
  const state = await h.inFrame(page, doc => ({ text: doc.body.textContent, custom: doc.querySelectorAll('base-card').length,
    base: doc.querySelectorAll('base').length, refresh: doc.querySelectorAll('meta[http-equiv="refresh" i]').length, where: doc.defaultView.location.href }));
  assert.match(state.text, /once froze the page/);
  assert.match(state.text, /Custom element kept\.[\s\S]*Don't stop here\./);
  assert.deepEqual([state.custom, state.base, state.refresh, state.where], [1, 0, 0, 'about:srcdoc']);
  // L-38: a control character before a web address doesn't make it an in-book link; L-39: "#100%" didn't stop
  // the document opening (it opened).
  const links = await h.inFrame(page, doc => { const a = doc.querySelector('#c0-link'); return { target: a.getAttribute('target'), inBook: a.hasAttribute('data-spine-path') }; });
  assert.deepEqual(links, { target: '_blank', inBook: false });
  assert.deepEqual(await h.remoteLog(), []);
  assert.deepEqual(page.cspViolations, [], 'nothing left for the policies to refuse');
});

test('a stylesheet importing itself many times, linked many times, opens quickly and still applies (H-6)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/css-fanout.epub`);
  assert.ok(Date.now() - t0 < 15000, `opened in ${Date.now() - t0} ms`);
  const r = await h.inFrame(page, doc => ({ color: doc.defaultView.getComputedStyle(doc.querySelector('.f')).color, size: doc.documentElement.outerHTML.length }));
  assert.equal(r.color, 'rgb(1, 2, 3)');
  assert.ok(r.size < 6e6, `page of ${r.size} characters`);
});

test('middle-clicking an in-book link opens nothing, and its address only names a place in the page (L-38)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/hostile.epub`);
  const href = await h.inFrame(page, doc => doc.querySelector('#ping-link').getAttribute('href'));
  assert.match(href, /^#/);
  let opened = 0;
  page.context().on('page', () => opened++);
  const box = await page.evaluate(() => { const f = document.querySelector('#page').getBoundingClientRect(), r = document.querySelector('#page').contentDocument.querySelector('#ping-link').getBoundingClientRect(); return { x: f.left + r.left + 3, y: f.top + r.top + 3 }; });
  await page.mouse.click(box.x, box.y, { button: 'middle' });
  await page.waitForTimeout(800);
  assert.equal(opened, 0);
  assert.match(await page.textContent('#spinePos'), /spine 1\//, 'and the reader stays where it is');
});

test('markup that reads back differently once serialized brings nothing uncleaned into the page (round 8 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/mutation.epub`);
  const r = await h.inFrame(page, doc => ({ shadow: !!doc.querySelector('#mx-host')?.shadowRoot, link: !!doc.querySelector('#mx-link'),
    templates: doc.querySelectorAll('template').length, text: doc.body?.textContent || '' }));
  const note = await h.notice(page);
  // Either cleaned (no shadow root, no template, no link) or refused with a note: never the live link.
  assert.equal(r.shadow, false); assert.equal(r.templates, 0);
  assert.ok(!r.link || /can't be shown safely/.test(note), JSON.stringify(r) + ' ' + note);
});

test('a big font named in hundreds of styles keeps the page small (round 8 review)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/font-bomb.epub`);
  assert.ok(Date.now() - t0 < 15000, `opened in ${Date.now() - t0} ms`);
  const r = await h.inFrame(page, doc => ({ size: doc.documentElement.outerHTML.length, text: /Text\./.test(doc.body?.textContent || '') }));
  assert.equal(await h.notice(page), '');
  assert.ok(r.text, 'the chapter shows');
  assert.ok(r.size < 2e6, `page of ${r.size} characters`);
});

test('links of every kind: in-book links open chapters, web links open a new tab, the frame never navigates', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/hostile.epub`);
  const marks = await h.inFrame(page, doc => ['#web-link', '#svg-in', '#svg-out', '#area-in', '#area-out'].map(s => {
    const a = doc.querySelector(s);
    return [s, a.getAttribute('data-spine-path') || '', a.getAttribute('target') || ''];
  }));
  assert.deepEqual(marks, [['#web-link', '', '_blank'], ['#svg-in', 'OEBPS/c2.xhtml', ''], ['#svg-out', '', '_blank'],
    ['#area-in', 'OEBPS/c2.xhtml', ''], ['#area-out', '', '_blank']]);
  // Clicking the SVG link inside the book opens the target chapter, in the reader.
  await page.frameLocator('#page').locator('#svg-in rect').click();
  await page.waitForFunction(() => /Target chapter/.test(document.querySelector('#page').contentDocument?.body?.textContent || ''));
  assert.equal(await page.evaluate(() => document.querySelector('#page').contentWindow.location.href), 'about:srcdoc');
});

test('ALLOW_REMOTE_CONTENT and ALLOW_EXTERNAL_LINKS from a folder config', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  // folder-remote/ has a config allowing remote content and turning web links into plain text.
  await h.openReader(page, `${h.SITE}/folder-remote/index.html?book=/reader/books/hostile.epub`);
  await page.waitForTimeout(1500);
  const log = await h.remoteLog();
  assert.ok(log.includes('/pixel.png'), `remote image should load when allowed (saw ${log})`);
  const web = await h.inFrame(page, doc => [doc.querySelector('#web-link').hasAttribute('href'), doc.querySelector('#svg-in').getAttribute('data-spine-path'),
    !!doc.querySelector('meta[http-equiv="Content-Security-Policy"]')]);
  assert.deepEqual(web, [false, 'OEBPS/c2.xhtml', false], 'no security policy when remote content is allowed');
});

test('href on MathML elements is removed: Firefox would follow it (L-138)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/math-links.epub`);
  assert.deepEqual(await h.inFrame(page, doc => ['m', 'mi'].map(id => doc.getElementById(id)?.getAttribute('href'))), [null, null]);
});

// Round 25 review.
for (const [label, base, book] of [['an EPUB', h.SITE, 'svgext.epub'], ['a folder book', h.SITE, 'svgext/'], ['an EPUB, with no reader policy', h.PLAIN, 'svgext.epub']]) {
  test(`an SVG file used as a resource document is cleaned: nothing reaches another site, nothing for the policy to refuse, nothing runs (${label}; round 25 review, L-287)`, async () => {
    const page = await h.newPage();
    await h.clearRemoteLog();
    await h.openReader(page, `${base}/reader/index.html?book=books/${book}`);
    await page.waitForTimeout(1500);
    assert.deepEqual(await h.remoteLog(), []);
    assert.deepEqual(page.cspViolations, [], 'the cleaning leaves nothing for the policy to refuse');
    assert.equal(await page.evaluate(() => window.__svg), undefined);
    // The sprite's own shapes still show.
    assert.equal(await h.inFrame(page, doc => doc.querySelectorAll('use').length), 2);
  });
}

test('names and ids that would hide the page\'s own methods are dropped, and the chapter shows (round 25 review, L-288)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/clobber.epub`);
  assert.equal(await h.notice(page), '');
  const s = await h.inFrame(page, doc => ({ text: doc.body.innerText.includes('Some text here'), names: [...doc.querySelectorAll('[name]')].map(e => e.getAttribute('name')), ids: [...doc.querySelectorAll('p[id]')].map(e => e.id) }));
  assert.equal(s.text, true);
  assert.deepEqual(s.names, []);
  assert.ok(s.ids.includes('content') && !s.ids.includes('addEventListener'), JSON.stringify(s.ids));
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /spine 2\/2/.test(document.querySelector('#spinePos').textContent));
  assert.equal(await h.notice(page), '');
});

test('a cleaned SVG keeps its text in its own encoding, and loses its stylesheet instruction and href animations (round 25 review, L-291, L-292)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, `${h.READER}?book=books/svgenc.epub`);
  const svg = await h.inFrame(page, async doc => { const u = doc.querySelector('use').getAttribute('href').split('#')[0]; return (await fetch(u)).text(); });
  assert.match(svg, /Café/);
  assert.doesNotMatch(svg, /<\?xml/);
  assert.doesNotMatch(svg, /svgset|svganim|svgpi/);
  await page.waitForTimeout(500);
  assert.deepEqual(await h.remoteLog(), []);
});

// Round 25 review, loop 3.
test('a book\'s picture declared as HTML gets a blob of plain bytes, which can\'t run as a page; the picture still shows (round 25 review, H-30)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/typed-pic.epub`);
  const r = await h.inFrame(page, async doc => { const img = doc.querySelector('img'); await img.decode().catch(() => {}); const res = await fetch(img.src); return { src: img.src, type: res.headers.get('content-type'), w: img.naturalWidth }; });
  assert.match(r.src, /^blob:/);
  assert.equal(r.type, 'application/octet-stream');
  assert.ok(r.w > 0, 'the picture shows');
  await page.goto(r.src).catch(() => {});
  await page.waitForTimeout(300);
  assert.notEqual(await page.title(), 'PWNED');
});

test('nested attr( in a book\'s CSS doesn\'t hang the page (round 25 review, M-129)', async () => {
  const page = await h.newPage();
  const t0 = Date.now();
  await h.openReader(page, `${h.READER}?book=books/attr-nest.epub`);
  assert.ok(Date.now() - t0 < 6000, `opened in ${Date.now() - t0} ms`);
  assert.match(await h.inFrame(page, doc => doc.body.innerText), /Still here/);
});

test('with remote content on, an animation setting a link\'s address is taken out, and a link without one keeps no target (round 25 review, L-303)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, `${h.SITE}/folder-remote/index.html?book=/reader/books/set-href.epub`);
  assert.deepEqual(await h.inFrame(page, doc => [doc.querySelectorAll('set').length, doc.querySelector('svg a').getAttribute('target')]), [0, null]);
  await page.frameLocator('#page').locator('svg text').click();
  await page.waitForTimeout(800);
  assert.deepEqual((await h.remoteLog()).filter(r => /sneaky/.test(r.path || r)), []);
});

test('an archive whose files share their data isn\'t read (round 25 review, L-304)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/overlap.epub`);
  assert.match(await h.notice(page), /its files overlap/);
});

test('book files opened on their own are sent sandboxed; the reader page isn\'t (round 25 review, M-130)', async () => {
  for (const [path, policy] of [['/reader/books/after.html', 'sandbox'], ['/reader/books/doc.xhtml', 'sandbox'], ['/reader/index.html', null], ['/folder-cfg/index.html', null], ['/reader/books/notes.md', null]]) {
    const r = await fetch(h.SITE + path);
    const got = r.headers.get('content-security-policy');
    if (policy) assert.equal(got, policy, path); else assert.notEqual(got, 'sandbox', path);
  }
  const conf = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'nginx.conf.example'), 'utf8');
  assert.equal((conf.match(/^\s*location ~\*[^\n]*\.\(x\?html\?\|xht\|xml\|svg\)\$[^\n]*$/gm) || []).length, 2, 'both locations in the nginx example');
  assert.match(conf, /add_header Content-Security-Policy "sandbox" always;/);
});

// Round 25 review, loop 4.
test('a page of XHTML typed as SVG isn\'t served at all; an SVG typed with a parameter still shows (round 25 review, H-31, L-317)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/svg-typed.epub`);
  const r = await h.inFrame(page, async doc => {
    const fake = doc.getElementById('fake'), real = doc.getElementById('real');
    await real.decode().catch(() => {});
    const src = fake.getAttribute('src');
    return { fake: src && src.startsWith('blob:') ? await (await fetch(src)).text() : src, real: real.naturalWidth };
  });
  assert.ok(!r.fake || !/javascript|<form/i.test(r.fake), `the fake picture: ${r.fake}`);
  assert.ok(r.real > 0, 'the real SVG shows');
});

test('book files the nginx example sandboxes, a book\'s own index.html and encoded names too; not the reader page (round 25 review, M-131, T-48)', async () => {
  for (const name of ['index.html', 'page.shtml', 'feed.rss', 'pic.svgz', 'style.xsl']) {
    const r = await fetch(`${h.SITE}/reader/books/sandboxed/${name}`);
    assert.equal(r.headers.get('content-security-policy'), 'sandbox', name);
  }
  assert.equal((await fetch(`${h.SITE}/reader/books/after.ht%6Dl`)).headers.get('content-security-policy'), 'sandbox');
  assert.notEqual((await fetch(`${h.SITE}/reader/index.html`)).headers.get('content-security-policy'), 'sandbox');
  assert.notEqual((await fetch(`${h.SITE}/reader/`)).headers.get('content-security-policy'), 'sandbox');
  const conf = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'nginx.conf.example'), 'utf8');
  assert.match(conf, /location = \/reader\/index\.html \{ \}/);
});
