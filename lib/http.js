import { BookingError } from './booking.js';
import { getStore } from './store.js';
import { clientIp, sha } from './util.js';
import { checkPassword, hasAnyPassword } from './adminpw.js';

// 개발 서버만 ALLOW_TEST_NOW=1 로 시각을 바꿔 테스트합니다. 배포 환경에서는 설정하지 않습니다.
export function currentTime(req) {
  if (process.env.ALLOW_TEST_NOW === '1' && req.headers?.['x-test-now']) {
    const t = Number(req.headers['x-test-now']);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

export function handle(method, fn) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== method) {
      res.setHeader('Allow', method);
      return res.status(405).json({ ok: false, error: { code: 'METHOD', message: '허용되지 않는 요청입니다.' } });
    }
    try {
      const store = getStore();
      if (!store) throw new BookingError('STORE_NOT_CONFIGURED', '예약 저장소가 설정되지 않았습니다.', 503);
      const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
      const data = await fn({ req, store, body, nowMs: currentTime(req), ip: clientIp(req) });
      return res.status(200).json({ ok: true, ...data });
    } catch (err) {
      if (err instanceof BookingError) {
        return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
      }
      console.error(err);
      return res.status(500).json({ ok: false, error: { code: 'SERVER', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.' } });
    }
  };
}

const safeJson = (s) => { try { return JSON.parse(s); } catch { return {}; } };

// 비밀번호를 틀린 횟수만 세어서, 10분에 10번을 넘으면 막습니다.
export async function requireAdmin({ req, store, nowMs, ip }) {
  if (!(await hasAnyPassword(store))) throw new BookingError('ADMIN_NOT_SET', '관리자 비밀번호가 설정되지 않았습니다.', 503);
  const key = `rl:adm:${sha(ip)}:${Math.floor(nowMs / 600000)}`;
  if (Number(await store.get(key)) >= 10) throw new BookingError('RATE_LIMIT', '시도가 너무 많습니다. 10분 뒤에 다시 시도하세요.', 429);
  if (!(await checkPassword(store, String(req.headers['x-admin-password'] || '')))) {
    await store.incr(key, 600);
    throw new BookingError('UNAUTHORIZED', '비밀번호가 맞지 않습니다.', 401);
  }
}
