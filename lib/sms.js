// 예약자 문자(Solapi). 예약 직후 송금 안내, 입금 확인 후 송금 완료를 보냅니다.
// 환경변수가 모두 있을 때만 켜지고, 실패해도 예약과 입금 확인 처리에는 영향을 주지 않습니다.
//   SOLAPI_API_KEY, SOLAPI_API_SECRET   Solapi 콘솔 > API Key
//   SOLAPI_SENDER                       Solapi에 등록·인증한 발신번호
//   SMS_NOTIFY=off                      (선택) 문자 발송을 끕니다
import crypto from 'node:crypto';
import { CONFIG } from '../public/shared/config.mjs';
import { kstParts } from '../public/shared/time.mjs';

const API = 'https://api.solapi.com/messages/v4/send';
const env = (k) => String(process.env[k] || '').trim();
const digits = (s) => String(s || '').replace(/\D/g, '');

export function smsEnabled() {
  return env('SMS_NOTIFY').toLowerCase() !== 'off' && Boolean(env('SOLAPI_API_KEY') && env('SOLAPI_API_SECRET') && digits(env('SOLAPI_SENDER')));
}

// Solapi HMAC-SHA256 인증 헤더: 서명 대상은 date + salt, 키는 API Secret(hex)
export function authHeader(apiKey, apiSecret, now = new Date(), salt = crypto.randomBytes(16).toString('hex')) {
  const date = now.toISOString();
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 한글 2바이트 기준으로 90바이트를 넘으면 장문(LMS)입니다.
const byteLen = (s) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);

export function buildMessage(to, text) {
  const m = { to: digits(to), from: digits(env('SOLAPI_SENDER')), text, type: byteLen(text) > 90 ? 'LMS' : 'SMS' };
  if (m.type === 'LMS') m.subject = '드림 문화센터';
  return m;
}

async function send(message) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(env('SOLAPI_API_KEY'), env('SOLAPI_API_SECRET')) },
      body: JSON.stringify({ message }),
      signal: ctl.signal,
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '시간 초과' : String(e.message || e) };
  } finally { clearTimeout(t); }
}

const spaceNames = (rec) => rec.spaces.map((id) => CONFIG.spaces.find((s) => s.id === id)?.name || id);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;

// 단문(90바이트)에 들어가도록 줄여 씁니다. 길어지면 자동으로 장문이 됩니다.
const shortDate = (ymd) => { const [, m, d] = String(ymd).split('-').map(Number); return `${m}/${d}`; };
const shortSpace = (rec) => { const n = spaceNames(rec); return n.length > 1 ? `${n[0]} 외${n.length - 1}` : n[0]; };
const shortWhen = (rec) => `${shortDate(rec.date)} ${rec.start}~${rec.end}시`;
const shortDeadline = (ms) => { const p = kstParts(ms); return `${p.m}/${p.d} ${p.h}시${p.mi ? `${p.mi}분` : ''}`; };
const shortBank = () => [env('BANK_NAME').replace(/은행$/, ''), env('BANK_NUMBER')].filter(Boolean).join(' ');

export function payGuideText(rec) {
  const lines = [`[드림문화센터] ${shortWhen(rec)} ${shortSpace(rec)} ${won(rec.amount)}`];
  const bank = shortBank();
  if (bank) lines.push(bank);
  if (rec.holdUntil) lines.push(`${shortDeadline(rec.holdUntil)}까지 입금`);
  return lines.join('\n');
}

export function paidText(rec) {
  return `[드림문화센터] ${shortWhen(rec)} ${shortSpace(rec)} 예약 확정`;
}

async function deliver(kind, rec, text) {
  if (!smsEnabled() || !rec?.phone) return { ok: false, skipped: true };
  const r = await send(buildMessage(rec.phone, text));
  if (!r.ok) console.error(`[sms] ${kind} 발송 실패 (${rec.id}): ${r.error}`);
  return r;
}

export const sendPayGuide = (rec) => deliver('송금 안내', rec, payGuideText(rec));
export const sendPaidNotice = (rec) => deliver('송금 완료', rec, paidText(rec));
