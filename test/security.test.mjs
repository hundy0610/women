import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, sameOrigin, hit, _resetLimits, cleanId } from '../lib/security.js';
import { SECURITY_HEADERS } from '../lib/security-headers.js';
import { createMemoryStore } from '../lib/store-memory.js';
import { findForApplicant } from '../lib/crew.js';
import { findForUser, BookingError } from '../lib/booking.js';

test('IP: 호스팅이 채운 헤더를 믿고, 사용자가 넣은 X-Forwarded-For 앞부분은 믿지 않는다', () => {
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 5.6.7.8' } }), '1.2.3.4');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 5.6.7.8' } }), '5.6.7.8'); // 가장 오른쪽
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1');
});

test('출처 확인: 다른 사이트에서 온 요청은 거절', () => {
  const h = (o) => ({ headers: { host: 'women-booking.onrender.com', ...o } });
  assert.equal(sameOrigin(h({})), true);
  assert.equal(sameOrigin(h({ origin: 'https://women-booking.onrender.com' })), true);
  assert.equal(sameOrigin(h({ origin: 'https://evil.example' })), false);
  assert.equal(sameOrigin(h({ origin: 'null' })), false);
  assert.equal(sameOrigin(h({ origin: 'https://women-booking.onrender.com.evil.example' })), false);
});

test('요청 제한: 창 안에서 한도를 넘으면 막고, 창이 지나면 풀린다', () => {
  _resetLimits();
  for (let i = 0; i < 3; i++) assert.equal(hit('k', 3, 1000, 0), true);
  assert.equal(hit('k', 3, 1000, 10), false);
  assert.equal(hit('k', 3, 1000, 1500), true);
  assert.equal(hit('other', 3, 1000, 10), true);
});

test('번호 형식: 영문 대문자·숫자 8자만 통과', () => {
  assert.equal(cleanId(' ab12cd34 '), 'AB12CD34');
  for (const bad of ['', 'short', 'ABCDEFGHI', 'AB12CD3*', 'AB 2CD34', 'res:AB12CD34', '../../x', null, undefined, { a: 1 }]) assert.equal(cleanId(bad), null);
});

test('엉뚱한 번호로 조회하면 저장소를 읽지 않고 찾을 수 없음으로 답한다', async () => {
  const reads = [];
  const store = createMemoryStore();
  const spy = { ...store, get: async (k) => { reads.push(k); return store.get(k); } };
  const ctx = { nowMs: Date.now(), ip: '1.1.1.1' };
  await assert.rejects(findForApplicant(spy, 'admin:pw', '010-1234-5678', ctx), (e) => e instanceof BookingError && e.code === 'NOT_FOUND');
  await assert.rejects(findForUser(spy, '../x', '010-1234-5678', ctx), (e) => e instanceof BookingError && e.code === 'NOT_FOUND');
  assert.deepEqual(reads, []);
});

test('보안 헤더: 필수 항목이 모두 있고 CSP가 스크립트를 제한한다', () => {
  for (const k of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) assert.ok(SECURITY_HEADERS[k], k);
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.ok(!/script-src[^;]*unsafe-(inline|eval)/.test(csp));
  assert.ok(csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && csp.includes("base-uri 'none'"));
});
