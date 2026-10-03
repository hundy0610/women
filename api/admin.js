import { handle, requireAdmin } from '../lib/http.js';
import { BookingError, adminList, confirmReservation, cancelReservation } from '../lib/booking.js';

export default handle('POST', async (ctx) => {
  await requireAdmin(ctx);
  const { store, body, nowMs } = ctx;
  const id = String(body.id || '');
  switch (body.action) {
    case 'list':
      return { items: await adminList(store, nowMs) };
    case 'confirm':
      await confirmReservation(store, id, nowMs);
      return {};
    case 'cancel':
      await cancelReservation(store, id, nowMs);
      return {};
    default:
      throw new BookingError('ACTION', '알 수 없는 요청입니다.');
  }
});
