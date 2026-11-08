// Book pages: nothing from other sites loads (by default), and links never navigate the page frame away.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.after(h.close);

test('a hostile book reaches no other site, and its own pictures still show', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  await h.openReader(page, `${h.READER}?book=books/hostile.epub`);
  await page.waitForTimeout(1500);
  assert.deepEqual(await h.remoteLog(), [], 'requests reached the other site');
  const state = await h.inFrame(page, doc => ({
    remoteImg: doc.querySelector('#remote-img').getAttribute('src'),
    local: doc.querySelector('#local-img').naturalWidth,
    data: doc.querySelector('#data-img').naturalWidth,
    autoplay: doc.querySelector('#aud').hasAttribute('autoplay'),
    poster: doc.querySelector('#vid').getAttribute('poster'),
    links: doc.body.querySelectorAll('link').length,
    ping: doc.querySelector('#ping-link').hasAttribute('ping'),
  }));
  assert.equal(state.remoteImg, null);
  assert.ok(state.local > 0, 'the picture inside the book should load');
  assert.ok(state.data > 0, 'a data: picture should load');
  assert.equal(state.autoplay, false);
  assert.equal(state.poster, null);
  assert.equal(state.links, 0);
  assert.equal(state.ping, false);
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
  const web = await h.inFrame(page, doc => [doc.querySelector('#web-link').hasAttribute('href'), doc.querySelector('#svg-in').getAttribute('data-spine-path')]);
  assert.deepEqual(web, [false, 'OEBPS/c2.xhtml']);
});
