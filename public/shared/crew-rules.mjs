// 소모임 이용 기간 계산. 화면과 서버가 같이 씁니다. 날짜는 모두 KST 기준 "YYYY-MM-DD"입니다.
import { parseYmd, addDays, ymd, dowOf } from './time.mjs';

// n개월 뒤 같은 날(그 달에 없으면 말일).
export function addMonths(s, n) {
  const p = parseYmd(s);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return ymd(y, m, Math.min(p.d, last));
}

// 시작일부터 months개월 이용하는 기간의 마지막 날. 예: 10/29 시작, 1개월이면 11/28.
export const periodEnd = (start, months = 1) => addDays(addMonths(start, months), -1);

// 시작일 이후(시작일 포함) 처음 오는 해당 요일.
export function firstOnOrAfter(s, weekday) {
  const diff = (weekday - dowOf(s) + 7) % 7;
  return addDays(s, diff);
}

// 기간 안에서 해당 요일에 열리는 모든 날짜.
export function sessionsBetween(start, end, weekday) {
  const out = [];
  for (let d = firstOnOrAfter(start, weekday); d <= end; d = addDays(d, 7)) out.push(d);
  return out;
}
