// 소모임 포털(마두 소모임, 한빛커뮤니티)의 신청 화면용, 관리자용 API를 포털 설정(cfg)과 클럽(createClub)으로 만들어 줍니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, requireAdmin } from './http.js';
import { BookingError } from './booking.js';
import { notifyAdmin, adminLink } from './notify.js';
import { smsEnabled, sendCrewGuide, sendCrewConfirmed, sendCrewRenew } from './sms.js';
import { findProgram, WEEKDAY } from '../public/shared/crew-config.mjs';
import { formatKoreanDate } from '../public/shared/time.mjs';

const photoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'photos');
const env = (k) => String(process.env[k] || '').trim();
const envOr = (prefix, key) => env(`${prefix}${key}`) || env(key);

// public/photos/<photoDir> 안의 사진을 프로그램별로 모읍니다. 파일 이름: 프로그램ID-번호.jpg(png, webp)
function photos(cfg) {
  const out = {};
  try {
    for (const f of fs.readdirSync(path.join(photoRoot, cfg.photoDir)).sort()) {
      const m = /^([a-z0-9]+)-(\d+)\.(jpe?g|png|webp)$/i.exec(f);
      if (m) (out[m[1].toLowerCase()] ||= []).push(`/photos/${cfg.photoDir}/${f}`);
    }
  } catch { /* 폴더가 없으면 사진 없이 동작합니다 */ }
  return out;
}

const bank = (cfg) => {
  const number = envOr(cfg.envPrefix, 'BANK_NUMBER');
  return number ? { name: envOr(cfg.envPrefix, 'BANK_NAME'), number, holder: envOr(cfg.envPrefix, 'BANK_HOLDER') } : null;
};

export function publicApi(cfg, club) {
  return handle('POST', async ({ req, store, body, nowMs, ip }) => {
    switch (body.action) {
      case 'info':
        return { now: nowMs, used: await club.crewUsage(store, nowMs), photos: photos(cfg), bank: bank(cfg), contact: envOr(cfg.envPrefix, 'CONTACT_PHONE') || null };
      case 'apply': {
        const { rec } = await club.applyCrew(store, { ...body.application }, { nowMs, ip });
        const prog = findProgram(rec.programId, cfg);
        await notifyAdmin(`[${cfg.notifyLabel} 신청] ${rec.name} ${prog?.name || ''} 매주 ${WEEKDAY[rec.weekday]} ${rec.time} ${formatKoreanDate(rec.periodStart)}부터 (입금 대기)`, adminLink(req));
        await club.recordSms(store, rec.id, nowMs, '입금 안내 문자', await sendCrewGuide(rec, cfg));
        return { application: club.applicantView(rec, nowMs), holdHours: cfg.holdHours };
      }
      case 'lookup': {
        const rec = await club.findForApplicant(store, body.id, body.phone, { nowMs, ip });
        return { application: club.applicantView(rec, nowMs) };
      }
      case 'cancel': {
        const rec = await club.findForApplicant(store, body.id, body.phone, { nowMs, ip });
        const r = await club.applicantCancel(store, rec, body.reason, nowMs);
        const prog = findProgram(rec.programId, cfg);
        await notifyAdmin(r.mode === 'requested' ? `[${cfg.notifyLabel} 취소 요청] ${rec.name} ${prog?.name || ''} (이용 중, 확인 필요)` : `[${cfg.notifyLabel} 취소] ${rec.name} ${prog?.name || ''} 입금 전 신청이 취소되었습니다.`, adminLink(req));
        return { mode: r.mode };
      }
      default:
        throw new BookingError('ACTION', '알 수 없는 요청입니다.');
    }
  });
}

export function adminApi(cfg, club) {
  return handle('POST', async (ctx) => {
    await requireAdmin(ctx);
    const { store, body, nowMs, ip } = ctx;
    const id = String(body.id || '');
    switch (body.action) {
      case 'list':
        return { items: (await club.listCrew(store, nowMs)).sort((a, b) => b.createdAt - a.createdAt), smsEnabled: smsEnabled() };
      case 'confirm': {
        const before = (await club.listCrew(store, nowMs)).find((r) => r.id === id);
        const rec = await club.confirmCrew(store, id, nowMs);
        // 이번 호출로 처음 확정된 경우에만 확정 문자를 보냅니다.
        const sms = rec.confirmedAt === nowMs && before?.stored !== 'confirmed' ? await sendCrewConfirmed(rec, cfg) : null;
        if (sms) await club.recordSms(store, id, nowMs, '확정 문자', sms);
        return { smsSent: Boolean(sms?.ok) };
      }
      case 'renew': {
        const rec = await club.renewCrew(store, id, nowMs);
        const sms = await sendCrewConfirmed(rec, cfg);
        await club.recordSms(store, id, nowMs, '연장 확정 문자', sms);
        return { smsSent: Boolean(sms?.ok), periodStart: rec.periodStart, periodEnd: rec.periodEnd };
      }
      case 'remind': {
        const rec = (await club.listCrew(store, nowMs)).find((r) => r.id === id);
        if (!rec) throw new BookingError('NOT_FOUND', '신청 내역을 찾을 수 없습니다.', 404);
        const sms = await sendCrewRenew(rec, cfg);
        await club.recordSms(store, id, nowMs, '연장 안내 문자', sms);
        if (sms.ok) await club.markReminded(store, id, nowMs, rec.status === 'ended' ? 'ended' : 'expiring');
        return { smsSent: Boolean(sms.ok) };
      }
      case 'cancel':
        await club.cancelCrew(store, id, nowMs, 'admin', String(body.note || '').slice(0, 200));
        return {};
      case 'dismiss':
        await club.dismissCrewCancel(store, id, nowMs);
        return {};
      case 'memo':
        await club.setCrewMemo(store, id, body.memo, nowMs);
        return {};
      case 'create': {
        const { rec } = await club.applyCrew(store, { ...body.application }, { nowMs, ip, admin: true });
        const sms = rec.status === 'confirmed' ? await sendCrewConfirmed(rec, cfg) : await sendCrewGuide(rec, cfg);
        await club.recordSms(store, rec.id, nowMs, rec.status === 'confirmed' ? '확정 문자' : '입금 안내 문자', sms);
        return { id: rec.id, smsSent: Boolean(sms?.ok) };
      }
      default:
        throw new BookingError('ACTION', '알 수 없는 요청입니다.');
    }
  });
}
