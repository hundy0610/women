import { handle, requireAdmin } from '../lib/http.js';
import { BookingError, adminList, confirmReservation, cancelReservation, createReservation, setMemo } from '../lib/booking.js';
import { listLog, logEvent } from '../lib/history.js';
import { changePassword } from '../lib/adminpw.js';

export default handle('POST', async (ctx) => {
  await requireAdmin(ctx);
  const { store, body, nowMs } = ctx;
  const id = String(body.id || '');
  const note = String(body.note || '').slice(0, 200);
  switch (body.action) {
    case 'list':
      return { items: await adminList(store, nowMs) };
    case 'history':
      return { events: await listLog(store, 1000) };
    case 'confirm':
      await confirmReservation(store, id, nowMs, note);
      return {};
    case 'cancel':
      await cancelReservation(store, id, nowMs, note);
      return {};
    case 'memo':
      await setMemo(store, id, body.memo, nowMs);
      return {};
    case 'create': {
      const { rec } = await createReservation(store, { ...body.reservation }, { nowMs, ip: ctx.ip, admin: true });
      return { reservation: rec };
    }
    case 'setpw':
      await changePassword(store, body.newPassword);
      await logEvent(store, nowMs, { id: '', action: 'password_changed', by: 'admin', note: '관리자 비밀번호 변경' });
      return {};
    default:
      throw new BookingError('ACTION', '알 수 없는 요청입니다.');
  }
});
