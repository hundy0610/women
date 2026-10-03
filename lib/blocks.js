import { CONFIG } from '../public/shared/config.mjs';
import { parseYmd, addDays, ymdNum } from '../public/shared/time.mjs';
import { randomId } from './util.js';
import { BookingError, listRange } from './booking.js';
import { logEvent } from './history.js';

const KEY = 'blocks';
const MAX_SPAN = 400;

async function readAll(store) {
  try { return JSON.parse((await store.get(KEY)) || '[]'); } catch { return []; }
}

export const getBlocks = readAll;

function expand(b) {
  const out = [];
  for (let d = b.from, i = 0; ymdNum(d) <= ymdNum(b.to) && i <= MAX_SPAN; d = addDays(d, 1), i++) out.push({ date: d, label: b.reason || '휴관' });
  return out;
}

// 화면에 내려보내는 휴관일 목록(날짜별로 펼친 것)
export async function blockedDatesFor(store) {
  return (await readAll(store)).flatMap(expand);
}

// 코드에 적힌 기본 규칙에 관리자가 추가한 휴관일을 합친 설정
export async function configWith(store) {
  return { ...CONFIG, blockedDates: [...CONFIG.blockedDates, ...(await blockedDatesFor(store))] };
}

export async function addBlock(store, { from, to, reason }, nowMs) {
  if (!parseYmd(from) || !parseYmd(to)) throw new BookingError('DATE', '날짜를 선택하세요.');
  if (ymdNum(to) < ymdNum(from)) throw new BookingError('RANGE', '종료일이 시작일보다 빠릅니다.');
  if (ymdNum(to) > ymdNum(addDays(from, MAX_SPAN))) throw new BookingError('RANGE', '한 번에 400일까지만 지정할 수 있습니다.');
  const label = String(reason || '휴관').replace(/\s+/g, ' ').trim().slice(0, 30) || '휴관';
  const all = await readAll(store);
  const b = { id: randomId(6), from, to, reason: label };
  all.push(b);
  await store.set(KEY, JSON.stringify(all));
  // 이미 예약이 있는 날이 포함되어 있으면 관리자가 알 수 있게 건수를 돌려줍니다.
  const affected = (await listRange(store, from, to, nowMs)).length;
  await logEvent(store, nowMs, { id: '', action: 'block_added', by: 'admin', note: `${from}${from === to ? '' : ` ~ ${to}`} ${label}` });
  return { block: b, affected };
}

export async function removeBlock(store, id, nowMs) {
  const all = await readAll(store);
  const b = all.find((x) => x.id === id);
  if (!b) throw new BookingError('NOT_FOUND', '휴관일을 찾을 수 없습니다.', 404);
  await store.set(KEY, JSON.stringify(all.filter((x) => x.id !== id)));
  await logEvent(store, nowMs, { id: '', action: 'block_removed', by: 'admin', note: `${b.from}${b.from === b.to ? '' : ` ~ ${b.to}`} ${b.reason}` });
}
