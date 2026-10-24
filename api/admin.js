import { handle, requireAdmin } from '../lib/http.js';
import { BookingError, adminList, confirmReservation, cancelReservation, cancelMany, createReservation, setMemo, dismissCancelRequest } from '../lib/booking.js';
import { configWith, getBlocks, addBlock, removeBlock } from '../lib/blocks.js';
import { listLog, logEvent } from '../lib/history.js';
import { changePassword } from '../lib/adminpw.js';
import { notifyAdmin, notifyEnabled, adminLink } from '../lib/notify.js';
import { smsEnabled, sendPaidNotice } from '../lib/sms.js';

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
    {
      const rec = await confirmReservation(store, id, nowMs, note);
      // 이번 호출로 처음 확정된 경우에만 송금 완료 문자를 보냅니다.
      if (rec.confirmedAt === nowMs) await sendPaidNotice(rec);
      return {};
    }
    case 'cancel':
      await cancelReservation(store, id, nowMs, note);
      return {};
    case 'cancel_many':
      return await cancelMany(store, body.ids, nowMs, note);
    case 'memo':
      await setMemo(store, id, body.memo, nowMs);
      return {};
    case 'create': {
      const { rec } = await createReservation(store, { ...body.reservation }, { nowMs, ip: ctx.ip, admin: true, cfg: await configWith(store) });
      // 확정으로 등록했다면 바로 송금 완료 문자를 보냅니다. 확정 전 등록은 나중에 확정할 때 보냅니다.
      const sms = rec.status === 'confirmed' ? await sendPaidNotice(rec) : null;
      return { reservation: rec, smsSent: Boolean(sms?.ok) };
    }
    case 'dismiss':
      await dismissCancelRequest(store, id, nowMs);
      return {};
    case 'blocks':
      return { blocks: await getBlocks(store) };
    case 'block_add':
      return await addBlock(store, body, nowMs);
    case 'block_remove':
      await removeBlock(store, String(body.blockId || ''), nowMs);
      return {};
    case 'sms_status':
      return { enabled: smsEnabled() };
    case 'notify_status':
      return { enabled: notifyEnabled() };
    case 'notify_test':
      if (!notifyEnabled()) throw new BookingError('NOTIFY_OFF', '알림 채널이 설정되지 않았습니다.');
      await notifyAdmin('[테스트] 예약 알림이 정상적으로 연결되었습니다.', adminLink(ctx.req));
      return {};
    case 'setpw':
      await changePassword(store, body.newPassword);
      await logEvent(store, nowMs, { id: '', action: 'password_changed', by: 'admin', note: '관리자 비밀번호 변경' });
      return {};
    default:
      throw new BookingError('ACTION', '알 수 없는 요청입니다.');
  }
});
