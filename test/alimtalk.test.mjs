import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authHeader, buildMessage, variablesFor, alimtalkEnabled, alimtalkStatus, sendPayGuide, sendPaidNotice } from '../lib/alimtalk.js';

const KEYS = ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER', 'KAKAO_PF_ID', 'ALIMTALK_TEMPLATE_PAY', 'ALIMTALK_TEMPLATE_PAID', 'BANK_NAME', 'BANK_NUMBER', 'BANK_HOLDER'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const clear = () => KEYS.forEach((k) => delete process.env[k]);
const setAll = () => Object.assign(process.env, {
  SOLAPI_API_KEY: 'KEY', SOLAPI_API_SECRET: 'SECRET', SOLAPI_SENDER: '02-1234-5678', KAKAO_PF_ID: 'PF1',
  ALIMTALK_TEMPLATE_PAY: 'TPL_PAY', ALIMTALK_TEMPLATE_PAID: 'TPL_PAID', BANK_NAME: '은행', BANK_NUMBER: '111-22-333', BANK_HOLDER: '센터',
});
const rec = { id: 'abc', name: '홍길동', phone: '010-1234-5678', date: '2026-10-22', start: 10, end: 13, spaces: ['seminar'], amount: 90000, holdUntil: Date.UTC(2026, 9, 20, 3, 0) };

test.afterEach(() => { clear(); Object.assign(process.env, Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined))); });

test('인증 헤더는 date+salt를 API Secret으로 HMAC-SHA256(hex) 서명한다', () => {
  const now = new Date('2026-10-19T00:00:00.000Z');
  const h = authHeader('KEY', 'SECRET', now, 'salt123');
  const sig = crypto.createHmac('sha256', 'SECRET').update('2026-10-19T00:00:00.000Zsalt123').digest('hex');
  assert.equal(h, `HMAC-SHA256 apiKey=KEY, date=2026-10-19T00:00:00.000Z, salt=salt123, signature=${sig}`);
});

test('설정이 없으면 꺼져 있고 아무것도 보내지 않는다', async () => {
  clear();
  assert.equal(alimtalkEnabled(), false);
  const orig = globalThis.fetch; let called = 0; globalThis.fetch = async () => { called++; return new Response('{}'); };
  try {
    assert.deepEqual(await sendPayGuide(rec), { ok: false, skipped: true });
    assert.equal(called, 0);
  } finally { globalThis.fetch = orig; }
});

test('메시지 형식: ATA, 숫자만 번호, #{변수}, 대체 문자 끔', () => {
  clear(); setAll();
  const m = buildMessage({ to: '010-1234-5678', templateId: 'T', variables: { name: '홍길동', amount: '9원' } });
  assert.equal(m.type, 'ATA'); assert.equal(m.to, '01012345678'); assert.equal(m.from, '0212345678');
  assert.deepEqual(m.kakaoOptions, { pfId: 'PF1', templateId: 'T', variables: { '#{name}': '홍길동', '#{amount}': '9원' }, disableSms: true });
});

test('변수에 일시, 공간, 금액, 계좌가 들어간다', () => {
  clear(); setAll();
  const v = variablesFor(rec);
  assert.equal(v.time, '10:00~13:00'); assert.equal(v.space, '세미나실'); assert.equal(v.amount, '90,000원');
  assert.equal(v.account, '111-22-333'); assert.match(v.deadline, /10월 20일/);
});

test('송금 안내와 완료는 각자의 템플릿으로 발송하고, 실패해도 던지지 않는다', async () => {
  clear(); setAll();
  assert.deepEqual(alimtalkStatus(), { enabled: true, pay: true, paid: true });
  const orig = globalThis.fetch; const bodies = [];
  globalThis.fetch = async (url, init) => { bodies.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };
  const origErr = console.error; console.error = () => {};
  try {
    assert.equal((await sendPayGuide(rec)).ok, true);
    assert.equal((await sendPaidNotice(rec)).ok, true);
    assert.equal(bodies[0].url, 'https://api.solapi.com/messages/v4/send');
    assert.equal(bodies[0].body.message.kakaoOptions.templateId, 'TPL_PAY');
    assert.equal(bodies[1].body.message.kakaoOptions.templateId, 'TPL_PAID');
    assert.match(bodies[0].auth, /^HMAC-SHA256 apiKey=KEY, date=/);
    globalThis.fetch = async () => new Response('bad', { status: 400 });
    assert.equal((await sendPayGuide(rec)).ok, false);
    globalThis.fetch = async () => { throw new Error('network'); };
    assert.equal((await sendPaidNotice(rec)).ok, false);
  } finally { globalThis.fetch = orig; console.error = origErr; }
});

test('템플릿 ID가 없으면 그 알림만 건너뛴다', async () => {
  clear(); setAll(); delete process.env.ALIMTALK_TEMPLATE_PAID;
  assert.deepEqual(await sendPaidNotice(rec), { ok: false, skipped: true });
});
