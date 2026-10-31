// 관리자 화면에서 소모임 신청을 장소대관과 같은 목록에 섞어 다루기 위한 도우미.
// 줄 모양, 상세, 처리(입금 확인, 연장, 안내 문자, 취소, 메모), 직접 등록 양식, 이력, CSV를 한곳에 모았습니다.
import { ic } from '/icons.js';
import { CREW, WEEKDAY, allSlots, findProgram } from '/shared/crew-config.mjs';
import { firstOnOrAfter } from '/shared/crew-rules.mjs';
import { todayKst, addDays, formatKstDateTime } from '/shared/time.mjs';

const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LONG = (d) => { const [, m, dd] = String(d).split('-').map(Number); return `${m}월 ${dd}일`; };
const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
const errMsg = (t) => (t ? `<p class="msg err">${ic('alert', 18)}${esc(t)}</p>` : '');
export const SMS_TXT = { sent: '발송 접수됨', test: '건너뜀 (테스트 신청)', off: '건너뜀 (문자 설정 꺼짐)', failed: '실패' };
export const STATUS_TXT = { pending: '입금 대기', active: '이용 중', expiring: '곧 만료', ended: '기간 끝남', expired: '기한 만료', canceled: '취소' };
export const kindTag = (kind) => (kind === 'crew'
  ? `<span class="kt kt-crew">${ic('users', 14)}소모임</span>`
  : `<span class="kt kt-rent">${ic('cal', 14)}장소대관</span>`);

export function crewStatusBadge(r) {
  if (r.cancelRequest && r.status !== 'canceled') return badge('bad', '취소 요청', 'alert');
  switch (r.status) {
    case 'pending': return badge('pend', '입금 대기', 'clock');
    case 'active': return badge('ok', '이용 중', 'check');
    case 'expiring': return badge('pend', '곧 만료', 'clock');
    case 'ended': return badge('bad', '기간 끝남', 'alert');
    case 'expired': return badge('off', '기한 만료', 'clock');
    default: return badge('off', '취소', 'ban');
  }
}
export const crewTitle = (r) => `${findProgram(r.programId)?.name || r.programId} · 매주 ${WEEKDAY[r.weekday]}요일 ${r.time}`;
export const crewPeriod = (r) => `${LONG(r.periodStart)} ~ ${LONG(r.periodEnd)}`;

export function createCrewAdmin({ getPw, toast, ask }) {
  let items = [];

  async function call(body) {
    const res = await fetch('/api/crew-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': getPw() }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) { const e = new Error(j?.error?.message || '요청에 실패했습니다.'); e.code = j?.error?.code; throw e; }
    return j;
  }
  async function load() {
    const j = await call({ action: 'list' });
    items = j.items;
    return items;
  }

  /* ---------- 목록 줄과 상세 ---------- */
  function holdText(r) {
    const h = (r.holdUntil - Date.now()) / 3600000;
    return h <= 0 ? '지남' : h < 1 ? `${Math.ceil(h * 60)}분 남음` : `${Math.floor(h)}시간 남음`;
  }
  function quick(r) {
    if (r.status === 'pending' || r.status === 'expired') return `<button type="button" class="btn ok-btn s" data-kind="crew" data-act="confirm" data-id="${esc(r.id)}">입금 확인(확정)</button>`;
    if (r.status === 'expiring' || r.status === 'ended') return `<button type="button" class="btn primary s" data-kind="crew" data-act="renew" data-id="${esc(r.id)}">연장 확정</button>`;
    return '';
  }
  function detailHtml(r) {
    const a = (act, label, cls = 'secondary', extra = '') => `<button type="button" class="btn ${cls} s" ${extra} data-kind="crew" data-act="${act}" data-id="${esc(r.id)}">${label}</button>`;
    const acts = [a('memo', `${ic('edit', 18)}메모 저장`)];
    if (r.status === 'pending' || r.status === 'expired') acts.push(a('confirm', `${ic('check', 18)}입금 확인(확정)`, 'ok-btn'));
    if (r.status === 'expiring' || r.status === 'ended') {
      acts.push(a('renew', `${ic('refresh', 18)}연장 확정(입금 확인)`, 'primary'));
      acts.push(a('remind', `${ic('msg', 18)}연장 안내 문자${r.remindedAt ? ' 다시 보내기' : ''}`));
    }
    if (r.cancelRequest && r.status !== 'canceled') acts.push(a('dismiss', '취소 요청 반려'));
    if (r.status !== 'canceled') acts.push(r.cancelRequest ? a('cancel', '취소 승인(환불 후 처리)', 'danger') : a('cancel', '취소', 'secondary', 'style="color:var(--c-bad-fg);border-color:var(--c-bad-fg)"'));
    const dd = (v) => `<dd style="text-align:left">${v}</dd>`;
    const ev = (r.events || []).slice().reverse().map((e) => `<div><b>${formatKstDateTime(e.t)}</b>${esc(e.text)}</div>`).join('') || '<div>이력이 없습니다.</div>';
    return `<div class="rdet"><dl class="kv" style="grid-template-columns:auto 1fr;text-align:left">
      <dt>신청번호</dt>${dd(`${esc(r.id)}${r.source === 'admin' ? ' (직접 등록)' : ''}`)}
      <dt>연락처</dt>${dd(`<a href="tel:${esc(r.phone)}" class="row-f" style="display:inline-flex">${ic('phone', 18)}${esc(r.phone)}</a>`)}
      <dt>성별·나이</dt>${dd(`${r.gender === 'm' ? '남성' : '여성'}${r.age ? ` · ${r.age}세` : ''}`)}
      <dt>지역(동)</dt>${dd(esc(r.dong || '-'))}
      <dt>이용 기간</dt>${dd(`${crewPeriod(r)} (수업 ${r.sessions?.length ?? 0}번)`)}
      <dt>이번 금액</dt>${dd(`${won(r.amount)} · 누적 ${r.paidMonths || 0}개월 납부`)}
      ${r.sms ? `<dt>문자</dt>${dd(`${esc(r.sms.label)} · ${SMS_TXT[r.sms.status] || ''}`)}` : ''}
      <dt>접수 시각</dt>${dd(formatKstDateTime(r.createdAt))}
      ${r.status === 'pending' ? `<dt>입금 기한</dt>${dd(`${formatKstDateTime(r.holdUntil)}까지`)}` : ''}
      ${r.cancelRequest ? `<dt>취소 요청</dt><dd style="text-align:left;color:var(--c-bad-fg)">${esc(r.cancelRequest.reason || '사유 없음')}</dd>` : ''}
    </dl>
    <div class="field"><label for="memo-${esc(r.id)}">관리자 메모</label><textarea id="memo-${esc(r.id)}" class="input" maxlength="300">${esc(r.memo || '')}</textarea></div>
    <div class="row-f wrapf">${acts.join('')}</div>
    <div class="hist"><b>변경 이력</b>${ev}</div></div>`;
  }
  function rowHtml(r, open) {
    const req = r.cancelRequest && r.status !== 'canceled';
    const memo = r.memo ? ` <span class="badge b-off" style="margin-left:4px">${ic('edit', 14)}메모 있음</span>` : '';
    const sms = r.sms ? ` <span class="muted sm">· 문자 ${({ sent: '✓', test: '건너뜀', off: '꺼짐', failed: '✗ 실패' })[r.sms.status] || ''}</span>` : '';
    const late = r.status === 'pending' ? `<span class="late ${(r.holdUntil - Date.now()) / 3600000 < 6 ? 'hot' : ''}">${ic('clock', 18)}입금 기한 ${holdText(r)}</span>` : '';
    return `<div class="ritem ${open ? 'open' : ''} ${req ? 'req' : ''}"><div class="rrow"><span class="boxl"></span>
      <button type="button" class="rmain" data-open="${esc(r.id)}" aria-expanded="${open}"><b style="font-size:20px">${esc(crewTitle(r))}</b><span>${kindTag('crew')} ${esc(r.name)} · ${crewPeriod(r)}${memo}${sms}</span>${late}</button>
      <div class="rside"><span class="amt num">${won(r.amount)}</span>${crewStatusBadge(r)}${quick(r)}</div></div>${open ? detailHtml(r) : ''}</div>`;
  }

  /* ---------- 처리 ---------- */
  // 버튼 하나를 처리합니다. 처리했으면 true(목록을 새로 불러와야 함)를 돌려줍니다.
  async function act(kind, id, memoValue) {
    const r = items.find((x) => x.id === id);
    if (!r) return false;
    const who = `<p class="b">${esc(r.name)}님 · ${esc(crewTitle(r))}</p>`;
    if (kind === 'memo') { await call({ action: 'memo', id, memo: memoValue }); toast('메모를 저장했어요.'); return true; }
    if (kind === 'dismiss') { await call({ action: 'dismiss', id }); toast('취소 요청을 반려했어요.'); return true; }
    if (kind === 'confirm') {
      if (!(await ask({ title: '입금 확인', body: `${who}<p>${won(r.amount)} 입금을 통장에서 확인했나요? 확정하면 ${esc(r.phone)} 번호로 확정 문자가 가요.</p>`, ok: '확인했어요', okClass: 'ok-btn', okIcon: 'check', no: '아니요' }))) return false;
      const j = await call({ action: 'confirm', id });
      toast(j.smsSent ? '입금을 확인하고 확정했어요. 확정 문자를 보냈어요.' : '입금을 확인하고 확정했어요.');
      return true;
    }
    if (kind === 'renew') {
      if (!(await ask({ title: '연장 확정', body: `${who}<p>연장 입금을 확인했나요? 한 달 더 연장하고 확정 문자를 보내요.</p>`, ok: '연장하기', okClass: 'primary', no: '아니요' }))) return false;
      const j = await call({ action: 'renew', id });
      toast(`${LONG(j.periodStart)} ~ ${LONG(j.periodEnd)}로 연장했어요.${j.smsSent ? ' 문자를 보냈어요.' : ''}`);
      return true;
    }
    if (kind === 'remind') {
      if (!(await ask({ title: '연장 안내 문자', body: `${who}<p>${esc(r.phone)} 번호로 계좌와 연장 안내가 가요.</p>`, ok: '문자 보내기', okClass: 'primary', no: '아니요' }))) return false;
      const j = await call({ action: 'remind', id });
      toast(j.smsSent ? '연장 안내 문자를 보냈어요.' : '문자를 보내지 못했어요. 문자 설정과 잔액을 확인하세요.', !j.smsSent);
      return true;
    }
    if (kind === 'cancel') {
      const a = await ask({ title: '신청 취소', body: `${who}<p class="muted sm">취소하면 자리가 다시 열려요. 환불은 따로 처리해 주세요.</p>`, reason: { label: '취소 사유', placeholder: '사유를 적어 주세요' }, ok: '취소하기', okClass: 'danger', no: '돌아가기' });
      if (!a) return false;
      await call({ action: 'cancel', id, note: a.note });
      toast(`${r.name}님 신청을 취소했어요.`);
      return true;
    }
    return false;
  }

  /* ---------- 현황, 이력, 내보내기 ---------- */
  function seatsHtml() {
    const today = todayKst(Date.now());
    return allSlots().map((s) => {
      const n = items.filter((r) => r.slot === s.id && ['pending', 'active', 'expiring'].includes(r.status) && r.periodEnd >= today).length;
      const p = findProgram(s.programId);
      return `<span class="badge b-${n >= s.capacity ? 'bad' : n ? 'pend' : 'off'}">${esc(p.name)} ${WEEKDAY[s.weekday]} ${s.time} · 정원 ${n}/${s.capacity}</span>`;
    }).join('');
  }
  function eventsFlat() {
    const out = [];
    for (const r of items) for (const e of r.events || []) out.push({ t: e.t, kind: 'crew', id: r.id, title: `${esc(r.name)} · ${esc(crewTitle(r))}`, text: esc(e.text), status: STATUS_TXT[r.status] || '' });
    return out;
  }
  function csv() {
    const head = ['신청번호', '이름', '연락처', '성별', '나이', '지역(동)', '소모임', '요일', '시간', '시작일', '종료일', '상태', '이번 금액', '납부 개월', '신청 일시'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head, ...items.map((r) => [r.id, r.name, r.phone, r.gender === 'm' ? '남' : '여', r.age ?? '', r.dong ?? '', findProgram(r.programId)?.name || r.programId, WEEKDAY[r.weekday], r.time, r.periodStart, r.periodEnd, STATUS_TXT[r.status] || r.status, r.amount, r.paidMonths || 0, formatKstDateTime(r.createdAt)])];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `소모임신청_${todayKst(Date.now())}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- 직접 등록 양식 ---------- */
  function formHtml() {
    return `<form class="card stack" data-c="form" novalidate>
      <div class="cols2"><div class="field"><label for="cp-prog">소모임</label><select class="input" id="cp-prog" data-c="prog">${CREW.programs.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="cp-slot">요일·시간</label><select class="input" id="cp-slot" data-c="slot"></select></div></div>
      <div class="cols2"><div class="field"><label for="cp-start">시작일</label><input class="input" id="cp-start" data-c="start" type="date" required></div>
        <div class="field"><label for="cp-amount">금액(원, 비우면 ${won(CREW.fee)})</label><input class="input num" id="cp-amount" data-c="amount" type="number" min="0" step="1000" inputmode="numeric"></div></div>
      <div class="cols2"><div class="field"><label for="cp-name">이름</label><input class="input" id="cp-name" data-c="name" maxlength="20" required></div>
        <div class="field"><label for="cp-phone">휴대전화</label><input class="input" id="cp-phone" data-c="phone" type="tel" inputmode="tel" placeholder="010-0000-0000" required></div></div>
      <div class="cols3"><div class="field"><label for="cp-gender">성별</label><select class="input" id="cp-gender" data-c="gender"><option value="f">여성</option><option value="m">남성</option></select></div>
        <div class="field"><label for="cp-age">나이(선택)</label><input class="input" id="cp-age" data-c="age" type="number" min="10" max="120" inputmode="numeric"></div>
        <div class="field"><label for="cp-dong">지역(동)</label><input class="input" id="cp-dong" data-c="dong" maxlength="20" placeholder="예: 마두동" required></div></div>
      <label class="check on" data-c="confirmedL"><input type="checkbox" data-c="confirmed" class="sr-only" checked><span class="box on">${ic('check', 20)}</span><span>입금 확인 완료(확정으로 등록, 확정 문자 발송)</span></label>
      <div data-c="err" role="alert" aria-live="polite"></div>
      <button class="btn primary block" type="submit" data-c="submit">등록하기</button>
    </form>`;
  }
  function bindForm(root, onDone) {
    const q = (k) => root.querySelector(`[data-c="${k}"]`);
    function fillStart() {
      const wd = Number(q('slot').selectedOptions[0]?.dataset.wd);
      if (!Number.isNaN(wd)) q('start').value = firstOnOrAfter(addDays(todayKst(Date.now()), 1), wd);
    }
    function fillSlots() {
      const p = findProgram(q('prog').value);
      q('slot').innerHTML = allSlots().filter((s) => s.programId === p.id).map((s) => `<option value="${s.id}" data-wd="${s.weekday}">${WEEKDAY[s.weekday]}요일 ${s.time}</option>`).join('');
      fillStart();
    }
    q('prog').addEventListener('change', fillSlots);
    q('slot').addEventListener('change', fillStart);
    fillSlots();
    q('confirmed').addEventListener('change', (e) => {
      q('confirmedL').classList.toggle('on', e.target.checked);
      const bx = q('confirmedL').querySelector('.box');
      bx.classList.toggle('on', e.target.checked);
      bx.innerHTML = e.target.checked ? ic('check', 20) : '';
    });
    q('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      q('err').innerHTML = '';
      const btn = q('submit');
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span>등록하는 중…';
      try {
        const j = await call({
          action: 'create',
          application: {
            slot: q('slot').value, start: q('start').value, name: q('name').value, phone: q('phone').value,
            gender: q('gender').value, age: q('age').value, dong: q('dong').value, amount: q('amount').value, confirmed: q('confirmed').checked,
          },
        });
        toast(j.smsSent ? '소모임 신청을 등록했어요. 안내 문자를 보냈어요.' : '소모임 신청을 등록했어요.');
        for (const k of ['name', 'phone', 'age', 'amount', 'dong']) q(k).value = '';
        await onDone?.();
      } catch (err) { q('err').innerHTML = errMsg(err.message); }
      btn.disabled = false; btn.textContent = '등록하기';
    });
  }

  return { call, load, items: () => items, rowHtml, act, seatsHtml, eventsFlat, csv, formHtml, bindForm };
}
