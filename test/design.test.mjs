import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTokens, buildCss, contrast } from '../scripts/design-tokens.mjs';

const md = fs.readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

test('public/tokens.css가 DESIGN.md와 같다(고쳤다면 npm run design 실행)', () => {
  const css = fs.readFileSync(new URL('../public/tokens.css', import.meta.url), 'utf8');
  assert.equal(css, buildCss(md));
});

test('구성요소의 글자와 바탕은 WCAG AA 4.5:1 이상', () => {
  const t = parseTokens(md);
  const hex = (ref) => t.colors[/\{colors\.([\w-]+)\}/.exec(ref)[1]];
  const bad = [];
  for (const [name, c] of Object.entries(t.components)) {
    if (!c.backgroundColor || !c.textColor) continue;
    const r = contrast(hex(c.backgroundColor), hex(c.textColor));
    if (r < 4.5) bad.push(`${name} ${r.toFixed(2)}`);
  }
  assert.deepEqual(bad, []);
});

test('본문 글자색은 두 가지 바탕 모두에서 4.5:1 이상', () => {
  const t = parseTokens(md);
  for (const fg of ['primary', 'secondary', 'muted']) {
    for (const bg of ['surface', 'neutral']) assert.ok(contrast(t.colors[fg], t.colors[bg]) >= 4.5, `${fg} on ${bg}`);
  }
});
