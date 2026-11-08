// Path handling (index.html's resolve and fragment decoding), run in Node on the reader's own code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n}\n', a) + 2); };
const line = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n', a)); };
const { resolve } = new Function(`${line('const safeDecode = ')}\n${grab('function resolve(')}\nreturn { resolve };`)();

test('paths resolve inside the book, with encoded names decoded (M-14, L-43)', () => {
  assert.equal(resolve('OEBPS/text/c1.xhtml', '../images/p%20q.png'), 'OEBPS/images/p q.png');
  assert.equal(resolve('OEBPS/content.opf', 'chap%C3%A4.xhtml#x'), 'OEBPS/chapä.xhtml');
  // A stray "%" is part of the name, whatever the folders are called (L-43).
  assert.equal(resolve('My Book/content.opf', '100%.html'), 'My Book/100%.html');
  assert.equal(resolve('Ö/content.opf', '50%.html'), 'Ö/50%.html');
  assert.equal(resolve('OEBPS/content.opf', '100%25.html'), 'OEBPS/100%.html');
  // Encoded slashes and backslashes name a file; they never step to another folder or site (M-14).
  for (const href of ['%2F%2Fevil.example%2Fx.css', '%5C%5Cevil.example%5Cx.css', 'a%2F..%2F..%2F..%2Fx.css', '..%2F..%2Fx.css']) {
    const r = resolve('books/b/OEBPS/content.opf', href);
    assert.ok(r.startsWith('books/b/OEBPS/'), `${href} -> ${r}`);
    assert.ok(!r.slice('books/b/OEBPS/'.length).includes('/'), `${href} -> ${r}`);
  }
  // Plain ".." stays inside the book's root at most.
  assert.equal(resolve('OEBPS/content.opf', '../../../x.css'), 'x.css');
});

test('file lookups that differ in case or Unicode form are fast in large archives (L-70)', () => {
  const a = src.indexOf('const pathKey'), b = src.indexOf('\n}\n', src.indexOf('function foldedNames')) + 3;
  const code = src.slice(a, b).replace(/return f && f\._data\?\.compressedContent \? checkedEntry\(zip, f\) : f;/, 'return f;');
  const { getFile } = new Function(`${code}\nreturn { getFile };`)();
  const files = {};
  for (let i = 0; i < 20000; i++) files[`OEBPS/img/p${i}.png`] = { name: `OEBPS/img/p${i}.png` };
  files['OEBPS/Kapitel-ä.xhtml'] = { name: 'OEBPS/Kapitel-ä.xhtml' };
  const zip = { files, file: n => files[n] || null };
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) assert.ok(getFile(zip, `OEBPS/IMG/P${i}.PNG`));
  assert.ok(Date.now() - t0 < 500, `1000 lookups took ${Date.now() - t0} ms`);
  assert.equal(getFile(zip, 'OEBPS/kapitel-ä.xhtml').name, 'OEBPS/Kapitel-ä.xhtml');
  assert.equal(getFile(zip, '/OEBPS/img/p5.png').name, 'OEBPS/img/p5.png');
  assert.equal(getFile(zip, 'missing.xhtml'), null);
});
