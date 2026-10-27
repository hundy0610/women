import { ic } from '/icons.js';
import { watchOverlay, openOverlay, closeOverlay } from '/overlay.js';
import { CREW, WEEKDAY, allSlots, findProgram } from '/shared/crew-config.mjs';
import { firstOnOrAfter } from '/shared/crew-rules.mjs';
import { todayKst, addDays, formatKstDateTime } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LONG = (d) => { const [, m, dd] = String(d).split('-').map(Number); return `${m}월 ${dd}일`; };
const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
const errMsg = (t) => (t ? `<p class="msg err">${ic('alert', 18)}${esc(t)}</p>` : '');

const FILTERS = [
  ['pending', '입금 대기'], ['expiring', '곧 만료·만료'], ['active', '이용 중'], ['closed', '취소·기한 만료'], ['all', '전체'],
];
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

let pw = '';
let items = [];
let smsOn = false;
let filter = 'pending';
let query = '';
let openId = null;

async function call(body) {
  const res = await fetch('/api/crew-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': pw }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) { const e = new Error(j?.error?.message || '요청에 실패했습니다.'); e.code = j?.error?.code; throw e; }
  return j;
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 3200);
}

function ask({ title, body = '', ok = '확인', okClass = 'primary', no = '돌아가기' }) {
  return new Promise((resolve) => {
    const d = $('#adlg');
    $('#adlgBox').innerHTML = `<div class="dlg-h"><h2 id="adlgT">${title}</h2><button type="button" class="xbtn" data-no aria-label="닫기">${ic('x', 24)}</button></div>${body}<div class="cols2"><button type="button" class="btn ${okClass}" data-ok>${ok}</button><button type="button" class="btn secondary" data-no>${no}</button></div>`;
    let done = false;
    const finish = (v) => { if (done) return; done = true; d.removeEventListener('click', onClick); d.removeEventListener('close', onClose); closeOverlay(d); resolve(v); };
    const onClick = (e) => { if (e.target.closest('[data-ok]')) finish(true); else if (e.target.closest('[data-no]') || e.target.classList.contains('scrim')) finish(false); };
    const onClose = () => finish(false);
    d.addEventListener('click', onClick);
    d.addEventListener('close', onClose);
    openOverlay(d);
    $('#adlgBox [data-ok]').focus();
  });
}
watchOverlay($('#adlg'));

/* ---------- 그리기 ---------- */
const slotLabel = (r) => `${findProgram(r.programId)?.name || r.programId} · ${WEEKDAY[r.weekday]} ${r.time}`;

function seatChips() {
  const today = todayKst(Date.now());
  $('#seats').innerHTML = allSlots().map((s) => {
    const n = items.filter((r) => r.slot === s.id && ['pending', 'active', 'expiring'].includes(r.status) && r.periodEnd >= today).length;
    const p = findProgram(s.programId);
    const full = n >= s.capacity;
    return `<span class="badge b-${full ? 'bad' : n ? 'pend' : 'off'}">${esc(p.name)} ${WEEKDAY[s.weekday]} ${s.time} · ${n}/${s.capacity}</span>`;
  }).join('');
}

function renderStats() {
  const c = (f) => items.filter((r) => inFilter(r, f)).length;
  const st = (label, v, warn) => `<div class="stat ${warn && v ? 'warn' : ''}"><p class="b">${label}</p><p class="v num">${v}<small>건</small></p></div>`;
  $('#stats').innerHTML = st('입금 대기', c('pending'), true) + st('이용 중', c('active')) + st('곧 만료·만료', c('expiring'), true) + st('전체', items.length);
}

function renderRows() {
  $('#filters').innerHTML = FILTERS.map(([id, t]) => `<button type="button" class="chip ${filter === id ? 'on' : ''}" data-filter="${id}" aria-pressed="${filter === id}">${t} <span class="n">${items.filter((r) => inFilter(r, id)).length}</span></button>`).join('');
  const q = query.trim().toLowerCase();
  const rows = items.filter((r) => inFilter(r, filter)).filter((r) => !q || [r.name, r.phone, r.id].some((v) => String(v).toLowerCase().includes(q)));
  if (!rows.length) { $('#rows').innerHTML = '<div class="state"><h2>해당하는 신청이 없어요</h2></div>'; return; }
  $('#rows').innerHTML = rows.map((r) => {
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
        <span class="muted sm">${esc(slotLabel(r))} · ${LONG(r.periodStart)} ~ ${LONG(r.periodEnd)}</span>
      </button>
      ${open ? `<div class="rdet stack"><dl class="kv"><dt>신청번호</dt><dd class="num">${esc(r.id)}</dd><dt>연락처</dt><dd>${esc(r.phone)}</dd><dt>성별·나이</dt><dd>${r.gender === 'm' ? '남성' : '여성'}${r.age ? ` · ${r.age}세` : ''}</dd><dt>지역(동)</dt><dd>${esc(r.dong || '')}</dd><dt>이번 금액</dt><dd>${won(r.amount)} · 누적 ${r.paidMonths || 0}개월 납부</dd>${r.status === 'pending' ? `<dt>입금 기한</dt><dd>${formatKstDateTime(r.holdUntil)}까지</dd>` : ''}${r.cancelRequest ? `<dt>취소 요청</dt><dd>${esc(r.cancelRequest.reason || '사유 없음')}</dd>` : ''}</dl>
        <div class="row-f wrapf">${actions.join('')}</div>
        <div class="hist sm muted stack" style="gap:4px">${ev}</div></div>` : ''}
    </article>`;
  }).join('');
}

function renderAll() { renderStats(); seatChips(); renderRows(); }

async function load() {
  const j = await call({ action: 'list' });
  items = j.items; smsOn = j.smsEnabled;
  renderAll();
}

/* ---------- 이벤트 ---------- */
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  pw = $('#pw').value;
  $('#loginErr').innerHTML = '';
  const btn = $('#loginBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>확인하는 중…';
  try {
    await load();
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    $('#loginView').hidden = true; $('#appView').hidden = false;
  } catch (err) { $('#loginErr').innerHTML = errMsg(err.message); $('#pw').classList.add('err'); }
  btn.disabled = false; btn.textContent = '들어가기';
});
$('#logout').innerHTML = `${ic('out', 20)}나가기`;
$('#logout').addEventListener('click', () => { try { sessionStorage.removeItem('women:adm'); } catch { /* 무시 */ } location.reload(); });
$('#reload').innerHTML = `${ic('refresh', 18)}새로고침`;
$('#reload').addEventListener('click', async () => { try { await load(); toast('새로 불러왔어요.'); } catch (e) { toast(e.message); } });
$('#q').addEventListener('input', (e) => { query = e.target.value; renderRows(); });
$('#aDate').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });

document.addEventListener('click', async (e) => {
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
      toast(j.smsSent ? '연장 안내 문자를 보냈어요.' : '문자를 보내지 못했어요. 문자 설정과 잔액을 확인하세요.');
    } else if (act === 'cancel') {
      if (!(await ask({ title: '신청을 취소할까요?', body: `${who}<p class="muted">취소하면 자리가 다시 열려요. 환불은 따로 처리해 주세요.</p>`, ok: '취소하기', okClass: 'danger' }))) return;
      await call({ action: 'cancel', id });
      toast('취소했어요.');
    }
    await load();
  } catch (err) { toast(err.message); }
});

/* ---------- 직접 등록 ---------- */
$('#n-prog').innerHTML = CREW.programs.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
function fillSlots() {
  const p = findProgram($('#n-prog').value);
  $('#n-slot').innerHTML = allSlots().filter((s) => s.programId === p.id).map((s) => `<option value="${s.id}" data-wd="${s.weekday}">${WEEKDAY[s.weekday]}요일 ${s.time}</option>`).join('');
  fillStart();
}
function fillStart() {
  const wd = Number($('#n-slot').selectedOptions[0]?.dataset.wd);
  if (!Number.isNaN(wd)) $('#n-start').value = firstOnOrAfter(addDays(todayKst(Date.now()), 1), wd);
}
$('#n-prog').addEventListener('change', fillSlots);
$('#n-slot').addEventListener('change', fillStart);
fillSlots();
$('#n-confirmed-l .box').innerHTML = ic('check', 20);
$('#n-confirmed').addEventListener('change', (e) => {
  $('#n-confirmed-l').classList.toggle('on', e.target.checked);
  const bx = $('#n-confirmed-l .box');
  bx.classList.toggle('on', e.target.checked);
  bx.innerHTML = e.target.checked ? ic('check', 20) : '';
});
$('#newForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-err').innerHTML = '';
  const btn = $('#n-submit');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>등록하는 중…';
  try {
    const j = await call({
      action: 'create',
      application: {
        slot: $('#n-slot').value, start: $('#n-start').value, name: $('#n-name').value, phone: $('#n-phone').value,
        gender: $('#n-gender').value, age: $('#n-age').value, dong: $('#n-dong').value, amount: $('#n-amount').value, confirmed: $('#n-confirmed').checked,
      },
    });
    toast(j.smsSent ? '등록했어요. 안내 문자를 보냈어요.' : '등록했어요.');
    $('#n-name').value = ''; $('#n-phone').value = ''; $('#n-dong').value = ''; $('#n-age').value = ''; $('#n-amount').value = '';
    await load();
  } catch (err) { $('#n-err').innerHTML = errMsg(err.message); }
  btn.disabled = false; btn.textContent = '등록하기';
});

/* ---------- 시작: 대관 관리에서 로그인한 비밀번호가 있으면 이어서 씁니다 ---------- */
(async () => {
  try { pw = sessionStorage.getItem('women:adm') || ''; } catch { /* 무시 */ }
  if (!pw) return;
  try { await load(); $('#loginView').hidden = true; $('#appView').hidden = false; } catch { pw = ''; }
})();
