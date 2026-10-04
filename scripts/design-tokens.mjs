// DESIGN.md의 토큰(YAML 머리말)을 읽어 public/tokens.css를 만듭니다. 사용법: npm run design
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 이 사이트의 머리말은 2단계 들여쓰기 맵뿐이라 작은 해석기로 충분합니다.
export function parseTokens(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) throw new Error('DESIGN.md에 YAML 머리말이 없습니다.');
  const tree = {};
  const stack = [{ indent: -1, node: tree }];
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();
    const i = line.indexOf(':');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (val === '') {
      parent[key] = {};
      stack.push({ indent, node: parent[key] });
    } else {
      if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
      parent[key] = val;
    }
  }
  return tree;
}

export const luminance = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// DESIGN.md의 구성요소 이름을 실제 화면의 선택자에 연결합니다. 여기 없는 이름은 문서용입니다.
export const COMPONENTS = {
  header: ['.top'],
  'button-primary': ['.btn'],
  'button-primary-hover': ['.btn:hover:not(:disabled)'],
  card: ['.card'],
  'panel-header': ['.side .card > h2'],
  'option-selected': ['.opt-card:has(.opt[aria-pressed=true])'],
  chip: ['.chip', '.qbtn'],
  'chip-selected': ['.chip[aria-pressed=true]', '.qbtn[aria-pressed=true]'],
  'slot-pending': ['td.pending', '.legend .l-pending'],
  'slot-confirmed': ['td.confirmed', '.legend .l-confirmed'],
  'slot-blocked': ['td.blocked', '.legend .l-blocked'],
  'slot-selected': ['td.sel', '.legend .l-sel'],
  'time-cell-selected': ['.tcell.sel'],
  'bank-panel': ['.bank'],
  'notice-error': ['.notice.error'],
};

const FONT_STACK = '"NanumSquare", "Pretendard Variable", "Noto Sans KR", system-ui, sans-serif';

export function buildCss(md) {
  const t = parseTokens(md);
  const out = ['/* 자동 생성 파일입니다. DESIGN.md를 고친 뒤 npm run design 으로 다시 만드세요. */', ':root {'];
  for (const [k, v] of Object.entries(t.colors || {})) out.push(`  --${k}: ${v};`);
  for (const [k, v] of Object.entries(t.rounded || {})) out.push(`  --r-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.spacing || {})) out.push(`  --s-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.typography || {})) {
    if (v.fontSize) out.push(`  --t-${k}-size: ${v.fontSize};`);
    if (v.fontWeight) out.push(`  --t-${k}-weight: ${v.fontWeight};`);
    if (v.lineHeight) out.push(`  --t-${k}-line: ${v.lineHeight};`);
    if (v.letterSpacing) out.push(`  --t-${k}-track: ${v.letterSpacing};`);
  }
  out.push(`  --font: ${FONT_STACK};`, '}', '');

  const ref = (s) => {
    const m = /^\{(\w+)\.([\w-]+)\}$/.exec(s);
    if (!m) return s;
    const [, group, name] = m;
    return group === 'colors' ? `var(--${name})` : group === 'rounded' ? `var(--r-${name})` : group === 'spacing' ? `var(--s-${name})` : s;
  };
  const typo = (s) => {
    const m = /^\{typography\.([\w-]+)\}$/.exec(s);
    if (!m) return [];
    const n = m[1];
    const v = (t.typography || {})[n] || {};
    const d = [];
    if (v.fontSize) d.push(`font-size: var(--t-${n}-size)`);
    if (v.fontWeight) d.push(`font-weight: var(--t-${n}-weight)`);
    if (v.lineHeight) d.push(`line-height: var(--t-${n}-line)`);
    if (v.letterSpacing) d.push(`letter-spacing: var(--t-${n}-track)`);
    return d;
  };

  for (const [name, props] of Object.entries(t.components || {})) {
    const sel = COMPONENTS[name];
    if (!sel) continue;
    const d = [];
    if (props.backgroundColor) d.push(`background: ${ref(props.backgroundColor)}`);
    if (props.textColor) d.push(`color: ${ref(props.textColor)}`);
    if (props.typography) d.push(...typo(props.typography));
    if (props.rounded) d.push(`border-radius: ${ref(props.rounded)}`);
    if (props.height) d.push(`height: ${props.height}`);
    if (props.padding && name === 'button-primary') d.push(`padding: 0 ${props.padding}`);
    out.push(`${sel.join(',\n')} {\n  ${d.join(';\n  ')};\n}`);
  }
  return out.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8');
  fs.writeFileSync(path.join(root, 'public', 'tokens.css'), buildCss(md));
  console.log('public/tokens.css를 만들었습니다.');
}
