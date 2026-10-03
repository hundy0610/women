// 모든 날짜와 시각은 한국 시간(KST) 기준입니다. 서버는 UTC라서 직접 변환합니다.
const KST_OFFSET_MS = 9 * 3600 * 1000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

export function kstParts(epochMs = Date.now()) {
  const d = new Date(epochMs + KST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() };
}

export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function todayKst(epochMs = Date.now()) {
  const p = kstParts(epochMs);
  return ymd(p.y, p.m, p.d);
}

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d, dow: dt.getUTCDay() };
}

export function addDays(s, n) {
  const p = parseYmd(s);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export const dowOf = (s) => parseYmd(s).dow;
export const ymdNum = (s) => Number(String(s).replace(/-/g, ''));

// KST 날짜와 시(hour)를 UTC epoch(ms)로 바꿉니다.
export function kstEpoch(s, hour) {
  const p = parseYmd(s);
  return Date.UTC(p.y, p.m - 1, p.d, hour - 9, 0, 0);
}

export function formatKoreanDate(s) {
  const p = parseYmd(s);
  return `${p.m}월 ${p.d}일(${DOW[p.dow]})`;
}

export const hh = (h) => `${pad(h)}:00`;

export function formatKstDateTime(epochMs) {
  const p = kstParts(epochMs);
  return `${p.m}월 ${p.d}일(${DOW[p.dow]}) ${pad(p.h)}:${pad(p.mi)}`;
}

export const DOW_LABELS = DOW;
