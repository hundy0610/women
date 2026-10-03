import { handle } from '../lib/http.js';
import { BookingError, publicAvailability } from '../lib/booking.js';
import { parseYmd, todayKst, addDays, ymdNum } from '../public/shared/time.mjs';

export default handle('GET', async ({ req, store, nowMs }) => {
  const today = todayKst(nowMs);
  const from = String(req.query?.from || today);
  const to = String(req.query?.to || addDays(today, 90));
  if (!parseYmd(from) || !parseYmd(to) || ymdNum(to) < ymdNum(from) || ymdNum(to) > ymdNum(addDays(from, 130))) {
    throw new BookingError('RANGE', '조회 기간이 올바르지 않습니다.');
  }
  return { now: nowMs, items: await publicAvailability(store, from, to, nowMs) };
});
