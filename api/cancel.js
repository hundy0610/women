import { handle } from '../lib/http.js';
import { findForUser, userCancel } from '../lib/booking.js';
import { notifyAdmin, adminLink } from '../lib/notify.js';
import { formatKoreanDate, hh } from '../public/shared/time.mjs';

export default handle('POST', async ({ req, store, body, nowMs, ip }) => {
  const rec = await findForUser(store, body.id, body.phone, { nowMs, ip });
  const r = await userCancel(store, rec, body.reason, nowMs);
  const when = `${formatKoreanDate(rec.date)} ${hh(rec.start)}~${hh(rec.end)}`;
  await notifyAdmin(
    r.mode === 'requested'
      ? `[취소 요청] ${rec.name} ${when} ${rec.amount.toLocaleString('ko-KR')}원 (환불 처리 필요)`
      : `[예약 취소] ${rec.name} ${when} 입금 전 예약이 취소되었습니다.`,
    adminLink(req),
  );
  return { mode: r.mode };
});
