// Book pages: nothing from other sites loads (by default), and links never navigate the page frame away.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

for (const [label, ref] of [['from an EPUB file', 'books/hostile.epub'], ['from an extracted folder', 'books/hostile-dir/']])
test(`a hostile book reaches no other site, and its own pictures still show (${label})`, async () => {
  const page = await h.newPage();
  const sameSite = [];
  page.on('request', r => { if (/missing-local|\/base\/|\/refresh/.test(r.url())) sameSite.push(r.url()); });
  await h.clearRemoteLog();
  await h.openReader(page, `${h.READER}?book=${ref}`);
  // Wait for every picture in the page to finish (or fail), then a little longer than the page's meta refresh.
  await page.waitForFunction(() => [...document.querySelector('#page').contentDocument.images].every(i => i.complete), null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  assert.deepEqual(await h.remoteLog(), [], 'requests reached the other site');
  assert.deepEqual(page.blocked, [], 'requests went to a blocked site');
  // (A book opened from a folder can only find out a file is missing by asking its own folder for it.)
  const outside = sameSite.filter(u => !(ref.endsWith('/') && u.startsWith(`${h.SITE}/reader/${ref}`)));
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
  assert.deepEqual(state.bypassSrcs.filter(u => !(ref.endsWith('/') && u.startsWith(`${h.SITE}/reader/${ref}`))), [],
    'protocol-relative, tab-in-scheme, upper-case and missing pictures are removed');
  assert.deepEqual([state.iframes, state.base, state.refresh, state.animations], [0, 0, 0, 0], 'upper-case IFRAME, BASE, META and SVG set are removed');
  assert.match(state.policy, ref.endsWith('/') ? /^default-src 'none'; img-src data: blob: http:\/\/localhost:8790\/reader\/books\/hostile-dir\// : /^default-src 'none'; img-src data: blob:;/);
  assert.deepEqual([state.where, state.still], ['about:srcdoc', true], 'the page is still the book');
  // A missing or remote cursor image falls back to the next cursor, rather than dropping the declaration (L-21).
  assert.deepEqual(state.cursors.map(c => c.replace(/^url\("[^"]*"\), /, '')), ['pointer', 'pointer', 'pointer']);
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
