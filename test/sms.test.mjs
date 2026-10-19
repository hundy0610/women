import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authHeader, buildMessage, smsEnabled, payGuideText, paidText, sendPayGuide, sendPaidNotice } from '../lib/sms.js';

const KEYS = ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER', 'SMS_NOTIFY', 'BANK_NAME', 'BANK_NUMBER', 'BANK_HOLDER'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const clear = () => KEYS.forEach((k) => delete process.env[k]);
const setAll = () => Object.assign(process.env, { SOLAPI_API_KEY: 'KEY', SOLAPI_API_SECRET: 'SECRET', SOLAPI_SENDER: '02-1234-5678', BANK_NAME: '은행', BANK_NUMBER: '111-22-333', BANK_HOLDER: '센터' });
const rec = { id: 'abc', name: '홍길동', phone: '010-1234-5678', date: '2026-10-22', start: 10, end: 13, spaces: ['seminar'], amount: 90000, holdUntil: Date.UTC(2026, 9, 20, 3, 0) };

test.afterEach(() => { clear(); Object.assign(process.env, Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined))); });

test('인증 헤더는 date+salt를 API Secret으로 HMAC-SHA256(hex) 서명한다', () => {
  const h = authHeader('KEY', 'SECRET', new Date('2026-10-19T00:00:00.000Z'), 'salt123');
  const sig = crypto.createHmac('sha256', 'SECRET').update('2026-10-19T00:00:00.000Zsalt123').digest('hex');
  assert.equal(h, `HMAC-SHA256 apiKey=KEY, date=2026-10-19T00:00:00.000Z, salt=salt123, signature=${sig}`);
});

test('설정이 없거나 SMS_NOTIFY=off 이면 아무것도 보내지 않는다', async () => {
  const orig = globalThis.fetch; let called = 0; globalThis.fetch = async () => { called++; return new Response('{}'); };
  try {
    clear(); assert.equal(smsEnabled(), false);
    assert.deepEqual(await sendPayGuide(rec), { ok: false, skipped: true });
    setAll(); process.env.SMS_NOTIFY = 'off'; assert.equal(smsEnabled(), false);
    assert.deepEqual(await sendPaidNotice(rec), { ok: false, skipped: true });
    assert.equal(called, 0);
  } finally { globalThis.fetch = orig; }
});

test('짧은 글은 SMS, 긴 글은 LMS(제목 포함), 번호는 숫자만', () => {
  clear(); setAll();
  assert.deepEqual(buildMessage('010-1234-5678', '안녕하세요'), { to: '01012345678', from: '0212345678', text: '안녕하세요', type: 'SMS' });
  const l = buildMessage('01012345678', '가'.repeat(60));
  assert.equal(l.type, 'LMS'); assert.equal(l.subject, '여성문화센터');
});

test('송금 안내는 날짜, 시간, 공간, 금액, 계좌, 기한만 담아 단문에 들어간다', () => {
  clear(); setAll();
  const t = payGuideText(rec);
  assert.equal(t, '[여성문화센터] 10/22 10~13시 세미나실 90,000원\n111-22-333\n10/20 12시까지 입금');
  assert.equal(buildMessage('01012345678', t).type, 'SMS');
});

test('송금 완료는 한 줄 단문이다', () => {
  clear(); setAll();
  const t = paidText(rec);
  assert.equal(t, '[여성문화센터] 10/22 10~13시 세미나실 예약 확정');
  assert.equal(buildMessage('01012345678', t).type, 'SMS');
});

test('공간이 여러 개면 "첫 공간 외N"으로 줄이고, 은행 접미사 은행은 뺀다', () => {
  clear(); setAll(); process.env.BANK_NAME = '국민은행';
  const t = payGuideText({ ...rec, spaces: ['seminar', 'room1', 'room2'], holdUntil: Date.UTC(2026, 9, 20, 3, 30) });
  assert.ok(t.includes('세미나실 외2'));
  assert.ok(t.includes('국민 111-22-333'));
  assert.ok(t.includes('10/20 12시30분까지 입금'));
});

test('계좌 설정이 없으면 계좌 줄을 빼고 보낸다', () => {
  clear(); setAll(); delete process.env.BANK_NUMBER; delete process.env.BANK_NAME;
  assert.ok(!payGuideText(rec).includes('111'));
});

test('발송은 Solapi로 가고, 실패해도 던지지 않는다', async () => {
  clear(); setAll();
  const orig = globalThis.fetch; const calls = []; const origErr = console.error; console.error = () => {};
  globalThis.fetch = async (url, init) => { calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };
  try {
    assert.equal((await sendPayGuide(rec)).ok, true);
    assert.equal(calls[0].url, 'https://api.solapi.com/messages/v4/send');
    assert.match(calls[0].auth, /^HMAC-SHA256 apiKey=KEY, date=/);
    assert.equal(calls[0].body.message.to, '01012345678');
    globalThis.fetch = async () => new Response('bad', { status: 400 });
    assert.equal((await sendPaidNotice(rec)).ok, false);
    globalThis.fetch = async () => { throw new Error('network'); };
    assert.equal((await sendPayGuide(rec)).ok, false);
  } finally { globalThis.fetch = orig; console.error = origErr; }
});
