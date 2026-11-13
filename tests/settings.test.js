// The settings dialog (REVIEW.md E-11) and the sepia and black themes (E-5).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

test.afterEach(h.closePages);
test.after(h.close);

const LONG = `${h.READER}?book=books/long.epub`;
const theme = page => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const pageBg = page => page.evaluate(() => { const d = document.querySelector('#page').contentDocument; return getComputedStyle(d.documentElement).backgroundColor; });
const stored = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
async function openSettings(page) {
  await page.click('#setBtn');
  await page.waitForFunction(() => document.querySelector('#setDialog').open);
}
const row = (page, name) => page.locator(`[data-set="${name}"]`);
const changedNote = (page, name) => page.evaluate(n => document.querySelector(`[data-set="${n}"]`).closest('.set-row').querySelector('.set-def').textContent, name);

test('the settings button sits between the text width and Open, and opens a modal dialog the reader keys wait for', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  const order = await page.evaluate(() => [...document.querySelector('.tools').children].map(e => e.id || e.getAttribute('aria-label')));
  const at = order.indexOf('setBtn');
  assert.equal(order[at - 1], 'widthGroup'); assert.equal(order[at + 1], 'editPick');
  await openSettings(page);
  assert.equal(await page.evaluate(() => document.querySelector('#setDialog').matches(':modal')), true);
  const before = await theme(page);
  await page.keyboard.press('t');   // (the theme key: not while the dialog is open)
  assert.equal(await theme(page), before);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.querySelector('#setDialog').open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'setBtn');
  // On a phone the button is still there (the width buttons aren't).
  await page.setViewportSize({ width: 380, height: 760 });
  assert.equal(await page.isVisible('#setBtn'), true);
});

test('themes: sepia and black colour the page; T switches between the light and dark ones last chosen; System follows the device (E-5)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await openSettings(page);
  await page.click('.set-theme:has(input[value="sepia"])');
  assert.equal(await theme(page), 'sepia');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#page').contentDocument.documentElement).backgroundColor === 'rgb(248, 241, 225)');
  await page.click('.set-theme:has(input[value="black"])');
  assert.equal(await theme(page), 'black');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#page').contentDocument.documentElement).backgroundColor === 'rgb(0, 0, 0)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)');
  await page.click('#setClose');
  await page.keyboard.press('t'); assert.equal(await theme(page), 'sepia');
  await page.keyboard.press('t'); assert.equal(await theme(page), 'black');
  await page.click('#themeBtn'); assert.equal(await theme(page), 'sepia');
  // Kept after a reload.
  await page.reload(); await h.waitForBook(page);
  assert.equal(await theme(page), 'sepia');
  assert.equal(await pageBg(page), 'rgb(248, 241, 225)');
  // System: no theme of its own, and it stays that way (not replaced by a folder's default).
  await openSettings(page);
  assert.equal(await page.isChecked('input[name="theme"][value="sepia"]'), true);
  await page.click('.set-theme:has(input[value="system"])');
  assert.equal(await theme(page), null);
  assert.equal(await stored(page, 'spine:theme'), '"system"');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#page').contentDocument.documentElement).backgroundColor === 'rgb(23, 26, 25)');
});

test('reader options: changed here, marked against the site default, kept, and restored (E-11)', async () => {
  const page = await h.newPage();
  // folder-listen's config turns the sleep timer and the time left on.
  await h.openReader(page, `${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`);
  await page.waitForFunction(() => document.querySelector('#timeLeft').textContent.trim());
  await openSettings(page);
  assert.equal(await row(page, 'TIME_LEFT').isChecked(), true);
  assert.equal(await changedNote(page, 'TIME_LEFT'), '');
  await row(page, 'TIME_LEFT').uncheck();
  assert.equal(await page.textContent('#timeLeft'), '');
  assert.equal(await changedNote(page, 'TIME_LEFT'), "Changed: this site's default is on.");
  assert.equal(await stored(page, 'spine:set:TIME_LEFT'), 'false');
  // Numbers go through the same limits as reader-config.json: comic sections are an even number of pages.
  await row(page, 'COMIC_PART').fill('7'); await row(page, 'COMIC_PART').press('Tab');
  assert.equal(await row(page, 'COMIC_PART').inputValue(), '8');
  await row(page, 'SEARCH_MAX').fill('3');
  await page.keyboard.press('Escape');   // (what was typed is kept)
  assert.equal(await stored(page, 'spine:set:SEARCH_MAX'), '3');
  await page.fill('#searchBox', 'paragraph'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#searchResults'), /Showing the first 3 matches/);
  // Kept after a reload; set back to this folder's value, it is still the reader's (for every folder).
  await page.reload(); await h.waitForBook(page);
  await openSettings(page);
  assert.equal(await row(page, 'TIME_LEFT').isChecked(), false);
  await row(page, 'TIME_LEFT').check();
  assert.equal(await stored(page, 'spine:set:TIME_LEFT'), 'true');
  assert.equal(await changedNote(page, 'TIME_LEFT'), '');
  // Restore defaults: everything back to the site's.
  await row(page, 'SLEEP_TIMER').uncheck();
  assert.equal(await page.isHidden('#ttsSleep'), true);
  await page.click('.set-theme:has(input[value="dark"])');
  await page.click('#setReset');
  assert.equal(await row(page, 'SEARCH_MAX').inputValue(), '500');
  assert.equal(await row(page, 'SLEEP_TIMER').isChecked(), true);
  assert.equal(await theme(page), null);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => /^spine:(set:|theme)/.test(k))), []);
});

test('web links follow the setting at once; remote content and voice precision wait for a reload (E-11)', async () => {
  const page = await h.newPage();
  await h.clearRemoteLog();
  // (On the plain server: the site policy from nginx.conf.example blocks other sites whatever the reader chooses.)
  await h.openReader(page, `${h.PLAIN}/reader/index.html?book=books/hostile.epub`);
  const link = () => h.inFrame(page, doc => [doc.querySelector('#web-link').hasAttribute('href'), doc.querySelector('#web-link').getAttribute('target')]);
  assert.deepEqual(await link(), [true, '_blank']);
  await openSettings(page);
  await row(page, 'ALLOW_EXTERNAL_LINKS').uncheck();
  await page.waitForFunction(() => !document.querySelector('#page').contentDocument.querySelector('#web-link')?.hasAttribute('href'));
  assert.equal(await page.isHidden('#setReload'), true);
  await row(page, 'FULL_PRECISION').uncheck();
  await row(page, 'ALLOW_REMOTE_CONTENT').check();
  assert.equal(await page.isVisible('#setReload'), true);
  await page.waitForTimeout(800);
  assert.ok(!(await h.remoteLog()).includes('/pixel.png'), 'not used before the reload');
  await page.click('#setReload'); await h.waitForBook(page); await page.waitForTimeout(1500);
  await openSettings(page);
  assert.equal(await page.isHidden('#setReload'), true);
  assert.equal(await row(page, 'FULL_PRECISION').isChecked(), false);
  assert.equal(await row(page, 'ALLOW_REMOTE_CONTENT').isChecked(), true);
  assert.ok((await h.remoteLog()).includes('/pixel.png'), 'the book\'s remote picture was asked for after the reload');
});

test('a stored value of the wrong kind is dropped; a stored black theme is used and shown', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:set:SEARCH_MAX': 'lots', 'spine:theme': 'black' });
  assert.equal(await stored(page, 'spine:set:SEARCH_MAX'), null);
  assert.equal(await theme(page), 'black');
  await openSettings(page);
  assert.equal(await row(page, 'SEARCH_MAX').inputValue(), '500');
  assert.equal(await page.isChecked('input[name="theme"][value="black"]'), true);
});

test('a time to keep positions chosen in Settings is used as it is, not the longest any folder asked for (E-11)', async () => {
  const page = await h.newPage();
  const old = { i: 0, f: 0, t: Date.now() - 3 * 86400000 };
  await h.openReader(page, LONG, { 'spine:keepDays': 3650, 'spine:pos:url:/old.epub': old });
  assert.notEqual(await stored(page, 'spine:pos:url:/old.epub'), null, 'kept: the site keeps positions for years');
  await openSettings(page);
  await row(page, 'KEEP_POSITIONS_DAYS').fill('1'); await row(page, 'KEEP_POSITIONS_DAYS').press('Tab');
  await page.evaluate(() => localStorage.setItem('spine:posSweep', '0'));   // (the sweep runs at most once a day)
  await page.reload(); await h.waitForBook(page);
  assert.equal(await stored(page, 'spine:pos:url:/old.epub'), null);
  assert.equal(await stored(page, 'spine:keepDays'), '3650', 'the site-wide value is left as it was');
});

test('a reload-only setting can be turned back, and Restore defaults shows what the next load will use (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:set:FULL_PRECISION': false, 'spine:set:ALLOW_REMOTE_CONTENT': true });
  await openSettings(page);
  assert.equal(await row(page, 'FULL_PRECISION').isChecked(), false);
  assert.equal(await page.isHidden('#setReload'), true, 'in use since the page loaded');
  await row(page, 'FULL_PRECISION').check();
  assert.equal(await row(page, 'FULL_PRECISION').isChecked(), true);
  assert.equal(await changedNote(page, 'FULL_PRECISION'), '');
  assert.equal(await stored(page, 'spine:set:FULL_PRECISION'), 'true');
  assert.equal(await page.isVisible('#setReload'), true);
  assert.match(await page.textContent('#setStatus'), /Reload now/);
  await page.click('#setReset');
  assert.equal(await row(page, 'ALLOW_REMOTE_CONTENT').isChecked(), false);
  assert.equal(await changedNote(page, 'ALLOW_REMOTE_CONTENT'), '');
  assert.equal(await page.isVisible('#setReload'), true);
});

test('the page isn\'t shown again for a setting that didn\'t change, or while reading aloud (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:ttsEngine': 'server' });
  const mark = () => page.evaluate(() => { document.querySelector('#page').contentDocument.documentElement.dataset.mark = '1'; });
  const same = () => page.evaluate(() => document.querySelector('#page').contentDocument.documentElement.dataset.mark === '1');
  await mark();
  await openSettings(page);
  await page.click('#setReset');   // (nothing to change)
  await page.waitForTimeout(500);
  assert.equal(await same(), true, 'Restore defaults with nothing changed');
  await page.click('#setClose');
  await page.click('#ttsBtn'); await page.waitForTimeout(500);
  await openSettings(page);
  await row(page, 'ALLOW_EXTERNAL_LINKS').uncheck();
  await page.waitForTimeout(500);
  assert.equal(await same(), true, 'while reading aloud');
  assert.equal(await stored(page, 'spine:set:ALLOW_EXTERNAL_LINKS'), 'false');
});

test('a comic opens at the same page after its section size changes (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/comic.cbz`);
  const firstAlt = () => page.evaluate(() => document.querySelector('#page').contentDocument?.querySelector('.cbz-page img')?.alt);
  await page.click('#tocList a >> nth=2');
  await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('.cbz-page img')?.alt === 'Page 81');
  await page.waitForTimeout(800);
  await openSettings(page);
  await row(page, 'COMIC_PART').fill('10'); await row(page, 'COMIC_PART').press('Tab');
  await page.click('#setClose');
  await page.reload(); await h.waitForBook(page);
  assert.equal(await page.evaluate(() => document.querySelectorAll('#tocList a').length), 9);
  assert.equal(await firstAlt(), 'Page 81');
});

test('days to keep positions: kept even when the same as the folder\'s, and whole days only (round 20 review)', async () => {
  const page = await h.newPage();
  const old = { i: 0, f: 0, t: Date.now() - 1000 * 86400000 };
  await h.openReader(page, LONG, { 'spine:keepDays': 0, 'spine:pos:url:/old.epub': old });
  await openSettings(page);
  for (const v of ['700', '730']) { await row(page, 'KEEP_POSITIONS_DAYS').fill(v); await row(page, 'KEEP_POSITIONS_DAYS').press('Tab'); }   // (730 is this folder's)
  assert.equal(await stored(page, 'spine:set:KEEP_POSITIONS_DAYS'), '730');
  await page.evaluate(() => localStorage.setItem('spine:posSweep', '0'));
  await page.reload(); await h.waitForBook(page);
  assert.equal(await stored(page, 'spine:pos:url:/old.epub'), null, 'the reader\'s 730 days, not another folder\'s "keep forever"');
  await openSettings(page);
  await row(page, 'KEEP_POSITIONS_DAYS').fill('0.001'); await row(page, 'KEEP_POSITIONS_DAYS').press('Tab');
  assert.equal(await stored(page, 'spine:set:KEEP_POSITIONS_DAYS'), '1');   // (whole days; under one is one, not "keep forever")
  assert.equal(await row(page, 'KEEP_POSITIONS_DAYS').inputValue(), '1');
});

test('T and the theme button: a folder\'s default theme is the fallback, and the button names where it goes (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-sepia/index.html?book=/reader/books/long.epub`);
  assert.equal(await theme(page), 'sepia');
  assert.equal(await page.getAttribute('#themeBtn', 'aria-label'), 'Switch to dark mode');
  await page.keyboard.press('t'); assert.equal(await theme(page), 'dark');
  assert.equal(await page.getAttribute('#themeBtn', 'aria-label'), 'Switch to Sepia');
  await page.keyboard.press('t'); assert.equal(await theme(page), 'sepia');
});

test('the dialog: focus on the chosen theme, short names with notes as descriptions; the stored theme is there before the page draws (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG, { 'spine:theme': 'black' });
  await openSettings(page);
  assert.deepEqual(await page.evaluate(() => [document.activeElement.name, document.activeElement.value]), ['theme', 'black']);
  assert.equal(await page.getByRole('checkbox', { name: 'Full-precision voice models', exact: true }).count(), 1);
  assert.match(await page.evaluate(() => { const i = document.querySelector('[data-set="FULL_PRECISION"]'); return i.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id).textContent).join(' '); }), /Larger downloads/);
  await page.keyboard.press('Escape');
  // Clicking anywhere on an on/off row toggles it, notes included.
  await openSettings(page);
  await page.click('.set-row:has([data-set="shortcuts"]) small >> nth=0');
  assert.equal(await row(page, 'shortcuts').isChecked(), false);
  await page.click('.set-row:has([data-set="shortcuts"]) label');
  assert.equal(await row(page, 'shortcuts').isChecked(), true);
  await page.keyboard.press('Escape');
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__early = document.documentElement.getAttribute('data-theme'); }));
  await page.reload(); await h.waitForBook(page);
  assert.equal(await page.evaluate(() => window.__early), 'black');
});

const firstShown = page => page.evaluate(() => {   // the first comic page on screen
  const d = document.querySelector('#page').contentDocument, w = document.querySelector('#page').contentWindow;
  const scroll = getComputedStyle(d.documentElement).overflow === 'auto';
  return [...d.querySelectorAll('.cbz-page img')].find(i => { const r = i.parentElement.getBoundingClientRect(); return scroll ? r.bottom > 40 : r.right > 1 && r.left < w.innerWidth - 1; })?.alt;
});
test('a comic reopens at the page left, at the end of a section and after the section size grows, in every layout (round 20 review)', async () => {
  for (const layout of ['one', 'two', 'scroll']) {
    const page = await h.newPage();
    await h.openReader(page, `${h.READER}?book=books/comic.cbz`, { 'spine:layout': layout, 'spine:set:COMIC_PART': 10 });
    // The last page of the first section (pages 1-10).
    await page.click('#tocList a >> nth=1');
    await page.waitForFunction(() => document.querySelector('#page').contentDocument?.querySelector('.cbz-page img')?.alt === 'Page 11');
    await page.waitForTimeout(400);
    await page.keyboard.press(layout === 'scroll' ? 'PageUp' : 'ArrowLeft');
    await page.waitForTimeout(800);
    const left = await firstShown(page);
    assert.ok(/^Page ([1-9]|10)$/.test(left), `${layout}: ${left}`);
    await page.reload(); await h.waitForBook(page);
    assert.equal(await firstShown(page), left, `${layout}: the same page after a reload`);
    // Sections of 40: still the same page.
    await page.evaluate(() => localStorage.setItem('spine:set:COMIC_PART', '40'));
    await page.reload(); await h.waitForBook(page);
    assert.equal(await firstShown(page), left, `${layout}: the same page with sections of 40`);
  }
});

test('a setting is kept when another folder\'s default happens to equal it; Escape in an untouched field saves nothing (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await openSettings(page);
  await row(page, 'TIME_LEFT').check();
  await page.keyboard.press('Escape');
  await page.goto(`${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`); await h.waitForBook(page);   // (TIME_LEFT on there)
  assert.equal(await stored(page, 'spine:set:TIME_LEFT'), 'true');
  await page.goto(LONG); await h.waitForBook(page);
  await openSettings(page);
  assert.equal(await row(page, 'TIME_LEFT').isChecked(), true);
  await row(page, 'KEEP_POSITIONS_DAYS').focus();
  await page.keyboard.press('Escape');
  assert.equal(await stored(page, 'spine:set:KEEP_POSITIONS_DAYS'), null);
});

test('a stored shortcuts value that isn\'t on or off doesn\'t stop the folder\'s default (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-keys/index.html?book=/reader/books/long.epub`, { 'spine:shortcuts': 'no' });
  const before = await theme(page);
  await page.keyboard.press('t');
  assert.equal(await theme(page), before, 'the folder turns single-letter shortcuts off');
  await openSettings(page);
  assert.equal(await row(page, 'shortcuts').isChecked(), false);
});

test('a reader\'s choice set back to a folder\'s default is still theirs in every folder (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await openSettings(page);
  await row(page, 'TIME_LEFT').check();
  await page.keyboard.press('Escape');
  await page.goto(`${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`); await h.waitForBook(page);   // (TIME_LEFT on there)
  await openSettings(page);
  await row(page, 'TIME_LEFT').uncheck(); await row(page, 'TIME_LEFT').check();
  await page.keyboard.press('Escape');
  await page.goto(LONG); await h.waitForBook(page);
  await openSettings(page);
  assert.equal(await row(page, 'TIME_LEFT').isChecked(), true);
});

test('a comic with pages taller than the screen reopens as far down the page as it was, in the scroll layout (round 20 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/tall.cbz`, { 'spine:layout': 'scroll' });
  const top = () => page.evaluate(() => document.querySelector('#page').contentDocument.scrollingElement.scrollTop);
  await page.evaluate(() => { const se = document.querySelector('#page').contentDocument.scrollingElement; se.scrollTop = se.scrollHeight * 0.3; se.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(1000);
  const was = await top();
  await page.reload(); await h.waitForBook(page);
  await page.waitForTimeout(500);
  assert.ok(Math.abs((await top()) - was) < 30, `${await top()} vs ${was}`);
});

test('final review: the button waits for the site\'s values; under a day is a day; the chosen theme card shows in forced colours; a folder\'s theme comes early; Pocket names the precision setting (round 20 review)', async () => {
  const page = await h.newPage();
  // The settings button waits for reader-config.json.
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/folder-listen/reader-config.json', async r => { await held; await r.continue(); });
  await page.goto(`${h.SITE}/folder-listen/index.html?book=/reader/books/long.epub`);
  await page.waitForSelector('#setBtn');
  assert.equal(await page.isDisabled('#setBtn'), true);
  release(); await h.waitForBook(page);
  assert.equal(await page.isDisabled('#setBtn'), false);
  await page.unroute('**/folder-listen/reader-config.json');
  // Under a day is a day, not "keep forever".
  await openSettings(page);
  await row(page, 'KEEP_POSITIONS_DAYS').fill('0.4'); await row(page, 'KEEP_POSITIONS_DAYS').press('Tab');
  assert.equal(await stored(page, 'spine:set:KEEP_POSITIONS_DAYS'), '1');
  // Forced colours: the chosen theme's card is marked.
  await page.click('.set-theme:has(input[value="sepia"])');
  await page.emulateMedia({ forcedColors: 'active' });
  const widths = await page.evaluate(() => [...document.querySelectorAll('.set-theme')].map(c => getComputedStyle(c).borderTopWidth));
  assert.deepEqual(widths, ['1px', '1px', '3px', '1px', '1px']);
  await page.emulateMedia({ forcedColors: 'none' });
  // A folder's default theme, once seen, is there before the page draws.
  const p2 = await h.newPage();
  await h.openReader(p2, `${h.SITE}/folder-sepia/index.html?book=/reader/books/long.epub`);
  await p2.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__early = document.documentElement.getAttribute('data-theme'); }));
  await p2.reload(); await h.waitForBook(p2);
  assert.equal(await p2.evaluate(() => window.__early), 'sepia');
  // Only the 8-bit Pocket model on a site without CDNs: the reader is told which setting to change.
  const p3 = await h.newPage();
  await h.openReader(p3, `${h.SITE}/folder-pocket-int8/index.html?book=/reader/books/long.epub`, { 'spine:ttsEngine': 'pocket' });
  await p3.keyboard.press('r');
  await p3.click('#ttsDownload').catch(() => {});
  await p3.waitForFunction(() => /Full-precision voice models/.test(document.querySelector('#ttsStatus').textContent), null, { timeout: 15000 });
  assert.match(await p3.textContent('#ttsStatus'), /turn "Full-precision voice models" off in Settings/);
});

test('a folder\'s LOCKED list: those options are the site\'s there, whatever the reader chose, and can\'t be changed; other folders keep the reader\'s (E-18)', async () => {
  const page = await h.newPage();
  const warnings = []; page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  const LOCKED = `${h.SITE}/folder-locked/index.html?book=/reader/books/long.epub`;
  await h.openReader(page, LOCKED, { 'spine:theme': 'black', 'spine:set:TIME_LEFT': false, 'spine:shortcuts': false, 'spine:set:ALLOW_REMOTE_CONTENT': true });
  assert.ok(warnings.some(w => /LOCKED: bogus ignored/.test(w)), warnings.join(' | '));
  assert.equal(await theme(page), 'sepia');
  await page.waitForFunction(() => document.querySelector('#timeLeft').textContent.trim());
  // Shortcuts locked on (the default): T works as a key, but the theme can't change.
  await page.keyboard.press('t');
  assert.equal(await theme(page), 'sepia');
  assert.equal(await page.isDisabled('#themeBtn'), true);
  await openSettings(page);
  assert.equal(await page.isDisabled('input[name="theme"][value="dark"]'), true);
  assert.equal(await page.isVisible('#setThemeLocked'), true);
  for (const name of ['TIME_LEFT', 'shortcuts', 'ALLOW_REMOTE_CONTENT']) {
    assert.equal(await row(page, name).isDisabled(), true, name);
    assert.equal(await changedNote(page, name), 'Set by this site.', name);
  }
  assert.equal(await row(page, 'ALLOW_REMOTE_CONTENT').isChecked(), false);
  assert.equal(await row(page, 'SEARCH_MAX').isDisabled(), false);
  await page.click('.set-row:has([data-set="TIME_LEFT"]) small >> nth=0');   // (the row doesn't toggle it either)
  assert.equal(await row(page, 'TIME_LEFT').isChecked(), true);
  await page.click('#setReset');
  // The reader's own values are kept for the folders that don't lock them.
  assert.equal(await stored(page, 'spine:theme'), '"black"');
  assert.equal(await stored(page, 'spine:set:TIME_LEFT'), 'false');
  await page.keyboard.press('Escape');
  // The locked theme is there before the page draws next time.
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__early = document.documentElement.getAttribute('data-theme'); }));
  await page.reload(); await h.waitForBook(page);
  assert.equal(await page.evaluate(() => window.__early), 'sepia');
  // Elsewhere, the reader's choices.
  await page.goto(LONG); await h.waitForBook(page);
  assert.equal(await theme(page), 'black');
  assert.equal(await page.textContent('#timeLeft'), '');
  assert.equal(await page.isDisabled('#themeBtn'), false);
});

test('the read-aloud engine list is as wide as the engine chosen, not its longest option (E-19)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await page.keyboard.press('r'); await page.waitForTimeout(300); await page.keyboard.press(' ');
  const info = await page.evaluate(() => { const e = document.querySelector('#ttsEngine'); return { value: e.value, width: e.getBoundingClientRect().width, longest: Math.max(...[...e.options].map(o => o.textContent.length)) }; });
  assert.equal(info.value, 'device');
  assert.ok(info.longest > 20, 'a long option is still in the list');
  assert.ok(info.width < 100, `width ${info.width}`);
  // Another engine: the width follows.
  await page.selectOption('#ttsEngine', 'pocket');
  const w2 = await page.evaluate(() => document.querySelector('#ttsEngine').getBoundingClientRect().width);
  assert.ok(w2 < 100 && w2 > 50, `width ${w2}`);
  // Never narrower than the text needs: as wide as a list holding only that option.
  const fits = await page.evaluate(() => {
    const e = document.querySelector('#ttsEngine'), solo = e.cloneNode(false);
    solo.removeAttribute('id'); solo.style.width = ''; solo.style.fieldSizing = '';
    solo.append(new Option(e.selectedOptions[0].textContent)); e.after(solo);
    const out = [e.getBoundingClientRect().width, solo.getBoundingClientRect().width]; solo.remove(); return out;
  });
  assert.ok(fits[0] >= fits[1] - 0.5, `${fits[0]} vs ${fits[1]}`);
});

test('a locked days-to-keep doesn\'t delete other folders\' positions; a locked shortcuts option stays reachable in the Aa menu (round 21 review)', async () => {
  const page = await h.newPage();
  const old = { i: 0, f: 0, t: Date.now() - 100 * 86400000 };
  await h.openReader(page, `${h.SITE}/folder-keep/index.html?book=/reader/books/long.epub`, { 'spine:set:KEEP_POSITIONS_DAYS': 0, 'spine:pos:url:/elsewhere/x.epub': old });
  assert.notEqual(await stored(page, 'spine:pos:url:/elsewhere/x.epub'), null, 'the reader keeps positions forever; the folder\'s 30 days are its own');
  const p2 = await h.newPage();
  await h.openReader(p2, `${h.SITE}/folder-locked/index.html?book=/reader/books/long.epub`);
  await p2.click('#fontBtn');
  await p2.waitForSelector('#fontMenu:not([hidden])');
  assert.equal(await p2.getAttribute('#keysOpt', 'aria-disabled'), 'true');
  const n = await p2.evaluate(() => document.querySelectorAll('#fontMenu .opt').length);
  const seen = new Set();
  for (let k = 0; k < n + 1; k++) { await p2.keyboard.press('ArrowDown'); seen.add(await p2.evaluate(() => document.activeElement.id || document.activeElement.dataset.face)); }
  assert.ok(seen.has('keysOpt') && seen.size === n, [...seen].join());
  await p2.keyboard.press('Enter');   // (on the locked option: nothing changes)
  assert.equal(await p2.getAttribute('#keysOpt', 'aria-checked'), 'true');
});

test('Settings shows the version (the date and time it was stamped, in UTC) and a link to the project on GitHub', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await openSettings(page);
  assert.match(await page.textContent('.set-version'), /^Version \d{8}\.\d{4}\s*$/);
  const a = page.locator('.set-version a');
  assert.equal(await a.getAttribute('href'), 'https://github.com/jskenney/epub-reader');
  assert.equal(await a.getAttribute('target'), '_blank');
  assert.equal(await a.getAttribute('aria-label'), 'epub-reader on GitHub');
});

test('Generate config shows every setting in use as a reader-config.json: the folder\'s, the reader\'s own, the LOCKED list; Copy and Download', async () => {
  const page = await h.newPage();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.SITE });
  await h.openReader(page, `${h.SITE}/folder-locked/index.html?book=/reader/books/long.epub`);
  await openSettings(page);
  await page.uncheck('[data-set="SHOW_PROGRESS"]');
  await page.fill('[data-set="SEARCH_MAX"]', '7'); await page.press('[data-set="SEARCH_MAX"]', 'Tab');
  // (Generate config at the far left of the buttons.)
  const [gen, reset] = await page.evaluate(() => ['#setGenerate', '#setReset'].map(q => document.querySelector(q).getBoundingClientRect().left));
  assert.ok(gen < reset - 100, `${gen} ${reset}`);
  await page.click('#setGenerate');
  await page.waitForFunction(() => document.querySelector('#cfgDialog').open);
  const cfg = JSON.parse(await page.inputValue('#cfgText'));
  for (const k of ['DEFAULT_BOOK', 'BOOKSHELF', 'LIB_FILES', 'VOICE_FILES', 'ALLOW_CDN', 'ALLOW_REMOTE_CONTENT', 'ALLOW_EXTERNAL_LINKS', 'EDITING', 'GET_URLS',
    'SHOW_CONTENTS', 'SHOW_PROGRESS', 'SHOW_TOPBAR', 'TIME_LEFT', 'SLEEP_TIMER', 'FORCE_LTR', 'KEEP_POSITIONS_DAYS', 'SEARCH_MAX', 'COMIC_PART',
    'TTS_SERVER', 'FULL_PRECISION', 'LOOKAHEAD_SEC', 'SAVED_AUDIO_MB', 'NCACHE_SEC', 'SPAN_MAX', 'layout', 'width', 'font', 'fontSize', 'lineSpacing', 'shortcuts', 'LOCKED']) assert.ok(k in cfg, k);
  assert.equal(cfg.SHOW_PROGRESS, false, 'the reader\'s own choice');
  assert.equal(cfg.SEARCH_MAX, 7);
  assert.equal(cfg.TIME_LEFT, true, 'the folder\'s (locked) value');
  assert.equal(cfg.LIB_FILES, '/reader/');
  assert.equal(cfg.theme, 'sepia');
  assert.deepEqual(cfg.TTS_SERVER, { api: '/tts/', voices: '/tts-voices/' });
  assert.deepEqual(cfg.LOCKED, ['theme', 'TIME_LEFT', 'shortcuts', 'ALLOW_REMOTE_CONTENT']);
  // Copy, and Download.
  await page.click('#cfgCopy');
  await page.waitForFunction(() => document.querySelector('#cfgNote').textContent === 'Copied.');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.inputValue('#cfgText'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cfgDownload')]);
  assert.equal(dl.suggestedFilename(), 'reader-config.json');
  assert.deepEqual(JSON.parse(require('node:fs').readFileSync(await dl.path(), 'utf8')), cfg);
  // Done: back to Settings.
  await page.click('#cfgDone');
  assert.equal(await page.evaluate(() => [document.querySelector('#cfgDialog').open, document.querySelector('#setDialog').open, document.activeElement.id]).then(x => x.join()), 'false,true,setGenerate');
});

// Round 25 review, loop 3.
test('saved speech is cut down to a lowered limit at once, and all of it goes at 0, from Settings or a reload (round 25 review, L-305)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  const fill = () => page.evaluate(() => new Promise(res => {
    const rq = indexedDB.open('spine-voice-audio', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('clips', { keyPath: 'key' }).createIndex('used', 'used');
    rq.onsuccess = () => { const db = rq.result, tx = db.transaction('clips', 'readwrite'); for (let k = 0; k < 5; k++) tx.objectStore('clips').put({ key: 'k' + k, blob: new Blob([new Uint8Array(3 << 20)]), dur: 1, size: 3 << 20, used: Date.now() - k }); tx.oncomplete = () => { db.close(); res(); }; };
  }));
  const count = () => page.evaluate(() => new Promise(res => { const rq = indexedDB.open('spine-voice-audio', 1); rq.onsuccess = () => { const db = rq.result, c = db.transaction('clips').objectStore('clips').count(); c.onsuccess = () => { db.close(); res(c.result); }; }; }));
  await fill();
  assert.equal(await count(), 5);
  await page.click('#setBtn');
  await page.fill('#set-SAVED_AUDIO_MB', '7'); await page.press('#set-SAVED_AUDIO_MB', 'Tab');
  assert.ok(await h.waitFor(async () => (await count()) === 2, 5000), 'two 3 MB clips fit in 7 MB');
  await page.fill('#set-SAVED_AUDIO_MB', '0'); await page.press('#set-SAVED_AUDIO_MB', 'Tab');
  assert.ok(await h.waitFor(async () => (await count()) === 0, 5000), '0 keeps none');
  // A limit lowered since the last visit (here the reader's own, saved before the page was left): cut on the next load.
  await page.evaluate(() => { localStorage.setItem('spine:set:SAVED_AUDIO_MB', '4'); localStorage.setItem('spine:savedAudioMB', '500'); });
  await fill();
  await page.reload(); await h.waitForBook(page);
  assert.ok(await h.waitFor(async () => (await count()) === 1, 5000), 'one 3 MB clip fits in 4 MB');
});

// More reading fonts: ADDITIONAL_FONTS.
const fontNames = page => page.$$eval('#fontMenu .opt[data-face]', bs => bs.map(b => [b.dataset.face, b.querySelector('span').textContent]));
test('ADDITIONAL_FONTS in reader-config.json adds Google Fonts families to the font menu (not one already there, not a bad name), loaded from Google when not self-hosted', async () => {
  const page = await h.newPage();
  const warned = []; page.on('console', m => { if (/ADDITIONAL_FONTS/.test(m.text())) warned.push(m.text()); });
  // (On the site with no reader policy: the self-hosted policy in nginx.conf.example allows no font from Google,
  // as the README says; the CDN version does.)
  await h.openReader(page, `${h.PLAIN}/folder-fonts/index.html?book=/reader/books/long.epub`);
  const names = await fontNames(page);
  // (A family whose name starts with a digit is a family, not the styles of the one before: round 26 review, L-350.)
  assert.deepEqual(names.filter(([id]) => id.startsWith('g-')), [['g-merriweather', 'Merriweather'], ['g-noto-serif', 'Noto Serif'], ['g-42dot-sans', '42dot Sans']]);
  assert.equal(names.filter(([, n]) => n === 'Lexend').length, 1, 'the built-in Lexend only');
  assert.ok(warned.some(w => /bad<name>/.test(w)), warned.join(' | '));
  await page.click('#fontBtn'); await page.click('#fontMenu .opt[data-face="g-noto-serif"]');
  await h.waitFor(() => page.blocked.some(u => /fonts\.googleapis\.com\/css2\?family=Noto\+Serif:ital,wght@0,400;1,400/.test(u)), 5000);
  assert.ok(page.blocked.some(u => /family=Noto\+Serif/.test(u)), page.blocked.join(' '));
  assert.match(await h.inFrame(page, doc => getComputedStyle(doc.querySelector('[id^="spine-flow"]').querySelector('p')).fontFamily), /Noto Serif/);
  assert.match(await h.inFrame(page, doc => doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content), /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  // Remembered across a reload.
  await page.reload(); await h.waitForBook(page);
  assert.equal(await page.getAttribute('#fontMenu .opt[data-face="g-noto-serif"]', 'aria-checked'), 'true');
});

test('a font of ADDITIONAL_FONTS self-hosted by fetch-fonts.sh (fonts/g-<name>.css) is loaded from the site, not Google', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.SITE}/folder-fonts-local/index.html?book=/reader/books/long.epub`);
  await page.click('#fontBtn'); await page.click('#fontMenu .opt[data-face="g-test-face"]');
  assert.ok(await h.waitFor(() => h.inFrame(page, async doc => { await doc.fonts.ready; return doc.fonts.check('16px "Test Face"') && [...doc.fonts].some(f => f.family.replace(/"/g, '') === 'Test Face' && f.status === 'loaded'); }), 8000), 'the font loads');
  assert.equal(await h.inFrame(page, doc => doc.querySelector('[id^="spine-font"]').getAttribute('href')), `${h.SITE}/fontlib/fonts/g-test-face.css`);
  assert.deepEqual(page.blocked.filter(u => /fonts\.(googleapis|gstatic)/.test(u)), []);
});

test('ADDITIONAL_FONTS in Settings: names added to the menu at once, a bad name refused with why, kept in Generate config', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.click('#setBtn');
  await page.fill('#set-ADDITIONAL_FONTS', 'Lora, Merriweather:wght@400;700'); await page.press('#set-ADDITIONAL_FONTS', 'Tab');
  const extra = async () => (await fontNames(page)).filter(([id]) => id.startsWith('g-'));
  await h.waitFor(async () => (await extra()).length === 2, 5000);
  assert.deepEqual(await extra(), [['g-lora', 'Lora'], ['g-merriweather', 'Merriweather']]);
  await page.fill('#set-ADDITIONAL_FONTS', 'Lora, x"><b>'); await page.press('#set-ADDITIONAL_FONTS', 'Tab');
  assert.match(await page.textContent('#set-ADDITIONAL_FONTS >> xpath=ancestor::div[1]'), /Not changed: .*isn't a Google Fonts family name/);
  assert.equal(await page.inputValue('#set-ADDITIONAL_FONTS'), 'Lora, Merriweather:wght@400;700');
  await page.click('#setGenerate');
  assert.deepEqual(JSON.parse(await page.inputValue('#cfgText')).ADDITIONAL_FONTS, ['Lora', 'Merriweather:wght@400;700']);
});

test('a font added in Settings on a site that self-hosts its fonts shows in the page open at once (its policy made again: round 26 review, L-348)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.PLAIN}/folder-fonts-local/index.html?book=/reader/books/long.epub`);
  const policy = () => h.inFrame(page, doc => doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
  assert.doesNotMatch(await policy(), /fonts\.googleapis\.com/);
  await page.click('#setBtn');
  await page.fill('#set-ADDITIONAL_FONTS', 'Merriweather'); await page.press('#set-ADDITIONAL_FONTS', 'Tab');
  assert.ok(await h.waitFor(async () => /style-src[^;]*https:\/\/fonts\.googleapis\.com/.test(await policy()), 5000), 'the open page allows it');
});

test('Marks around math typed in Settings: a bad value is refused with its reason, a good one kept in its normal form (round 31 review)', async () => {
  const page = await h.newPage();
  await h.openReader(page, `${h.READER}?book=books/long.epub`);
  await page.click('#setBtn');
  const field = page.locator('#set-MATH_DELIMITERS');
  await field.fill('\\{ foo'); await field.dispatchEvent('change');
  assert.match(await page.locator('#set-MATH_DELIMITERS').locator('xpath=ancestor::div[contains(@class,"set-row")]').locator('.set-def').textContent(), /Not changed: .*isn't one of/);
  assert.equal(await page.evaluate(() => localStorage.getItem('spine:set:MATH_DELIMITERS')), null);
  await field.fill('$$, \\('); await field.dispatchEvent('change');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('spine:set:MATH_DELIMITERS'))), '\\( $$');
});

test('a theme of the reader\'s own: made from the one in use, its colours edited, kept across a reload and drawn before the page, given by Generate config, deleted (E-38)', async () => {
  const page = await h.newPage();
  await h.openReader(page, LONG);
  await openSettings(page);
  await page.click('#themeNew');
  const id = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert.match(id, /^u-/);
  assert.equal(await page.isVisible('#themeFields'), true);
  await page.fill('#themeName', 'Night owl');
  await page.locator('[data-theme-key="page"]').evaluate(el => { el.value = '#102030'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-theme-key="text"]').evaluate(el => { el.value = '#e0e8f0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#themeDark');
  const bg = () => h.inFrame(page, doc => getComputedStyle(doc.documentElement).backgroundColor);
  assert.ok(await h.waitFor(async () => await bg() === 'rgb(16, 32, 48)', 3000), await bg());
  assert.match(await page.textContent('.set-themes'), /Night owl/);
  // Generate config gives it, as a site's theme.
  await page.click('#setGenerate');
  const cfg = JSON.parse(await page.inputValue('#cfgText'));
  assert.deepEqual(cfg.THEMES?.map(x => [x.name, x.page, x.text, x.dark]), [['Night owl', '#102030', '#e0e8f0', true]]);
  assert.equal(cfg.theme, 's-night-owl');
  await page.keyboard.press('Escape');
  // Kept, and drawn as the page loads.
  await page.reload();
  assert.equal(await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), document.documentElement.style.getPropertyValue('--page-bg')].join(' ')), `${id} #102030`);
  await h.waitForBook(page);
  assert.equal(await bg(), 'rgb(16, 32, 48)');
  assert.equal(await page.evaluate(() => document.querySelector('#themeBtn').classList.contains('dark')), true, 'a dark theme');
  // Deleted.
  await openSettings(page);
  page.once('dialog', d => d.accept());
  await page.click('#themeDelete');
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
  assert.doesNotMatch(await page.textContent('.set-themes'), /Night owl/);
});

test('a site\'s themes from reader-config.json: offered beside the built-in ones, the folder\'s default by its name, interface colours of its own; a bad one left out (E-39)', async () => {
  const page = await h.newPage();
  const warns = []; page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await h.openReader(page, `${h.SITE}/folder-themes/index.html?book=/reader/books/long.epub`);
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 's-ocean');
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.documentElement).backgroundColor), 'rgb(11, 37, 51)');
  assert.ok(warns.some(w => /THEMES: Bad ignored/.test(w)), warns.join(' | '));
  await openSettings(page);
  const names = await page.$$eval('.set-themes .set-theme', ls => ls.map(l => l.textContent.trim()));
  assert.deepEqual(names.slice(-2), ['AaOcean', 'AaPaper']);
  assert.equal(await page.isVisible('#themeFields'), false, 'a site\'s theme isn\'t edited');
  await page.click('.set-theme:has(input[value="s-paper"])');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), '#e9e2d0');
  assert.equal(await h.inFrame(page, doc => getComputedStyle(doc.documentElement).backgroundColor), 'rgb(251, 247, 238)');
  assert.equal(await page.evaluate(() => document.querySelector('#themeBtn').classList.contains('dark')), false);
});
