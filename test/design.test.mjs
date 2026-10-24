import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// public/tokens.css가 색·글자 크기의 기준입니다. 고치면 아래 접근성 기준을 다시 확인합니다.
const css = fs.readFileSync(new URL('../public/tokens.css', import.meta.url), 'utf8');
const vars = Object.fromEntries([...css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const c = (name) => vars[`c-${name}`];

test('토큰 파일에 필요한 변수가 모두 있다', () => {
  for (const k of ['c-brand', 'c-brand-strong', 'c-brand-soft', 'c-bg', 'c-surface', 'c-ink', 'c-ink-2', 'c-line-strong', 'c-pend-bg', 'c-ok-bg', 'c-bad-bg', 'c-off-bg', 'c-booked', 'fs-body', 'tap', 'btn-h']) assert.ok(vars[k], k);
});

test('글자와 바탕은 WCAG AA 4.5:1 이상', () => {
  const pairs = [
    ['본문', c('ink'), c('surface')], ['본문(크림 바탕)', c('ink'), c('bg')], ['보조 글자', c('ink-2'), c('surface')], ['보조 글자(크림)', c('ink-2'), c('bg')],
    ['주 버튼', '#FFFFFF', c('brand')], ['링크와 강조', c('brand-strong'), c('surface')], ['선택 배경 위 글자', c('brand-strong'), c('brand-soft')],
    ['입금 대기', c('pend-fg'), c('pend-bg')], ['확정', c('ok-fg'), c('ok-bg')], ['취소 요청과 오류', c('bad-fg'), c('bad-bg')], ['취소와 만료', c('off-fg'), c('off-bg')],
    ['예약 완료 칸', '#FFFFFF', c('booked')], ['위험 버튼', '#FFFFFF', c('bad-fg')], ['확정 버튼', '#FFFFFF', c('ok-fg')],
  ];
  const bad = pairs.filter(([, fg, bg]) => contrast(fg, bg) < 4.5).map(([n, fg, bg]) => `${n} ${contrast(fg, bg).toFixed(2)}`);
  assert.deepEqual(bad, []);
});

test('입력칸 테두리는 흰 바탕에서 3:1 이상', () => {
  assert.ok(contrast(c('line-strong'), c('surface')) >= 3);
});

test('본문 글자는 18px 이상, 터치 대상은 48px 이상', () => {
  assert.ok(parseInt(vars['fs-body'], 10) >= 18);
  assert.ok(parseInt(vars.tap, 10) >= 48);
});
