import crypto from 'node:crypto';
import { safeEqual } from './util.js';
import { BookingError } from './booking.js';

const KEY = 'admin:pw';

function hash(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${crypto.scryptSync(String(pw), salt, 32).toString('hex')}`;
}

// 관리자가 바꾼 비밀번호가 저장소에 있으면 그것을, 없으면 환경변수 ADMIN_PASSWORD(초기 비밀번호)를 씁니다.
export async function checkPassword(store, pw) {
  const stored = await store.get(KEY);
  if (stored) {
    const [, salt, h] = String(stored).split('$');
    return safeEqual(hash(pw, salt).split('$')[2], h);
  }
  const initial = process.env.ADMIN_PASSWORD;
  return Boolean(initial) && safeEqual(pw, initial);
}

export async function hasAnyPassword(store) {
  return Boolean(process.env.ADMIN_PASSWORD) || Boolean(await store.get(KEY));
}

export async function changePassword(store, next) {
  const p = String(next || '');
  if (p.length < 8) throw new BookingError('PW_SHORT', '새 비밀번호는 8자 이상이어야 합니다.');
  await store.set(KEY, hash(p));
}
