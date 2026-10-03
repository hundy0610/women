import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMemoryStore } from '../lib/store-memory.js';
import { createUpstashStore } from '../lib/store-upstash.js';
import { createReservation, publicAvailability, adminList, confirmReservation, cancelReservation, BookingError } from '../lib/booking.js';
import { todayKst, addDays, kstEpoch, dowOf } from '../public/shared/time.mjs';

const NOW = kstEpoch('2026-10-05', 12); // 월요일 12:00 KST
const day = (n) => addDays('2026-10-05', n);
// 일(0), 수(3)는 휴무이므로 월/화/목/금/토 중에서 고릅니다.
const OPEN_DAY = day(3);   // 목요일
const OPEN_DAY_2 = day(4); // 금요일

const base = (o = {}) => ({
  date: OPEN_DAY, start: 10, end: 14, spaces: ['seminar'],
  name: '홍길동', phone: '010-1234-5678', people: 20, purpose: '독서 모임', agree: true, ...o,
});
let phoneSeq = 0;
const fresh = (o = {}) => base({ phone: `010-0000-${String(1000 + phoneSeq++)}`, ...o });
const ctx = (extra = {}) => ({ nowMs: NOW, ip: '1.1.1.1' + phoneSeq, ...extra });
const code = async (p) => { try { await p; return null; } catch (e) { assert.ok(e instanceof BookingError, e.stack); return e.code; } };

test('요일 가정 확인', () => {
  assert.equal(dowOf(OPEN_DAY), 4);
  assert.equal(dowOf(day(1)), 2);
  assert.equal(dowOf(day(2)), 3);
});

test('예약 생성과 현황 노출(개인정보 없음)', async () => {
  const store = createMemoryStore();
  const { rec } = await createReservation(store, fresh(), ctx());
  assert.equal(rec.amount, 120000);
  const items = await publicAvailability(store, OPEN_DAY, OPEN_DAY, NOW);
  assert.equal(items.length, 1);
  assert.deepEqual(Object.keys(items[0]).sort(), ['date', 'end', 'spaces', 'start', 'status']);
  assert.equal(items[0].status, 'pending');
});

test('같은 공간 겹치는 시간은 거절, 맞닿는 시간은 허용', async () => {
  const store = createMemoryStore();
  await createReservation(store, fresh({ start: 10, end: 14 }), ctx());
  assert.equal(await code(createReservation(store, fresh({ start: 13, end: 16 }), ctx())), 'CONFLICT');
  assert.equal(await code(createReservation(store, fresh({ start: 9, end: 11 }), ctx())), 'CONFLICT');
  assert.equal(await code(createReservation(store, fresh({ start: 14, end: 17 }), ctx())), null);
  assert.equal(await code(createReservation(store, fresh({ start: 10, end: 14, spaces: ['lobby'] }), ctx())), null);
  assert.equal(await code(createReservation(store, fresh({ date: OPEN_DAY_2, start: 10, end: 14 }), ctx())), null);
});

test('전체 패키지는 개별 공간 예약과 겹치면 거절', async () => {
  const store = createMemoryStore();
  await createReservation(store, fresh({ spaces: ['room2'], start: 12, end: 15 }), ctx());
  const all = ['lobby', 'seminar', 'room1', 'room2', 'room3'];
  assert.equal(await code(createReservation(store, fresh({ spaces: all, start: 9, end: 17 }), ctx())), 'CONFLICT');
  // 실패한 예약이 슬롯을 남기지 않아야 한다
  assert.equal(await code(createReservation(store, fresh({ spaces: ['lobby'], start: 12, end: 15 }), ctx())), null);
  assert.equal(await code(createReservation(store, fresh({ spaces: all, start: 9, end: 17, date: OPEN_DAY_2 }), ctx())), null);
});

test('동시에 20건 요청해도 한 건만 성공', async () => {
  const store = createMemoryStore();
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    createReservation(store, fresh({ name: `사용자${i}` }), ctx({ ip: `9.9.9.${i}` })).then(() => 'ok', (e) => e.code)));
  assert.equal(results.filter((r) => r === 'ok').length, 1);
  assert.equal(results.filter((r) => r === 'CONFLICT').length, 19);
});

test('입금 기한이 지난 예약은 자리를 비운다', async () => {
  const store = createMemoryStore();
  await createReservation(store, fresh(), ctx());
  const later = NOW + 25 * 3600 * 1000;
  assert.equal((await publicAvailability(store, OPEN_DAY, OPEN_DAY, later)).length, 0);
  assert.equal(await code(createReservation(store, fresh(), ctx({ nowMs: later }))), null);
});

test('관리자 확정은 만료되지 않고, 취소하면 자리가 풀린다', async () => {
  const store = createMemoryStore();
  const { rec } = await createReservation(store, fresh(), ctx());
  await confirmReservation(store, rec.id, NOW);
  const later = NOW + 25 * 3600 * 1000; // 입금 기한(24시간)이 지난 시점
  const items = await publicAvailability(store, OPEN_DAY, OPEN_DAY, later);
  assert.equal(items[0].status, 'confirmed');
  assert.equal(await code(createReservation(store, fresh(), ctx({ nowMs: later }))), 'CONFLICT');
  await cancelReservation(store, rec.id, later);
  assert.equal(await code(createReservation(store, fresh(), ctx({ nowMs: later }))), null);
  const list = await adminList(store, later);
  assert.ok(list.some((r) => r.id === rec.id && r.status === 'canceled'));
});

test('만료된 예약도 자리가 비어 있으면 다시 확정할 수 있다', async () => {
  const store = createMemoryStore();
  const { rec } = await createReservation(store, fresh(), ctx());
  const later = NOW + 30 * 3600 * 1000;
  await confirmReservation(store, rec.id, later);
  assert.equal((await publicAvailability(store, OPEN_DAY, OPEN_DAY, later))[0].status, 'confirmed');
});

test('검증: 막힌 요일, 24시간 규칙, 90일, 입력값', async () => {
  const store = createMemoryStore();
  assert.equal(await code(createReservation(store, fresh({ date: day(13) }), ctx())), 'BLOCKED'); // 일요일
  assert.equal(await code(createReservation(store, fresh({ date: day(9) }), ctx())), 'BLOCKED'); // 다음 주 수
  assert.equal(await code(createReservation(store, fresh({ date: day(0), start: 15, end: 18 }), ctx())), 'LEAD');
  assert.equal(await code(createReservation(store, fresh({ date: day(100) }), ctx())), 'HORIZON');
  assert.equal(await code(createReservation(store, fresh({ name: '가' }), ctx())), 'NAME');
  assert.equal(await code(createReservation(store, fresh({ phone: '02-123-4567' }), ctx())), 'PHONE');
  assert.equal(await code(createReservation(store, fresh({ people: 0 }), ctx())), 'PEOPLE');
  assert.equal(await code(createReservation(store, fresh({ agree: false }), ctx())), 'AGREE');
  assert.equal(await code(createReservation(store, fresh({ start: 10, end: 11 }), ctx())), 'MIN_HOURS');
  assert.equal(await code(createReservation(store, fresh({ website: 'x' }), ctx())), 'BOT');
});

test('같은 번호는 하루 3건까지', async () => {
  const store = createMemoryStore();
  const mk = (h) => base({ start: h, end: h + 2, phone: '010-9999-0000' });
  for (const h of [9, 11, 13]) await createReservation(store, mk(h), ctx({ ip: `7.7.7.${h}` }));
  assert.equal(await code(createReservation(store, mk(15), ctx({ ip: '7.7.7.15' }))), 'RATE_LIMIT');
});

test('Upstash REST 어댑터로도 같은 결과', async () => {
  // 어댑터가 보내는 명령 형식을 확인하기 위한 최소한의 Redis 흉내 서버
  const kv = new Map(); const z = new Map();
  const run = ([c, ...a]) => {
    switch (c) {
      case 'GET': return kv.get(a[0]) ?? null;
      case 'MGET': return a.map((k) => kv.get(k) ?? null);
      case 'SET': kv.set(a[0], a[1]); return 'OK';
      case 'DEL': return a.filter((k) => kv.delete(k)).length;
      case 'MSETNX': { const ks = a.filter((_, i) => i % 2 === 0); if (ks.some((k) => kv.has(k))) return 0; for (let i = 0; i < a.length; i += 2) kv.set(a[i], a[i + 1]); return 1; }
      case 'EXPIRE': return 1;
      case 'INCR': { const n = Number(kv.get(a[0]) || 0) + 1; kv.set(a[0], String(n)); return n; }
      case 'ZADD': if (!z.has(a[0])) z.set(a[0], new Map()); z.get(a[0]).set(a[2], Number(a[1])); return 1;
      case 'ZREM': z.get(a[0])?.delete(a[1]); return 1;
      case 'ZRANGEBYSCORE': return [...(z.get(a[0]) || new Map()).entries()].filter(([, s]) => s >= +a[1] && s <= +a[2]).map(([m]) => m);
      default: throw new Error('unsupported ' + c);
    }
  };
  const server = http.createServer(async (req, res) => {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b);
    assert.equal(req.headers.authorization, 'Bearer tok');
    const out = req.url === '/pipeline' ? body.map((cmd) => ({ result: run(cmd) })) : { result: run(body) };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(out));
  });
  await new Promise((r) => server.listen(0, r));
  try {
    const store = createUpstashStore({ url: `http://127.0.0.1:${server.address().port}`, token: 'tok' });
    await createReservation(store, fresh(), ctx());
    assert.equal(await code(createReservation(store, fresh({ start: 12, end: 16 }), ctx())), 'CONFLICT');
    assert.equal(await code(createReservation(store, fresh({ start: 14, end: 18 }), ctx())), null);
    assert.equal((await publicAvailability(store, OPEN_DAY, OPEN_DAY, NOW)).length, 2);
  } finally { server.close(); }
});

test('이력: 생성, 확정, 취소, 메모가 순서대로 남는다', async () => {
  const { listLog } = await import('../lib/history.js');
  const { setMemo } = await import('../lib/booking.js');
  const store = createMemoryStore();
  const { rec } = await createReservation(store, fresh(), ctx());
  await confirmReservation(store, rec.id, NOW + 1000, '입금 확인');
  await setMemo(store, rec.id, '전화 문의 있음', NOW + 2000);
  await cancelReservation(store, rec.id, NOW + 3000, '본인 요청');
  const log = await listLog(store);
  assert.deepEqual(log.map((e) => e.action), ['canceled', 'memo', 'confirmed', 'created']);
  assert.equal(log[3].rec.name, '홍길동');
  assert.equal(log[2].note, '입금 확인');
});

test('관리자 직접 등록은 24시간 규칙과 횟수 제한을 건너뛰고, 중복은 막는다', async () => {
  const store = createMemoryStore();
  const mk = (o) => base({ date: day(0), start: 15, end: 18, agree: undefined, confirmed: true, ...o });
  const { rec } = await createReservation(store, mk({}), { nowMs: NOW, admin: true });
  assert.equal(rec.status, 'confirmed');
  assert.equal(rec.source, 'admin');
  assert.equal(await code(createReservation(store, mk({}), { nowMs: NOW, admin: true })), 'CONFLICT');
});

test('관리자 비밀번호: 초기값은 환경변수, 변경하면 저장소 값이 우선', async () => {
  const { checkPassword, changePassword } = await import('../lib/adminpw.js');
  const store = createMemoryStore();
  process.env.ADMIN_PASSWORD = 'init-pass';
  assert.equal(await checkPassword(store, 'init-pass'), true);
  assert.equal(await checkPassword(store, 'nope'), false);
  assert.equal(await code(changePassword(store, 'short')), 'PW_SHORT');
  await changePassword(store, 'new-password-1');
  assert.equal(await checkPassword(store, 'new-password-1'), true);
  assert.equal(await checkPassword(store, 'init-pass'), false);
});

test('관리자 휴관일: 예약이 막히고, 해제하면 다시 열린다', async () => {
  const { addBlock, removeBlock, configWith, getBlocks } = await import('../lib/blocks.js');
  const store = createMemoryStore();
  const { block } = await addBlock(store, { from: OPEN_DAY, to: OPEN_DAY, reason: '센터 행사' }, NOW);
  assert.equal(await code(createReservation(store, fresh(), ctx({ cfg: await configWith(store) }))), 'BLOCKED');
  await removeBlock(store, block.id, NOW);
  assert.equal((await getBlocks(store)).length, 0);
  assert.equal(await code(createReservation(store, fresh(), ctx({ cfg: await configWith(store) }))), null);
});

test('예약자 조회와 취소: 번호가 맞아야 보이고, 입금 전은 바로 취소, 확정은 요청으로 접수', async () => {
  const { findForUser, userCancel, userView, dismissCancelRequest } = await import('../lib/booking.js');
  const store = createMemoryStore();
  const { rec } = await createReservation(store, fresh({ phone: '010-7777-1111' }), ctx());
  const c = { nowMs: NOW, ip: '5.5.5.5' };
  assert.equal(await code(findForUser(store, rec.id, '010-0000-0000', c)), 'NOT_FOUND');
  const got = await findForUser(store, rec.id.toLowerCase(), '01077771111', c);
  assert.equal(userView(got, NOW).status, 'pending');
  assert.equal((await userCancel(store, got, '일정 변경', NOW)).mode, 'canceled');
  assert.equal(await code(createReservation(store, fresh(), ctx())), null);

  const { rec: r2 } = await createReservation(store, fresh({ phone: '010-7777-2222', date: OPEN_DAY_2 }), ctx());
  await confirmReservation(store, r2.id, NOW);
  const g2 = await findForUser(store, r2.id, '010-7777-2222', c);
  assert.equal((await userCancel(store, g2, '사정이 생김', NOW)).mode, 'requested');
  const g3 = await findForUser(store, r2.id, '010-7777-2222', c);
  assert.equal(userView(g3, NOW).status, 'confirmed');
  assert.equal(userView(g3, NOW).cancelRequested, true);
  await dismissCancelRequest(store, r2.id, NOW);
  assert.equal(userView(await findForUser(store, r2.id, '010-7777-2222', c), NOW).cancelRequested, false);
});
