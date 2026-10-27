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
  assert.equal(l.type, 'LMS'); assert.equal(l.subject, '드림 문화센터');
});

test('송금 안내는 항목별 줄로 정리되고 장문으로 나간다', () => {
  clear(); setAll();
  Object.assign(process.env, { BANK_NAME: '우리은행', BANK_NUMBER: '1000-000-000000', BANK_HOLDER: '홍길동' });
  const t = payGuideText(rec);
  assert.equal(t, [
    '[드림문화센터]',
    '예약일정 : 10월 22일 10~13시',
    '대관장소 : 세미나실',
    '금액 : 90,000원',
    '계좌정보 : 우리은행 1000-000-000000 (예금주 홍길동)',
    '입금기한 : 10월 20일 12시까지',
  ].join('\n'));
  const m = buildMessage('01012345678', t);
  assert.equal(m.type, 'LMS');
  assert.ok(m.subject);
});

test('예약 확정 문자는 일정과 장소를 정리해 알린다', () => {
  clear(); setAll();
  assert.equal(paidText(rec), '[드림문화센터] 예약이 확정되었습니다.\n예약일정 : 10월 22일 10~13시\n대관장소 : 세미나실');
});

test('공간이 여러 개면 쉼표로 모두 적고, 분이 있으면 분까지 적는다', () => {
  clear(); setAll(); process.env.BANK_NAME = '국민은행';
  const t = payGuideText({ ...rec, spaces: ['seminar', 'room1', 'room2'], holdUntil: Date.UTC(2026, 9, 20, 3, 30) });
  assert.ok(t.includes('대관장소 : 세미나실, 방1, 방2'));
  assert.ok(t.includes('계좌정보 : 국민은행 111-22-333 (예금주 센터)'));
  assert.ok(t.includes('입금기한 : 10월 20일 12시 30분까지'));
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
