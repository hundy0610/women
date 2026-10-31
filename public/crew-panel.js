// 관리자 화면 안의 "소모임" 패널: 신청 목록(입금 확인, 연장, 취소, 직접 등록)과 이력, CSV 내려받기.
// 대관 관리자(/admin)의 탭으로 들어갑니다. 비밀번호, 알림창, 안내 메시지는 관리자 화면 것을 그대로 받아 씁니다.
import { ic } from '/icons.js';
import { CREW, WEEKDAY, allSlots, findProgram } from '/shared/crew-config.mjs';
import { firstOnOrAfter } from '/shared/crew-rules.mjs';
import { todayKst, addDays, formatKstDateTime } from '/shared/time.mjs';

const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LONG = (d) => { const [, m, dd] = String(d).split('-').map(Number); return `${m}월 ${dd}일`; };
const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
const errMsg = (t) => (t ? `<p class="msg err">${ic('alert', 18)}${esc(t)}</p>` : '');
const SMS_TXT = { sent: '발송 접수됨', test: '건너뜀(테스트)', off: '건너뜀(설정 꺼짐)', failed: '실패' };
const STATUS_TXT = { pending: '입금 대기', active: '이용 중', expiring: '곧 만료', ended: '기간 끝남', expired: '기한 만료', canceled: '취소' };

const FILTERS = [['pending', '입금 대기'], ['expiring', '곧 만료·만료'], ['active', '이용 중'], ['closed', '취소·기한 만료'], ['all', '전체']];
const inFilter = (r, f) => {
  if (f === 'all') return true;
  if (f === 'expiring') return r.status === 'expiring' || r.status === 'ended';
  if (f === 'closed') return r.status === 'canceled' || r.status === 'expired';
  return r.status === f;
};
function statusBadge(r) {
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
const slotLabel = (r) => `${findProgram(r.programId)?.name || r.programId} · ${WEEKDAY[r.weekday]} ${r.time}`;

export function mountCrewPanel(root, { getPw, toast, ask }) {
  let items = [];
  let view = 'list';
  let filter = 'pending';
  let query = '';
  let logQuery = '';
  let openId = null;
  const q = (k) => root.querySelector(`[data-c="${k}"]`);

  async function call(body) {
    const res = await fetch('/api/crew-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': getPw() }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) { const e = new Error(j?.error?.message || '요청에 실패했습니다.'); e.code = j?.error?.code; throw e; }
    return j;
  }

  root.innerHTML = `<div class="crewpanel">
    <div class="row-f sp-b wrapf cp-top">
      <div class="seg" role="group" aria-label="보기"><button type="button" data-cv="list" aria-pressed="true">${ic('list', 18)}신청 목록</button><button type="button" data-cv="log" aria-pressed="false">${ic('hist', 18)}이력</button></div>
      <div class="row-f"><button type="button" class="btn secondary s" data-c="csv">${ic('down', 18)}CSV</button><button type="button" class="btn secondary s" data-c="reload">${ic('refresh', 18)}새로고침</button></div>
    </div>
    <div data-c="v-list" class="cadm">
      <div class="cadm-r">
        <div class="stats" data-c="stats"></div>
        <div class="card stack"><h2 class="row-f">시간대별 정원</h2><div class="chips cp-seats" data-c="seats"></div></div>
        <details class="card cp-box" data-c="box">
          <summary class="b" style="cursor:pointer;min-height:44px;display:flex;align-items:center">직접 등록 (전화·방문 접수)</summary>
          <form class="stack cp-form" data-c="form" novalidate style="margin-top:12px">
            <div class="cols2"><div class="field"><label for="cp-prog">소모임</label><select class="input" id="cp-prog" data-c="prog"></select></div>
              <div class="field"><label for="cp-slot">요일·시간</label><select class="input" id="cp-slot" data-c="slot"></select></div></div>
            <div class="cols2"><div class="field"><label for="cp-start">시작일</label><input class="input" id="cp-start" data-c="start" type="date" required></div>
              <div class="field"><label for="cp-amount">금액(원)</label><input class="input num" id="cp-amount" data-c="amount" type="number" min="0" step="1000" inputmode="numeric"></div></div>
            <div class="cols2"><div class="field"><label for="cp-name">이름</label><input class="input" id="cp-name" data-c="name" maxlength="20" required></div>
              <div class="field"><label for="cp-phone">휴대전화</label><input class="input" id="cp-phone" data-c="phone" type="tel" inputmode="tel" placeholder="010-0000-0000" required></div></div>
            <div class="cols3"><div class="field"><label for="cp-gender">성별</label><select class="input" id="cp-gender" data-c="gender"><option value="f">여성</option><option value="m">남성</option></select></div>
              <div class="field"><label for="cp-age">나이(선택)</label><input class="input" id="cp-age" data-c="age" type="number" min="10" max="120" inputmode="numeric"></div>
              <div class="field"><label for="cp-dong">지역(동)</label><input class="input" id="cp-dong" data-c="dong" maxlength="20" placeholder="예: 마두동" required></div></div>
            <label class="check on" data-c="confirmedL"><input type="checkbox" data-c="confirmed" class="sr-only" checked><span class="box on">${ic('check', 20)}</span><span>입금 확인 완료(확정으로 등록, 확정 문자 발송)</span></label>
            <div data-c="err" role="alert" aria-live="polite"></div>
            <button class="btn primary block" type="submit" data-c="submit">등록하기</button>
          </form>
        </details>
      </div>
      <div class="cadm-l">
        <div class="chips cp-filters" data-c="filters" role="group" aria-label="상태 필터"></div>
        <div class="field search"><input class="input" data-c="q" type="search" placeholder="이름, 전화번호, 신청번호 검색" aria-label="검색"><span class="si" aria-hidden="true">${ic('search', 24)}</span></div>
        <div class="stack cp-rows" data-c="rows"></div>
      </div>
    </div>
    <div data-c="v-log" hidden>
      <div class="field search" style="margin-bottom:12px"><input class="input" data-c="lq" type="search" placeholder="이름, 전화번호, 신청번호로 이력 검색" aria-label="이력 검색"><span class="si" aria-hidden="true">${ic('search', 24)}</span></div>
      <div class="card"><div class="tl" data-c="log"></div></div>
    </div>
  </div>`;

  /* ---------- 그리기 ---------- */
  function seatChips() {
    const today = todayKst(Date.now());
    q('seats').innerHTML = allSlots().map((s) => {
      const n = items.filter((r) => r.slot === s.id && ['pending', 'active', 'expiring'].includes(r.status) && r.periodEnd >= today).length;
      const p = findProgram(s.programId);
      return `<span class="badge b-${n >= s.capacity ? 'bad' : n ? 'pend' : 'off'}">${esc(p.name)} ${WEEKDAY[s.weekday]} ${s.time} · 정원 ${n}/${s.capacity}</span>`;
    }).join('');
  }
  function renderStats() {
    const c = (f) => items.filter((r) => inFilter(r, f)).length;
    const st = (label, v, warn) => `<div class="stat ${warn && v ? 'warn' : ''}"><p class="b">${label}</p><p class="v num">${v}<small>건</small></p></div>`;
    q('stats').innerHTML = st('입금 대기', c('pending'), true) + st('이용 중', c('active')) + st('곧 만료·만료', c('expiring'), true) + st('전체', items.length);
  }
  function renderRows() {
    q('filters').innerHTML = FILTERS.map(([id, t]) => `<button type="button" class="chip ${filter === id ? 'on' : ''}" data-filter="${id}" aria-pressed="${filter === id}">${t} <span class="n">${items.filter((r) => inFilter(r, id)).length}</span></button>`).join('');
    const s = query.trim().toLowerCase();
    const rows = items.filter((r) => inFilter(r, filter)).filter((r) => !s || [r.name, r.phone, r.id].some((v) => String(v).toLowerCase().includes(s)));
    if (!rows.length) { q('rows').innerHTML = '<div class="state"><h2>해당하는 신청이 없어요</h2></div>'; return; }
    q('rows').innerHTML = rows.map((r) => {
      const open = openId === r.id;
      const actions = [];
      if (r.status === 'pending' || r.status === 'expired') actions.push(`<button type="button" class="btn primary s" data-act="confirm" data-id="${r.id}">${ic('check', 18)}입금 확인(확정)</button>`);
      if (r.status === 'expiring' || r.status === 'ended') {
        actions.push(`<button type="button" class="btn primary s" data-act="renew" data-id="${r.id}">${ic('refresh', 18)}연장 확정(입금 확인)</button>`);
        actions.push(`<button type="button" class="btn secondary s" data-act="remind" data-id="${r.id}">${ic('msg', 18)}연장 안내 문자${r.remindedAt ? ' 다시 보내기' : ''}</button>`);
      }
      if (r.status !== 'canceled') actions.push(`<button type="button" class="btn ${r.cancelRequest ? 'danger' : 'secondary'} s" data-act="cancel" data-id="${r.id}">${r.cancelRequest ? '취소 요청 처리' : '취소'}</button>`);
      const ev = (r.events || []).slice().reverse().map((e) => `<div><b>${formatKstDateTime(e.t)}</b> ${esc(e.text)}</div>`).join('');
      return `<article class="ritem ${open ? 'open' : ''}">
        <button type="button" class="rrow rmain" data-open="${r.id}" aria-expanded="${open}" style="width:100%;text-align:left">
          <span class="rtop"><b>${esc(r.name)}</b> ${statusBadge(r)}</span>
          <span class="muted sm">${esc(slotLabel(r))} · ${LONG(r.periodStart)} ~ ${LONG(r.periodEnd)}${r.sms ? ` · 문자 ${({ sent: '✓', test: '건너뜀', off: '꺼짐', failed: '✗ 실패' })[r.sms.status] || ''}` : ''}</span>
        </button>
        ${open ? `<div class="rdet stack"><dl class="kv"><dt>신청번호</dt><dd class="num">${esc(r.id)}</dd><dt>연락처</dt><dd>${esc(r.phone)}</dd><dt>성별·나이</dt><dd>${r.gender === 'm' ? '남성' : '여성'}${r.age ? ` · ${r.age}세` : ''}</dd><dt>지역(동)</dt><dd>${esc(r.dong || '')}</dd>${r.sms ? `<dt>문자</dt><dd>${esc(r.sms.label)} · ${SMS_TXT[r.sms.status] || ''}</dd>` : ''}<dt>이번 금액</dt><dd>${won(r.amount)} · 누적 ${r.paidMonths || 0}개월 납부</dd>${r.status === 'pending' ? `<dt>입금 기한</dt><dd>${formatKstDateTime(r.holdUntil)}까지</dd>` : ''}${r.cancelRequest ? `<dt>취소 요청</dt><dd>${esc(r.cancelRequest.reason || '사유 없음')}</dd>` : ''}</dl>
          <div class="row-f wrapf">${actions.join('')}</div>
          <div class="hist sm muted stack" style="gap:4px">${ev}</div></div>` : ''}
      </article>`;
    }).join('');
  }
  function renderLog() {
    const s = logQuery.trim().toLowerCase();
    const all = [];
    for (const r of items) for (const e of r.events || []) all.push({ t: e.t, text: e.text, r });
    all.sort((a, b) => b.t - a.t);
    const rows = all.filter((x) => !s || [x.r.name, x.r.phone, x.r.id].some((v) => String(v).toLowerCase().includes(s))).slice(0, 400);
    q('log').innerHTML = rows.length
      ? rows.map((x) => `<div><b class="num">${formatKstDateTime(x.t)}</b><span><b>${esc(x.r.name)}</b> · ${esc(slotLabel(x.r))} <span class="muted sm">(${esc(x.r.id)} · ${STATUS_TXT[x.r.status] || ''})</span><br>${esc(x.text)}</span></div>`).join('')
      : '<p class="muted" style="padding:12px 0">이력이 없어요.</p>';
  }
  function renderAll() { renderStats(); seatChips(); renderRows(); renderLog(); }
  function setView(v) {
    view = v;
    q('v-list').hidden = v !== 'list'; q('v-log').hidden = v !== 'log';
    for (const b of root.querySelectorAll('[data-cv]')) b.setAttribute('aria-pressed', String(b.dataset.cv === v));
  }

  async function load() {
    const j = await call({ action: 'list' });
    items = j.items;
    renderAll();
    return items;
  }
  async function refresh(msg) { try { await load(); if (msg) toast(msg); } catch (e) { toast(e.message, true); } }

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

  /* ---------- 이벤트 ---------- */
  root.addEventListener('click', async (e) => {
    const cv = e.target.closest('[data-cv]');
    if (cv) return setView(cv.dataset.cv);
    if (e.target.closest('[data-c="csv"]')) return csv();
    if (e.target.closest('[data-c="reload"]')) return refresh('새로 불러왔어요.');
    const f = e.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; return renderRows(); }
    const o = e.target.closest('[data-open]');
    if (o) { openId = openId === o.dataset.open ? null : o.dataset.open; return renderRows(); }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const id = a.dataset.id;
    const r = items.find((x) => x.id === id);
    const act = a.dataset.act;
    const who = `<p>${esc(r.name)} · ${esc(slotLabel(r))}</p>`;
    try {
      if (act === 'confirm') {
        if (!(await ask({ title: '입금을 확인했나요?', body: `${who}<p class="muted">확정하면 ${esc(r.phone)} 번호로 확정 문자가 가요.</p>`, ok: '확정하기' }))) return;
        const j = await call({ action: 'confirm', id });
        toast(j.smsSent ? '확정했어요. 확정 문자를 보냈어요.' : '확정했어요.');
      } else if (act === 'renew') {
        if (!(await ask({ title: '연장 입금을 확인했나요?', body: `${who}<p class="muted">한 달 더 연장하고 확정 문자를 보내요.</p>`, ok: '연장하기' }))) return;
        const j = await call({ action: 'renew', id });
        toast(`${LONG(j.periodStart)} ~ ${LONG(j.periodEnd)}로 연장했어요.${j.smsSent ? ' 문자를 보냈어요.' : ''}`);
      } else if (act === 'remind') {
        if (!(await ask({ title: '연장 안내 문자를 보낼까요?', body: `${who}<p class="muted">${esc(r.phone)} 번호로 계좌와 연장 안내가 가요.</p>`, ok: '문자 보내기' }))) return;
        const j = await call({ action: 'remind', id });
        toast(j.smsSent ? '연장 안내 문자를 보냈어요.' : '문자를 보내지 못했어요. 문자 설정과 잔액을 확인하세요.', !j.smsSent);
      } else if (act === 'cancel') {
        if (!(await ask({ title: '신청을 취소할까요?', body: `${who}<p class="muted">취소하면 자리가 다시 열려요. 환불은 따로 처리해 주세요.</p>`, ok: '취소하기', okClass: 'danger' }))) return;
        await call({ action: 'cancel', id });
        toast('취소했어요.');
      }
      await load();
    } catch (err) { toast(err.message, true); }
  });
  q('q').addEventListener('input', (e) => { query = e.target.value; renderRows(); });
  q('lq').addEventListener('input', (e) => { logQuery = e.target.value; renderLog(); });

  /* ---------- 직접 등록 ---------- */
  q('prog').innerHTML = CREW.programs.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
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
      toast(j.smsSent ? '등록했어요. 안내 문자를 보냈어요.' : '등록했어요.');
      for (const k of ['name', 'phone', 'age', 'amount', 'dong']) q(k).value = '';
      await load();
    } catch (err) { q('err').innerHTML = errMsg(err.message); }
    btn.disabled = false; btn.textContent = '등록하기';
  });
  if (window.matchMedia('(min-width:1100px)').matches) q('box').open = true;

  return { load, items: () => items };
}
