// Search folding and patterns (index.html's fold and searchPattern), run in Node on the reader's own code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n}\n', a) + 2); };
const line = name => { const a = src.indexOf(name); return src.slice(a, src.indexOf('\n', a)); };
const { fold, searchPattern } = new Function(`${line('const foldMap = ')}\n${grab('function fold(')}\n${line('const LIGATURES = ')}\n${grab('function searchPattern(')}\nreturn { fold, searchPattern };`)();
const finds = (text, q) => { const f = fold(text); assert.equal(f.length, text.length, 'offsets stay aligned'); return [...f.matchAll(searchPattern(q))].map(m => text.slice(m.index, m.index + m[0].length)); };

test('search finds words with soft hyphens, zero-width characters and ligatures in them (L-45)', () => {
  assert.deepEqual(finds('a hyphen­ation here', 'hyphenation'), ['hyphen­ation']);
  assert.deepEqual(finds('zero​width', 'zerowidth'), ['zero​width']);
  assert.deepEqual(finds('ﬁnd the ﬂow, oﬃce', 'find'), ['ﬁnd']);
  assert.deepEqual(finds('ﬁnd the ﬂow, oﬃce', 'office'), ['oﬃce']);
  assert.deepEqual(finds('Ünter „Café” — CAFE', 'cafe'), ['Café', 'CAFE']);
  assert.deepEqual(finds('two  words\nhere', 'two words'), ['two  words']);
  assert.deepEqual(finds('a.b (c)', 'a.b (c)'), ['a.b (c)']);
});
