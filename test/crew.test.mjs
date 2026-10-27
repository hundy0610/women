import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../lib/store-memory.js';
import { applyCrew, confirmCrew, renewCrew, cancelCrew, listCrew, crewUsage, crewStatus } from '../lib/crew.js';
import { BookingError } from '../lib/booking.js';
import { kstEpoch, addDays } from '../public/shared/time.mjs';
import { CREW } from '../public/shared/crew-config.mjs';
import { periodEnd, sessionsBetween, addMonths } from '../public/shared/crew-rules.mjs';

const NOW = kstEpoch('2026-10-27', 12); // 화요일 12:00 KST
const THU = '2026-10-29';               // 목요일
const code = async (p) => { try { await p; return null; } catch (e) { assert.ok(e instanceof BookingError, e.stack); return e.code; } };
let n = 0;
const app = (o = {}) => ({ slot: 'knit-4-1100', start: THU, name: '김미영', phone: `010-1000-${String(2000 + n++)}`, gender: 'f', age: 55, dong: '마두동', agree: true, ...o });
const ctx = (o = {}) => ({ nowMs: NOW, ip: `1.1.1.${n}`, ...o });

test('기간 계산: 한 달은 시작일 기준, 말일 보정', () => {
  assert.equal(periodEnd('2026-10-29'), '2026-11-28');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.deepEqual(sessionsBetween('2026-10-29', '2026-11-28', 4), ['2026-10-29', '2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
});

test('신청: 입금 대기로 만들고 자리를 잡는다', async () => {
  const store = createMemoryStore();
  const { rec } = await applyCrew(store, app(), ctx());
  assert.equal(rec.status, 'pending');
  assert.equal(rec.amount, 10000);
  assert.equal(rec.periodEnd, '2026-11-28');
  assert.equal(rec.sessions.length, 5);
  const used = await crewUsage(store, NOW);
  assert.equal(used['knit-4-1100|2026-10-29'], 1);
});

test('정원이 차면 다음 신청은 거절, 취소하면 자리가 열린다', async () => {
  const store = createMemoryStore();
  const ids = [];
  for (let i = 0; i < CREW.capacity; i++) ids.push((await applyCrew(store, app(), ctx())).rec.id);
  assert.equal(await code(applyCrew(store, app(), ctx())), 'FULL');
  await cancelCrew(store, ids[0], NOW);
  assert.equal(await code(applyCrew(store, app(), ctx())), null);
});

test('동시에 신청해도 정원을 넘지 않는다', async () => {
  const store = createMemoryStore();
  const res = await Promise.all(Array.from({ length: CREW.capacity + 5 }, () => code(applyCrew(store, app(), ctx()))));
  assert.equal(res.filter((c) => c === null).length, CREW.capacity);
  assert.equal(res.filter((c) => c === 'FULL').length, 5);
});

test('입금 기한이 지나면 자리가 비고, 같은 번호 중복 신청은 거절', async () => {
  const store = createMemoryStore();
  const a = app();
  await applyCrew(store, a, ctx());
  assert.equal(await code(applyCrew(store, { ...a }, ctx())), 'DUPLICATE');
  const later = NOW + 25 * 3600 * 1000;
  const used = await crewUsage(store, later);
  assert.equal(used['knit-4-1100|2026-10-29'], undefined);
  for (let i = 0; i < CREW.capacity; i++) await applyCrew(store, app(), ctx({ nowMs: later }));
});

test('검증: 요일, 시작일 범위, 성별, 나이, 동의', async () => {
  const store = createMemoryStore();
  assert.equal(await code(applyCrew(store, app({ start: '2026-10-30' }), ctx())), 'DATE');
  assert.equal(await code(applyCrew(store, app({ start: '2026-10-28' }), ctx())), 'DATE'); // 수요일은 슬롯 요일이 아님
  assert.equal(await code(applyCrew(store, app({ start: '2026-10-22' }), ctx())), 'LEAD'); // 과거 목요일
  assert.equal(await code(applyCrew(store, app({ start: '2027-01-14' }), ctx())), 'HORIZON'); // 60일 밖 목요일
  assert.equal(await code(applyCrew(store, app({ slot: 'nope' }), ctx())), 'SLOT');
  assert.equal(await code(applyCrew(store, app({ gender: 'x' }), ctx())), 'GENDER');
  assert.equal(await code(applyCrew(store, app({ age: 5 }), ctx())), 'AGE');
  assert.equal(await code(applyCrew(store, app({ age: '' }), ctx())), null);
  assert.equal(await code(applyCrew(store, app({ agree: false }), ctx())), 'AGREE');
  assert.equal(await code(applyCrew(store, app({ phone: '123' }), ctx())), 'PHONE');
  assert.equal(await code(applyCrew(store, app({ dong: '' }), ctx())), 'DONG');
});

test('확정 후 한 달이 지나면 연장 필요, 연장하면 다음 기간', async () => {
  const store = createMemoryStore();
  const { rec } = await applyCrew(store, app(), ctx());
  const c = await confirmCrew(store, rec.id, NOW);
  assert.equal(c.status, 'confirmed');
  assert.equal(crewStatus(c, NOW), 'active');
  assert.equal(crewStatus(c, kstEpoch('2026-11-22', 12)), 'expiring');
  const after = kstEpoch('2026-11-30', 12);
  assert.equal(crewStatus(c, after), 'ended');
  const r = await renewCrew(store, rec.id, after);
  assert.equal(r.periodStart, '2026-12-03'); // 오늘(11/30) 이후 첫 목요일
  assert.equal(r.periodEnd, '2027-01-02');
  assert.equal(r.paidMonths, 2);
  assert.equal((await listCrew(store, after))[0].status, 'active');
});

test('관리자 직접 등록: 확정과 금액 지정', async () => {
  const store = createMemoryStore();
  const { rec } = await applyCrew(store, app({ confirmed: true, amount: 5000, start: '2026-10-29' }), ctx({ admin: true }));
  assert.equal(rec.status, 'confirmed');
  assert.equal(rec.amount, 5000);
  assert.equal(await code(applyCrew(store, app({ amount: -1 }), ctx({ admin: true }))), 'AMOUNT');
});
