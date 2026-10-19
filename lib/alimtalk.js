// 카카오 알림톡(Solapi) 발송. 예약자에게 송금 안내와 송금 완료를 알립니다.
// 환경변수가 모두 있을 때만 켜지고, 실패해도 예약과 입금 확인 처리에는 영향을 주지 않습니다.
//   SOLAPI_API_KEY, SOLAPI_API_SECRET   Solapi 콘솔 > API Key
//   SOLAPI_SENDER                       Solapi에 등록한 발신번호(숫자만)
//   KAKAO_PF_ID                         Solapi에 연동한 카카오 채널의 pfId
//   ALIMTALK_TEMPLATE_PAY               송금 안내 템플릿 ID (예약 직후)
//   ALIMTALK_TEMPLATE_PAID              송금 완료 템플릿 ID (관리자가 입금 확인한 때)
// 템플릿 문구와 변수는 docs/alimtalk.md 를 보세요.
import crypto from 'node:crypto';
import { CONFIG } from '../public/shared/config.mjs';
import { formatKoreanDate, formatKstDateTime, hh } from '../public/shared/time.mjs';

const API = 'https://api.solapi.com/messages/v4/send';

const env = (k) => String(process.env[k] || '').trim();

export function alimtalkEnabled() {
  return Boolean(env('SOLAPI_API_KEY') && env('SOLAPI_API_SECRET') && env('SOLAPI_SENDER') && env('KAKAO_PF_ID'));
}

export function alimtalkStatus() {
  return {
    enabled: alimtalkEnabled(),
    pay: Boolean(env('ALIMTALK_TEMPLATE_PAY')),
    paid: Boolean(env('ALIMTALK_TEMPLATE_PAID')),
  };
}

const digits = (s) => String(s || '').replace(/\D/g, '');

// Solapi HMAC-SHA256 인증 헤더: 서명 대상은 date + salt, 키는 API Secret(hex)
export function authHeader(apiKey, apiSecret, now = new Date(), salt = crypto.randomBytes(16).toString('hex')) {
  const date = now.toISOString();
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 템플릿 변수는 #{name} 형태로 보냅니다.
export function buildMessage({ to, templateId, variables }) {
  const vars = {};
  for (const [k, v] of Object.entries(variables)) vars[`#{${k}}`] = String(v ?? '');
  return {
    to: digits(to),
    from: digits(env('SOLAPI_SENDER')),
    type: 'ATA',
    kakaoOptions: { pfId: env('KAKAO_PF_ID'), templateId, variables: vars, disableSms: true },
  };
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
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '시간 초과' : String(e.message || e) };
  } finally { clearTimeout(t); }
}

const spaceNames = (rec) => rec.spaces.map((id) => CONFIG.spaces.find((s) => s.id === id)?.name || id).join(', ');

export function variablesFor(rec) {
  return {
    name: rec.name,
    date: formatKoreanDate(rec.date),
    time: `${hh(rec.start)}~${hh(rec.end)}`,
    space: spaceNames(rec),
    amount: `${Number(rec.amount).toLocaleString('ko-KR')}원`,
    bank: env('BANK_NAME'),
    account: env('BANK_NUMBER'),
    holder: env('BANK_HOLDER'),
    deadline: rec.holdUntil ? formatKstDateTime(rec.holdUntil) : '',
    id: rec.id,
  };
}

async function deliver(templateEnv, rec) {
  const templateId = env(templateEnv);
  if (!alimtalkEnabled() || !templateId || !rec?.phone) return { ok: false, skipped: true };
  const r = await send(buildMessage({ to: rec.phone, templateId, variables: variablesFor(rec) }));
  if (!r.ok) console.error(`[alimtalk] ${templateEnv} 발송 실패 (${rec.id}): ${r.error}`);
  return r;
}

export const sendPayGuide = (rec) => deliver('ALIMTALK_TEMPLATE_PAY', rec);
export const sendPaidNotice = (rec) => deliver('ALIMTALK_TEMPLATE_PAID', rec);
