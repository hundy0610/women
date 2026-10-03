import { CONFIG } from '../public/shared/config.mjs';
import { quote } from '../public/shared/pricing.mjs';
import { blockLabel } from '../public/shared/rules.mjs';
import { parseYmd, addDays, todayKst, kstEpoch, ymdNum, formatKoreanDate } from '../public/shared/time.mjs';
import { randomId, sha } from './util.js';
import { logEvent, snap } from './history.js';

const HOUR_MS = 3600 * 1000;
const DAY_SEC = 86400;

export class BookingError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const slotKey = (date, spaceId, hour) => `s:${date}:${spaceId}:${hour}`;

export function slotKeysFor(rec) {
  const keys = [];
  for (const sp of rec.spaces) for (let h = rec.start; h < rec.end; h++) keys.push(slotKey(rec.date, sp, h));
  return keys;
}

export function effectiveStatus(rec, nowMs) {
  if (rec.status === 'canceled') return 'canceled';
  if (rec.status === 'confirmed') return 'confirmed';
  return rec.holdUntil && rec.holdUntil > nowMs ? 'pending' : 'expired';
}
export const isActive = (rec, nowMs) => ['confirmed', 'pending'].includes(effectiveStatus(rec, nowMs));

const parseRec = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function normalizePhone(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

async function releaseOwned(store, id, keys) {
  if (!keys.length) return;
  const owners = await store.mget(keys);
  const mine = keys.filter((k, i) => owners[i] === id);
  if (mine.length) await store.del(mine);
}

// 슬롯을 한 번에 선점합니다. 이미 있는 키 중 소유자가 만료되었거나 사라진 것은 치우고 다시 시도합니다.
async function claimSlots(store, id, keys, ttlSec, nowMs) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const owners = await store.mget(keys);
    const needed = keys.filter((k, i) => owners[i] !== id);
    if (!needed.length) return true;
    if (await store.msetnx(Object.fromEntries(needed.map((k) => [k, id])), ttlSec)) return true;

    const cur = await store.mget(needed);
    const ownerIds = [...new Set(cur.filter(Boolean).map(String))];
    const recs = (await store.mget(ownerIds.map((o) => `res:${o}`))).map(parseRec);
    let freed = false;
    for (let i = 0; i < ownerIds.length; i++) {
      if (recs[i] && isActive(recs[i], nowMs)) continue;
      const stale = recs[i] ? slotKeysFor(recs[i]) : needed.filter((k, j) => String(cur[j]) === ownerIds[i]);
      await releaseOwned(store, ownerIds[i], stale);
      freed = true;
    }
    if (!freed) return false;
  }
  return false;
}

async function rateLimit(store, key, limit, ttlSec, message) {
  const n = await store.incr(key, ttlSec);
  if (n > limit) throw new BookingError('RATE_LIMIT', message, 429);
}

export async function createReservation(store, raw, ctx = {}) {
  const cfg = ctx.cfg || CONFIG;
  const nowMs = ctx.nowMs ?? Date.now();

  const admin = ctx.admin === true;
  if (!admin && raw.website) throw new BookingError('BOT', '요청을 처리할 수 없습니다.');
  const date = String(raw.date || '');
  if (!parseYmd(date)) throw new BookingError('DATE', '날짜를 선택하세요.');
  const start = Number(raw.start);
  const end = Number(raw.end);
  const spaces = Array.isArray(raw.spaces) ? [...new Set(raw.spaces.map(String))] : [];
  const name = cleanText(raw.name, 20);
  if (name.length < 2) throw new BookingError('NAME', '이름을 2자 이상 입력하세요.');
  const phone = normalizePhone(raw.phone);
  if (!phone) throw new BookingError('PHONE', '휴대전화 번호를 확인하세요.');
  const people = Number(raw.people);
  if (!Number.isInteger(people) || people < 1 || people > 500) throw new BookingError('PEOPLE', '인원을 1명 이상 입력하세요.');
  const purpose = cleanText(raw.purpose, 100);
  if (!admin && raw.agree !== true) throw new BookingError('AGREE', '이용 안내에 동의해야 예약할 수 있습니다.');

  const q = quote(cfg, { spaceIds: spaces, startHour: start, endHour: end, people });
  if (!q.ok) throw new BookingError(q.code, q.message);

  if (!admin && kstEpoch(date, start) < nowMs + cfg.minLeadHours * HOUR_MS) {
    throw new BookingError('LEAD', `이용 시작 ${cfg.minLeadHours}시간 전까지 예약할 수 있습니다.`);
  }
  if (!admin && ymdNum(date) > ymdNum(addDays(todayKst(nowMs), cfg.horizonDays))) {
    throw new BookingError('HORIZON', `오늘부터 ${cfg.horizonDays}일 이내 날짜만 예약할 수 있습니다.`);
  }
  for (const sp of spaces) {
    for (let h = start; h < end; h++) {
      if (blockLabel(cfg, date, sp, h)) throw new BookingError('BLOCKED', `${formatKoreanDate(date)}은 예약할 수 없습니다.`);
    }
  }

  if (!admin) {
    const hourBucket = Math.floor(nowMs / HOUR_MS);
    await rateLimit(store, `rl:ip:${sha(ctx.ip || 'unknown')}:${hourBucket}`, 10, 3600, '요청이 많습니다. 잠시 후 다시 시도하세요.');
    await rateLimit(store, `rl:ph:${sha(phone)}`, 3, DAY_SEC, '같은 번호로는 하루에 3건까지 예약할 수 있습니다.');
  }

  const id = randomId(8);
  const rec = {
    id, date, start, end, spaces, name, phone, people, purpose,
    amount: q.total, status: 'pending', createdAt: nowMs, holdUntil: nowMs + cfg.holdHours * HOUR_MS,
  };
  if (admin) {
    rec.source = 'admin';
    if (raw.confirmed) { rec.status = 'confirmed'; rec.confirmedAt = nowMs; rec.holdUntil = null; }
  }
  const ttlSec = Math.ceil((kstEpoch(date, end) - nowMs) / 1000) + 3 * DAY_SEC;

  // 기록을 먼저 쓰고 슬롯을 잡습니다. 슬롯 소유자의 기록이 없으면 낡은 것으로 보고 치우기 때문입니다.
  await store.set(`res:${id}`, JSON.stringify(rec), ttlSec + 30 * DAY_SEC);
  const ok = await claimSlots(store, id, slotKeysFor(rec), ttlSec, nowMs);
  if (!ok) {
    await store.del([`res:${id}`]);
    throw new BookingError('CONFLICT', '선택한 시간에 이미 예약이 있습니다. 예약 현황을 확인하세요.', 409);
  }
  await store.zadd('idx', ymdNum(date), id);
  await logEvent(store, nowMs, { id, action: admin ? 'admin_created' : 'created', by: admin ? 'admin' : 'user', note: admin && raw.confirmed ? '관리자가 직접 등록(확정)' : admin ? '관리자가 직접 등록' : '', rec: snap(rec) });
  return { rec, quote: q };
}

export async function listRange(store, from, to, nowMs, { all = false } = {}) {
  const ids = await store.zrangebyscore('idx', ymdNum(from), ymdNum(to));
  if (!ids.length) return [];
  const raw = await store.mget(ids.map((i) => `res:${i}`));
  const out = [];
  const missing = [];
  raw.forEach((r, i) => {
    const rec = parseRec(r);
    if (rec) out.push(rec); else missing.push(ids[i]);
  });
  await Promise.all(missing.map((id) => store.zrem('idx', id)));
  return all ? out : out.filter((rec) => isActive(rec, nowMs));
}

// 화면에 보내는 현황. 이름, 연락처 같은 개인정보는 넣지 않습니다.
export async function publicAvailability(store, from, to, nowMs) {
  const recs = await listRange(store, from, to, nowMs);
  return recs.map((r) => ({
    date: r.date, start: r.start, end: r.end, spaces: r.spaces,
    status: effectiveStatus(r, nowMs) === 'confirmed' ? 'confirmed' : 'pending',
  }));
}

export async function adminList(store, nowMs) {
  const today = todayKst(nowMs);
  const recs = await listRange(store, addDays(today, -120), addDays(today, 400), nowMs, { all: true });
  return recs
    .map((r) => ({ ...r, status: effectiveStatus(r, nowMs) }))
    .sort((a, b) => (a.date + String(a.start).padStart(2, '0')).localeCompare(b.date + String(b.start).padStart(2, '0')));
}

export async function confirmReservation(store, id, nowMs = Date.now(), note = '') {
  const rec = parseRec(await store.get(`res:${id}`));
  if (!rec) throw new BookingError('NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
  if (rec.status === 'canceled') throw new BookingError('CANCELED', '취소된 예약입니다.', 409);
  if (rec.status === 'confirmed') return rec;
  const ttlSec = Math.ceil((kstEpoch(rec.date, rec.end) - nowMs) / 1000) + 3 * DAY_SEC;
  // 기한이 지난 예약도 슬롯이 비어 있으면 다시 잡아서 확정합니다.
  const ok = await claimSlots(store, id, slotKeysFor(rec), Math.max(ttlSec, 3600), nowMs);
  if (!ok) throw new BookingError('CONFLICT', '그 시간에 이미 다른 예약이 있어 확정할 수 없습니다.', 409);
  rec.status = 'confirmed';
  rec.confirmedAt = nowMs;
  rec.holdUntil = null;
  await store.set(`res:${id}`, JSON.stringify(rec), Math.max(ttlSec, 3600) + 30 * DAY_SEC);
  await store.zadd('idx', ymdNum(rec.date), id);
  await logEvent(store, nowMs, { id, action: 'confirmed', by: 'admin', note, rec: snap(rec) });
  return rec;
}

export async function cancelReservation(store, id, nowMs = Date.now(), note = '', by = 'admin') {
  const rec = parseRec(await store.get(`res:${id}`));
  if (!rec) throw new BookingError('NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
  await releaseOwned(store, id, slotKeysFor(rec));
  rec.status = 'canceled';
  rec.canceledAt = nowMs;
  delete rec.cancelRequest;
  await store.set(`res:${id}`, JSON.stringify(rec), 60 * DAY_SEC);
  await logEvent(store, nowMs, { id, action: 'canceled', by, note, rec: snap(rec) });
  return rec;
}

export async function setMemo(store, id, memo, nowMs = Date.now()) {
  const rec = parseRec(await store.get(`res:${id}`));
  if (!rec) throw new BookingError('NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
  rec.memo = cleanText(memo, 300);
  const ttlSec = rec.status === 'canceled' ? 60 * DAY_SEC : Math.max(Math.ceil((kstEpoch(rec.date, rec.end) - nowMs) / 1000) + 3 * DAY_SEC, 3600) + 30 * DAY_SEC;
  await store.set(`res:${id}`, JSON.stringify(rec), ttlSec);
  await logEvent(store, nowMs, { id, action: 'memo', by: 'admin', note: rec.memo, rec: snap(rec) });
  return rec;
}

// ---- 예약자 본인 조회와 취소 ----
export async function findForUser(store, id, phone, ctx) {
  await rateLimit(store, `rl:lk:${sha(ctx.ip || 'unknown')}:${Math.floor(ctx.nowMs / HOUR_MS)}`, 30, 3600, '조회 요청이 많습니다. 잠시 후 다시 시도하세요.');
  const rec = parseRec(await store.get(`res:${String(id || '').trim().toUpperCase()}`));
  const p = normalizePhone(phone);
  if (!rec || !p || rec.phone !== p) throw new BookingError('NOT_FOUND', '예약번호와 휴대전화 번호가 일치하는 예약이 없습니다.', 404);
  return rec;
}

export const userView = (rec, nowMs) => ({
  id: rec.id, date: rec.date, start: rec.start, end: rec.end, spaces: rec.spaces, name: rec.name, people: rec.people,
  amount: rec.amount, status: effectiveStatus(rec, nowMs), holdUntil: rec.holdUntil || null, cancelRequested: Boolean(rec.cancelRequest),
});

const keepTtl = (rec, nowMs) => Math.max(Math.ceil((kstEpoch(rec.date, rec.end) - nowMs) / 1000) + 3 * DAY_SEC, 3600) + 30 * DAY_SEC;

// 입금 전 예약은 바로 취소하고, 입금이 확인된 예약은 취소 요청으로 접수합니다(환불은 담당자가 처리).
export async function userCancel(store, rec, reason, nowMs) {
  const note = cleanText(reason, 200);
  const st = effectiveStatus(rec, nowMs);
  if (st === 'canceled') throw new BookingError('CANCELED', '이미 취소된 예약입니다.', 409);
  if (st !== 'confirmed') {
    await cancelReservation(store, rec.id, nowMs, note || '예약자가 취소', 'user');
    return { mode: 'canceled' };
  }
  if (rec.cancelRequest) return { mode: 'requested' };
  rec.cancelRequest = { at: nowMs, reason: note };
  await store.set(`res:${rec.id}`, JSON.stringify(rec), keepTtl(rec, nowMs));
  await logEvent(store, nowMs, { id: rec.id, action: 'cancel_requested', by: 'user', note, rec: snap(rec) });
  return { mode: 'requested' };
}

export async function dismissCancelRequest(store, id, nowMs) {
  const rec = parseRec(await store.get(`res:${id}`));
  if (!rec) throw new BookingError('NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
  delete rec.cancelRequest;
  await store.set(`res:${id}`, JSON.stringify(rec), keepTtl(rec, nowMs));
  await logEvent(store, nowMs, { id, action: 'cancel_dismissed', by: 'admin', note: '취소 요청을 반려', rec: snap(rec) });
}
