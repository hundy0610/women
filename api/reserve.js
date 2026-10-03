import { handle } from '../lib/http.js';
import { createReservation } from '../lib/booking.js';
import { configWith } from '../lib/blocks.js';
import { notifyAdmin, adminLink } from '../lib/notify.js';
import { formatKoreanDate, hh } from '../public/shared/time.mjs';
import { CONFIG } from '../public/shared/config.mjs';

export default handle('POST', async ({ req, store, body, nowMs, ip }) => {
  const cfg = await configWith(store);
  const { rec, quote } = await createReservation(store, body, { nowMs, ip, cfg });
  await notifyAdmin(`[새 예약] ${rec.name} ${rec.people}명 ${formatKoreanDate(rec.date)} ${hh(rec.start)}~${hh(rec.end)} ${rec.amount.toLocaleString('ko-KR')}원 (입금 대기)`, adminLink(req));
  return {
    reservation: {
      id: rec.id, date: rec.date, start: rec.start, end: rec.end, spaces: rec.spaces,
      name: rec.name, people: rec.people, amount: rec.amount, holdUntil: rec.holdUntil,
    },
    quote,
    holdHours: CONFIG.holdHours,
  };
});
