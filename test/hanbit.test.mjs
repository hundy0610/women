import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../lib/store-memory.js';
import { createClub } from '../lib/crew.js';
import { CREW, allSlots } from '../public/shared/crew-config.mjs';
import { HANBIT } from '../public/shared/hanbit-config.mjs';
import { BookingError } from '../lib/booking.js';
import { kstEpoch } from '../public/shared/time.mjs';

const NOW = kstEpoch('2026-10-27', 12); // 화요일 12:00
const hanbit = createClub(HANBIT);
const crew = createClub(CREW);
let n = 0;
const app = (o = {}) => ({ slot: 'knit-6-1100', start: '2026-10-31', name: '박한빛', phone: `010-3000-${String(4000 + n++)}`, gender: 'f', dong: '일산동', agree: true, ...o });
const ctx = () => ({ nowMs: NOW, ip: `7.7.7.${n}` });
const code = async (p) => { try { await p; return null; } catch (e) { assert.ok(e instanceof BookingError, e.stack); return e.code; } };

test('한빛 설정: 슬롯 ID가 겹치지 않고, 요일과 시간 형식이 올바르다', () => {
  const slots = allSlots(HANBIT);
  assert.ok(slots.length > 40);
  assert.equal(new Set(slots.map((s) => s.id)).size, slots.length);
  for (const s of slots) { assert.ok(s.weekday >= 0 && s.weekday <= 6); assert.match(s.time, /^\d{2}:\d{2}$/); }
  const names = HANBIT.programs.map((p) => p.name);
  assert.equal(new Set(names).size, names.length); // 같은 이름은 한 장의 카드로 묶음
  assert.ok(HANBIT.programs.find((p) => p.id === 'violin').flexible);
});

test('한빛 설정: 지역 이름이 화면에 쓰이는 값에 들어 있지 않다', () => {
  const text = JSON.stringify(HANBIT.programs.map((p) => [p.name, p.note]));
  for (const region of ['사랑', '화평', '진실', '자비', '믿음', '소망', '중앙']) assert.ok(!text.includes(`${region} 지역`), region);
});

test('한빛 신청: 저장되고 같은 이름의 다른 포털(마두)과 섞이지 않는다', async () => {
  const store = createMemoryStore();
  const { rec } = await hanbit.applyCrew(store, app(), ctx());
  assert.equal(rec.status, 'pending');
  assert.equal((await hanbit.listCrew(store, NOW)).length, 1);
  assert.equal((await crew.listCrew(store, NOW)).length, 0);
  assert.equal(Object.keys(await crew.crewUsage(store, NOW)).length, 0);
  assert.ok(Object.keys(await hanbit.crewUsage(store, NOW)).length > 0);
});

test('같은 요일·시간·소모임 슬롯 ID를 써도 포털별로 정원이 따로 센다', async () => {
  const store = createMemoryStore();
  // knit-4-1100 은 마두와 한빛 모두에 있습니다.
  for (let i = 0; i < CREW.capacity; i++) await crew.applyCrew(store, app({ slot: 'knit-4-1100', start: '2026-10-29' }), ctx());
  assert.equal(await code(crew.applyCrew(store, app({ slot: 'knit-4-1100', start: '2026-10-29' }), ctx())), 'FULL');
  assert.equal(await code(hanbit.applyCrew(store, app({ slot: 'knit-4-1100', start: '2026-10-29' }), ctx())), null);
});

test('한빛에는 없는 슬롯(마두 전용)과 일정이 유동적인 바이올린은 신청할 수 없다', async () => {
  const store = createMemoryStore();
  assert.equal(await code(hanbit.applyCrew(store, app({ slot: 'soap-2-1100', start: '2026-11-03' }), ctx())), 'SLOT');
  assert.equal(await code(hanbit.applyCrew(store, app({ slot: 'violin-6-1300', start: '2026-10-31' }), ctx())), 'SLOT');
});
