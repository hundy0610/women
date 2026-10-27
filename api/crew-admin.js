import { handle, requireAdmin } from '../lib/http.js';
import { BookingError } from '../lib/booking.js';
import { applyCrew, listCrew, confirmCrew, renewCrew, cancelCrew, markReminded, setCrewMemo } from '../lib/crew.js';
import { smsEnabled, sendCrewGuide, sendCrewConfirmed, sendCrewRenew } from '../lib/sms.js';

export default handle('POST', async (ctx) => {
  await requireAdmin(ctx);
  const { store, body, nowMs, ip } = ctx;
  const id = String(body.id || '');
  switch (body.action) {
    case 'list':
      return { items: (await listCrew(store, nowMs)).sort((a, b) => b.createdAt - a.createdAt), smsEnabled: smsEnabled() };
    case 'confirm': {
      const before = (await listCrew(store, nowMs)).find((r) => r.id === id);
      const rec = await confirmCrew(store, id, nowMs);
      // 이번 호출로 처음 확정된 경우에만 확정 문자를 보냅니다.
      const sms = rec.confirmedAt === nowMs && before?.stored !== 'confirmed' ? await sendCrewConfirmed(rec) : null;
      return { smsSent: Boolean(sms?.ok) };
    }
    case 'renew': {
      const rec = await renewCrew(store, id, nowMs);
      const sms = await sendCrewConfirmed(rec);
      return { smsSent: Boolean(sms?.ok), periodStart: rec.periodStart, periodEnd: rec.periodEnd };
    }
    case 'remind': {
      const rec = (await listCrew(store, nowMs)).find((r) => r.id === id);
      if (!rec) throw new BookingError('NOT_FOUND', '신청 내역을 찾을 수 없습니다.', 404);
      const sms = await sendCrewRenew(rec);
      if (sms.ok) await markReminded(store, id, nowMs);
      return { smsSent: Boolean(sms.ok) };
    }
    case 'cancel':
      await cancelCrew(store, id, nowMs, 'admin', String(body.note || '').slice(0, 200));
      return {};
    case 'memo':
      await setCrewMemo(store, id, body.memo, nowMs);
      return {};
    case 'create': {
      const { rec } = await applyCrew(store, { ...body.application }, { nowMs, ip, admin: true });
      const sms = rec.status === 'confirmed' ? await sendCrewConfirmed(rec) : await sendCrewGuide(rec);
      return { id: rec.id, smsSent: Boolean(sms?.ok) };
    }
    default:
      throw new BookingError('ACTION', '알 수 없는 요청입니다.');
  }
});
