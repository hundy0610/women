import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../lib/http.js';
import { BookingError } from '../lib/booking.js';
import { applyCrew, crewUsage, findForApplicant, applicantView, applicantCancel, recordSms } from '../lib/crew.js';
import { notifyAdmin, adminLink } from '../lib/notify.js';
import { sendCrewGuide } from '../lib/sms.js';
import { CREW, findProgram, WEEKDAY } from '../public/shared/crew-config.mjs';
import { formatKoreanDate } from '../public/shared/time.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'photos', 'crew');

// public/photos/crew 안의 사진을 프로그램별로 모읍니다. 파일 이름: 프로그램ID-번호.png
function photos() {
  const out = {};
  try {
    for (const f of fs.readdirSync(dir).sort()) {
      const m = /^([a-z0-9]+)-(\d+)\.(jpe?g|png|webp)$/i.exec(f);
      if (m) (out[m[1].toLowerCase()] ||= []).push(`/photos/crew/${f}`);
    }
  } catch { /* 폴더가 없으면 사진 없이 동작합니다 */ }
  return out;
}

const bank = () => (process.env.BANK_NUMBER
  ? { name: process.env.BANK_NAME || '', number: process.env.BANK_NUMBER, holder: process.env.BANK_HOLDER || '' }
  : null);

export default handle('POST', async ({ req, store, body, nowMs, ip }) => {
  switch (body.action) {
    case 'info':
      return { now: nowMs, used: await crewUsage(store, nowMs), photos: photos(), bank: bank(), contact: process.env.CONTACT_PHONE || null };
    case 'apply': {
      const { rec } = await applyCrew(store, { ...body.application }, { nowMs, ip });
      const prog = findProgram(rec.programId);
      await notifyAdmin(`[소모임 신청] ${rec.name} ${prog?.name || ''} 매주 ${WEEKDAY[rec.weekday]} ${rec.time} ${formatKoreanDate(rec.periodStart)}부터 (입금 대기)`, adminLink(req));
      await recordSms(store, rec.id, nowMs, '입금 안내 문자', await sendCrewGuide(rec));
      return { application: applicantView(rec, nowMs), holdHours: CREW.holdHours };
    }
    case 'lookup': {
      const rec = await findForApplicant(store, body.id, body.phone, { nowMs, ip });
      return { application: applicantView(rec, nowMs) };
    }
    case 'cancel': {
      const rec = await findForApplicant(store, body.id, body.phone, { nowMs, ip });
      const r = await applicantCancel(store, rec, body.reason, nowMs);
      const prog = findProgram(rec.programId);
      await notifyAdmin(r.mode === 'requested' ? `[소모임 취소 요청] ${rec.name} ${prog?.name || ''} (이용 중, 확인 필요)` : `[소모임 취소] ${rec.name} ${prog?.name || ''} 입금 전 신청이 취소되었습니다.`, adminLink(req));
      return { mode: r.mode };
    }
    default:
      throw new BookingError('ACTION', '알 수 없는 요청입니다.');
  }
});
