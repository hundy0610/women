// 보안 보조 기능. 외부 패키지 없이 OWASP 권고(보안 헤더, 입력 검증, 요청 제한, 출처 확인)를 따릅니다.
import { SECURITY_HEADERS } from './security-headers.js';

export { SECURITY_HEADERS };

// 요청한 사람의 IP. 값을 사용자가 마음대로 넣을 수 있는 헤더를 믿으면 제한을 피해 갈 수 있어서,
// 호스팅(Vercel, Cloudflare/Render)이 직접 채워 주는 헤더를 먼저 보고, 없으면 X-Forwarded-For의 가장 오른쪽(프록시가 붙인 값)을 씁니다.
export function clientIp(req) {
  const h = req.headers || {};
  const first = (v) => String(v || '').split(',')[0].trim();
  const direct = first(h['x-vercel-forwarded-for']) || first(h['cf-connecting-ip']) || first(h['true-client-ip']) || first(h['x-real-ip']);
  if (direct) return direct;
  const xff = String(h['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (xff.length) return xff[xff.length - 1];
  return req.socket?.remoteAddress || 'unknown';
}

// 신청번호/예약번호 형식(영문 대문자와 숫자 8자). 형식이 다르면 저장소를 조회하지도 않습니다.
export const ID_RE = /^[A-Z0-9]{8}$/;
export const cleanId = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  return ID_RE.test(s) ? s : null;
};

// 다른 사이트에서 브라우저를 이용해 몰래 보내는 요청을 막습니다. Origin이 있는데 우리 주소가 아니면 거절합니다.
export function sameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin || origin === 'null') return !origin; // 헤더가 없으면(서버끼리 호출, 같은 출처 일부 요청) 허용, 'null'은 거절
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

// 프로세스 안에서만 세는 간단한 요청 제한(저장소 호출이 늘지 않도록). 키별로 windowMs 동안 limit번까지 허용합니다.
const buckets = new Map();
export function hit(key, limit, windowMs, now = Date.now()) {
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 20000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  return b.n <= limit;
}
export const _resetLimits = () => buckets.clear();

export const MAX_BODY_BYTES = 64 * 1024;
