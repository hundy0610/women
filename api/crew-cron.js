// 매일 한 번 불러서 연장 안내 문자를 보냅니다(GitHub Actions 예약 실행). CRON_SECRET 환경변수와 같은 값을 헤더로 보내야 합니다.
import { handle } from '../lib/http.js';
import { BookingError } from '../lib/booking.js';
import { dueReminders, markReminded } from '../lib/crew.js';
import { smsEnabled, sendCrewRenew } from '../lib/sms.js';
import { safeEqual } from '../lib/util.js';

const MAX_PER_RUN = 100;

export default handle('POST', async ({ req, store, nowMs }) => {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) throw new BookingError('CRON_NOT_SET', '자동 안내 설정이 되어 있지 않습니다.', 503);
  if (!safeEqual(String(req.headers['x-cron-secret'] || ''), secret)) throw new BookingError('UNAUTHORIZED', '권한이 없습니다.', 401);
  if (!smsEnabled()) return { sent: 0, failed: 0, skipped: 'sms-disabled' };
  let sent = 0;
  let failed = 0;
  for (const { rec, stage } of (await dueReminders(store, nowMs)).slice(0, MAX_PER_RUN)) {
    const r = await sendCrewRenew(rec);
    if (r.ok) { await markReminded(store, rec.id, nowMs, stage, true); sent++; } else failed++;
  }
  return { sent, failed };
});
