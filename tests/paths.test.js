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
