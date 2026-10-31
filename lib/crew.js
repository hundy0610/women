// 소모임(동아리) 신청 로직. 대관과 같은 저장소를 쓰되 키 이름이 겹치지 않도록 cr:/cs:/cidx 접두어를 씁니다.
// 자리(정원)는 "요일·시간 칸 × 날짜 × 자리번호" 키를 한 번에 선점하는 방식이라 동시에 신청해도 정원을 넘지 않습니다.
import { CREW, findProgram, findSlot, allSlots } from '../public/shared/crew-config.mjs';
import { periodEnd, sessionsBetween, firstOnOrAfter } from '../public/shared/crew-rules.mjs';
import { parseYmd, addDays, todayKst, ymdNum } from '../public/shared/time.mjs';
import { BookingError, normalizePhone } from './booking.js';
import { randomId, sha } from './util.js';
import { cleanId } from './security.js';

const HOUR_MS = 3600 * 1000;
const DAY_SEC = 86400;

const parseRec = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const seatKey = (slot, date, n) => `cs:${slot}:${date}:${n}`;
const seatKeys = (slot, dates, n) => dates.map((d) => seatKey(slot, d, n));

// 상태: canceled(취소) / pending(입금 대기) / expired(입금 기한 지남) / active(이용 중) / expiring(곧 만료) / ended(기간 끝, 연장 필요)
export function crewStatus(rec, nowMs, cfg = CREW) {
  if (rec.status === 'canceled') return 'canceled';
  if (rec.status !== 'confirmed') return rec.holdUntil && rec.holdUntil > nowMs ? 'pending' : 'expired';
  const today = todayKst(nowMs);
  if (today > rec.periodEnd) return 'ended';
  return addDays(today, cfg.expiringDays) >= rec.periodEnd ? 'expiring' : 'active';
}
const holdsSeat = (rec, nowMs) => ['pending', 'active', 'expiring', 'ended'].includes(crewStatus(rec, nowMs)) && rec.status !== 'canceled';

const ttlFor = (rec) => Math.max(Math.ceil((Date.parse(`${rec.periodEnd}T00:00:00Z`) - Date.now()) / 1000), 0) + 150 * DAY_SEC;

async function save(store, rec) {
  await store.set(`cr:${rec.id}`, JSON.stringify(rec), rec.status === 'canceled' ? 60 * DAY_SEC : ttlFor(rec));
}
const pushEvent = (rec, nowMs, text) => { (rec.events ||= []).push({ t: nowMs, text }); if (rec.events.length > 30) rec.events.shift(); };

async function releaseOwned(store, id, keys) {
  if (!keys.length) return;
  const owners = await store.mget(keys);
  const mine = keys.filter((k, i) => owners[i] === id);
  if (mine.length) await store.del(mine);
}

// 키를 한 번에 선점합니다. 소유자가 취소·기한 만료된 키는 치우고 다시 시도합니다.
async function claim(store, id, keys, ttlSec, nowMs) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const owners = await store.mget(keys);
    const needed = keys.filter((k, i) => owners[i] !== id);
    if (!needed.length) return true;
    if (await store.msetnx(Object.fromEntries(needed.map((k) => [k, id])), ttlSec)) return true;

    const cur = await store.mget(needed);
    const ownerIds = [...new Set(cur.filter(Boolean).map(String))];
    const recs = (await store.mget(ownerIds.map((o) => `cr:${o}`))).map(parseRec);
    let freed = false;
    for (let i = 0; i < ownerIds.length; i++) {
      if (recs[i] && holdsSeat(recs[i], nowMs)) continue;
      await releaseOwned(store, ownerIds[i], needed.filter((k, j) => String(cur[j]) === ownerIds[i]));
      freed = true;
    }
    if (!freed) return false;
  }
  return false;
}

async function claimAnySeat(store, id, slot, dates, nowMs, prefer = null) {
  const order = [...Array(slot.capacity).keys()];
  if (prefer != null && order.includes(prefer)) order.sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : 0));
  const ttl = Math.ceil((Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) - nowMs) / 1000) + 5 * DAY_SEC;
  for (const n of order) {
    if (await claim(store, id, seatKeys(slot.id, dates, n), Math.max(ttl, 3600), nowMs)) return n;
  }
  return null;
}

async function rateLimit(store, key, limit, ttlSec, message) {
  const n = await store.incr(key, ttlSec);
  if (n > limit) throw new BookingError('RATE_LIMIT', message, 429);
}

const GENDERS = ['f', 'm'];

export async function applyCrew(store, raw, ctx = {}) {
  const cfg = ctx.cfg || CREW;
  const nowMs = ctx.nowMs ?? Date.now();
  const admin = ctx.admin === true;
  if (!admin && raw.website) throw new BookingError('BOT', '요청을 처리할 수 없습니다.');

  const slot = findSlot(String(raw.slot || ''), cfg);
  if (!slot) throw new BookingError('SLOT', '소모임과 요일·시간을 다시 골라 주세요.');
  const program = findProgram(slot.programId, cfg);

  const start = String(raw.start || '');
  const sp = parseYmd(start);
  if (!sp) throw new BookingError('DATE', '시작하실 날짜를 선택하세요.');
  if (sp.dow !== slot.weekday) throw new BookingError('DATE', '선택한 요일에 맞는 날짜를 골라 주세요.');
  const today = todayKst(nowMs);
  if (!admin && start < addDays(today, cfg.leadDays)) throw new BookingError('LEAD', '시작일은 내일부터 고를 수 있어요.');
  if (!admin && start > addDays(today, cfg.horizonDays)) throw new BookingError('HORIZON', `오늘부터 ${cfg.horizonDays}일 안의 날짜만 고를 수 있어요.`);

  const name = cleanText(raw.name, 20);
  if (name.length < 2) throw new BookingError('NAME', '이름을 2자 이상 입력하세요.');
  const phone = normalizePhone(raw.phone);
  if (!phone) throw new BookingError('PHONE', '휴대전화 번호를 확인하세요.');
  const gender = String(raw.gender || '');
  if (!GENDERS.includes(gender)) throw new BookingError('GENDER', '성별을 골라 주세요.');
  let age = null;
  if (raw.age !== undefined && raw.age !== null && String(raw.age).trim() !== '') {
    age = Number(raw.age);
    if (!Number.isInteger(age) || age < 10 || age > 120) throw new BookingError('AGE', '나이를 숫자로 확인해 주세요. 비워 두셔도 돼요.');
  }
  const dong = cleanText(raw.dong, 20);
  if (dong.length < 2) throw new BookingError('DONG', '사시는 지역(동)을 알려 주세요.');
  if (!admin && raw.agree !== true) throw new BookingError('AGREE', '신청 내용 확인에 체크해 주세요.');

  const end = periodEnd(start, cfg.periodMonths);
  const dates = sessionsBetween(start, end, slot.weekday);

  // 같은 번호가 같은 칸에 이미 신청한 경우
  const existing = await listCrew(store, nowMs);
  if (existing.some((r) => r.phone === phone && r.slot === slot.id && ['pending', 'active', 'expiring'].includes(r.status))) {
    throw new BookingError('DUPLICATE', '이미 같은 소모임에 신청하셨어요. 내 신청에서 확인해 주세요.', 409);
  }

  if (!admin) {
    await rateLimit(store, `rl:cip:${sha(ctx.ip || 'unknown')}:${Math.floor(nowMs / HOUR_MS)}`, 10, 3600, '요청이 많습니다. 잠시 후 다시 시도하세요.');
    await rateLimit(store, `rl:cph:${sha(phone)}`, 5, DAY_SEC, '같은 번호로는 하루에 5건까지 신청할 수 있어요.');
  }

  const id = randomId(8);
  const rec = {
    id, center: cfg.center.id, programId: program.id, slot: slot.id, weekday: slot.weekday, time: slot.time,
    name, phone, gender, age, dong,
    periodStart: start, periodEnd: end, sessions: dates, seat: null,
    amount: cfg.fee, status: 'pending', createdAt: nowMs, holdUntil: nowMs + cfg.holdHours * HOUR_MS, paidMonths: 0,
    source: admin ? 'admin' : 'web',
  };
  if (admin && raw.confirmed) { rec.status = 'confirmed'; rec.confirmedAt = nowMs; rec.holdUntil = null; rec.paidMonths = 1; }
  if (admin && raw.amount !== undefined && raw.amount !== null && raw.amount !== '') {
    const a = Number(raw.amount);
    if (!Number.isInteger(a) || a < 0 || a > 10000000) throw new BookingError('AMOUNT', '금액을 0원 이상의 숫자로 입력하세요.');
    rec.amount = a;
  }
  pushEvent(rec, nowMs, admin ? (rec.status === 'confirmed' ? '관리자가 직접 등록(확정)' : '관리자가 직접 등록') : '신청');

  await save(store, rec);
  const seat = await claimAnySeat(store, id, slot, dates, nowMs);
  if (seat == null) {
    await store.del([`cr:${id}`]);
    throw new BookingError('FULL', '이 시간은 자리가 모두 찼어요. 다른 요일이나 시간을 골라 주세요.', 409);
  }
  rec.seat = seat;
  await save(store, rec);
  await store.zadd('cidx', ymdNum(start), id);
  return { rec };
}

export async function listCrew(store, nowMs) {
  const ids = await store.zrangebyscore('cidx', 0, 99999999);
  if (!ids.length) return [];
  const raw = await store.mget(ids.map((i) => `cr:${i}`));
  const out = [];
  const missing = [];
  raw.forEach((r, i) => {
    const rec = parseRec(r);
    if (rec) out.push({ ...rec, status: crewStatus(rec, nowMs), stored: rec.status }); else missing.push(ids[i]);
  });
  await Promise.all(missing.map((id) => store.zrem('cidx', id)));
  return out;
}

// 화면에 보내는 자리 현황: 요일·시간 칸별로 날짜마다 몇 명이 자리를 잡았는지. 개인정보는 넣지 않습니다.
export async function crewUsage(store, nowMs) {
  const used = {};
  for (const r of await listCrew(store, nowMs)) {
    if (!['pending', 'active', 'expiring'].includes(r.status)) continue;
    for (const d of r.sessions) { const k = `${r.slot}|${d}`; used[k] = (used[k] || 0) + 1; }
  }
  return used;
}

const load = async (store, id) => {
  const cid = cleanId(id);
  const rec = cid ? parseRec(await store.get(`cr:${cid}`)) : null;
  if (!rec) throw new BookingError('NOT_FOUND', '신청 내역을 찾을 수 없습니다.', 404);
  return rec;
};

export async function confirmCrew(store, id, nowMs) {
  const rec = await load(store, id);
  if (rec.status === 'canceled') throw new BookingError('CANCELED', '취소된 신청입니다.', 409);
  if (rec.status === 'confirmed') return rec;
  const slot = findSlot(rec.slot);
  // 기한이 지난 신청도 자리가 비어 있으면 다시 확정합니다.
  const seat = await claimAnySeat(store, rec.id, slot, rec.sessions, nowMs, rec.seat);
  if (seat == null) throw new BookingError('FULL', '그 사이 자리가 모두 차서 확정할 수 없어요.', 409);
  rec.seat = seat;
  rec.status = 'confirmed'; rec.confirmedAt = nowMs; rec.holdUntil = null; rec.paidMonths = (rec.paidMonths || 0) + 1;
  pushEvent(rec, nowMs, '입금 확인, 확정');
  await save(store, rec);
  return rec;
}

// 한 달 더 연장(입금 확인 뒤). 새 기간은 이전 기간 다음 첫 수업일(이미 지났다면 오늘 이후 첫 수업일)부터 시작합니다.
export async function renewCrew(store, id, nowMs) {
  const rec = await load(store, id);
  if (rec.status !== 'confirmed') throw new BookingError('STATE', '확정된 신청만 연장할 수 있어요.', 409);
  const slot = findSlot(rec.slot);
  const from = addDays(rec.periodEnd, 1) > todayKst(nowMs) ? addDays(rec.periodEnd, 1) : todayKst(nowMs);
  const start = firstOnOrAfter(from, slot.weekday);
  const end = periodEnd(start, CREW.periodMonths);
  const dates = sessionsBetween(start, end, slot.weekday);
  const seat = await claimAnySeat(store, rec.id, slot, dates, nowMs, rec.seat);
  if (seat == null) throw new BookingError('FULL', '연장 기간에 자리가 모두 차서 연장할 수 없어요.', 409);
  rec.periodStart = start; rec.periodEnd = end; rec.sessions = dates; rec.seat = seat;
  rec.paidMonths = (rec.paidMonths || 0) + 1; rec.remindedAt = null; rec.reminders = {};
  pushEvent(rec, nowMs, `연장 확정 (${start} ~ ${end})`);
  await store.zadd('cidx', ymdNum(start), rec.id);
  await save(store, rec);
  return rec;
}

export async function cancelCrew(store, id, nowMs, by = 'admin', note = '') {
  const rec = await load(store, id);
  await releaseOwned(store, rec.id, seatKeys(rec.slot, rec.sessions, rec.seat ?? 0));
  rec.status = 'canceled'; rec.canceledAt = nowMs; delete rec.cancelRequest;
  pushEvent(rec, nowMs, `${by === 'user' ? '신청자가' : '관리자가'} 취소${note ? `: ${note}` : ''}`);
  await save(store, rec);
  return rec;
}

// stage: 'expiring'(곧 만료) | 'ended'(기간 끝남). 자동 발송이 같은 안내를 반복하지 않도록 단계별로 한 번만 기록합니다.
// 문자를 보낸 결과를 신청 기록에 남깁니다(관리자 화면에서 확인용). 결과: sent(접수됨) / test(테스트 신청이라 건너뜀) / off(문자 설정 꺼짐) / failed(실패)
export async function recordSms(store, id, nowMs, label, result) {
  try {
    const rec = await load(store, id);
    const status = result?.ok ? 'sent' : result?.test ? 'test' : result?.skipped ? 'off' : 'failed';
    const text = { sent: '발송 접수됨', test: '건너뜀 (테스트 신청)', off: '건너뜀 (문자 설정 꺼짐)', failed: `실패${result?.error ? ` — ${String(result.error).slice(0, 80)}` : ''}` }[status];
    rec.sms = { label, status, at: nowMs };
    pushEvent(rec, nowMs, `${label}: ${text}`);
    await save(store, rec);
  } catch { /* 기록 실패가 신청 처리에 영향을 주지 않도록 합니다 */ }
}

export async function markReminded(store, id, nowMs, stage = null, auto = false) {
  const rec = await load(store, id);
  rec.remindedAt = nowMs;
  if (stage) (rec.reminders ||= {})[stage] = nowMs;
  pushEvent(rec, nowMs, `연장 안내 문자 ${auto ? '자동 ' : ''}발송${stage ? ` (${stage === 'ended' ? '기간 끝남' : '곧 만료'})` : ''}`);
  await save(store, rec);
}

export async function setCrewMemo(store, id, memo, nowMs) {
  const rec = await load(store, id);
  rec.memo = cleanText(memo, 300);
  await save(store, rec);
  return rec;
}

// ---- 신청자 본인 조회/취소 ----
export async function findForApplicant(store, id, phone, ctx) {
  await rateLimit(store, `rl:clk:${sha(ctx.ip || 'unknown')}:${Math.floor(ctx.nowMs / HOUR_MS)}`, 30, 3600, '조회 요청이 많습니다. 잠시 후 다시 시도하세요.');
  const cid = cleanId(id);
  const rec = cid ? parseRec(await store.get(`cr:${cid}`)) : null;
  const p = normalizePhone(phone);
  if (!rec || !p || rec.phone !== p) throw new BookingError('NOT_FOUND', '신청번호와 휴대전화 번호가 일치하는 신청이 없습니다.', 404);
  return rec;
}

export const applicantView = (rec, nowMs) => ({
  id: rec.id, programId: rec.programId, slot: rec.slot, weekday: rec.weekday, time: rec.time, name: rec.name,
  periodStart: rec.periodStart, periodEnd: rec.periodEnd, sessions: rec.sessions.length,
  amount: rec.amount, status: crewStatus(rec, nowMs), holdUntil: rec.holdUntil || null, cancelRequested: Boolean(rec.cancelRequest),
});

export async function applicantCancel(store, rec, reason, nowMs) {
  const st = crewStatus(rec, nowMs);
  if (st === 'canceled') throw new BookingError('CANCELED', '이미 취소된 신청입니다.', 409);
  if (st === 'pending' || st === 'expired') { await cancelCrew(store, rec.id, nowMs, 'user', cleanText(reason, 200)); return { mode: 'canceled' }; }
  if (rec.cancelRequest) return { mode: 'requested' };
  rec.cancelRequest = { at: nowMs, reason: cleanText(reason, 200) };
  pushEvent(rec, nowMs, `취소 요청${rec.cancelRequest.reason ? `: ${rec.cancelRequest.reason}` : ''}`);
  await save(store, rec);
  return { mode: 'requested' };
}

// 오늘 연장 안내를 보내야 하는 신청: 곧 만료(7일 전부터) 1회, 기간이 끝난 뒤 1회(끝난 지 45일까지).
export async function dueReminders(store, nowMs) {
  const today = todayKst(nowMs);
  const out = [];
  for (const r of await listCrew(store, nowMs)) {
    if (r.cancelRequest) continue;
    const sent = r.reminders || {};
    if (r.status === 'expiring' && !sent.expiring) out.push({ rec: r, stage: 'expiring' });
    else if (r.status === 'ended' && !sent.ended && addDays(r.periodEnd, 45) >= today) out.push({ rec: r, stage: 'ended' });
  }
  return out;
}

export const slotsOf = () => allSlots();
