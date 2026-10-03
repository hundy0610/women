import { randomId } from './util.js';

// 이력은 만료 없이 정렬 집합 'log'에 쌓습니다. 예약 기록이 지워져도 이력에는 당시 내용이 남도록 요약을 함께 저장합니다.
export const snap = (r) => ({ id: r.id, date: r.date, start: r.start, end: r.end, spaces: r.spaces, name: r.name, amount: r.amount });

export async function logEvent(store, nowMs, evt) {
  await store.zadd('log', nowMs, JSON.stringify({ ...evt, t: nowMs, k: randomId(4) }));
}

export async function listLog(store, limit = 500) {
  const raw = await store.zrangebyscore('log', 0, 9999999999999);
  const out = [];
  for (const r of raw) { try { out.push(JSON.parse(r)); } catch { /* 깨진 항목은 건너뜁니다 */ } }
  return out.sort((a, b) => b.t - a.t).slice(0, limit);
}
