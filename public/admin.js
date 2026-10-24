import { ic } from '/icons.js';
import { watchOverlay, openOverlay, closeOverlay, overlayPop } from '/overlay.js';
import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { blockLabel } from '/shared/rules.mjs';
import { formatKoreanDate, formatKstDateTime, hh, todayKst, parseYmd, ymd, addDays } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { pending: '입금 대기', confirmed: '확정', canceled: '취소', expired: '기한 만료' };
const ACTION = { created: '예약 접수', admin_created: '직접 등록', confirmed: '입금 확인(확정)', canceled: '취소', memo: '메모 수정', password_changed: '비밀번호 변경', cancel_requested: '취소 요청', cancel_dismissed: '취소 요청 반려', block_added: '휴관일 추가', block_removed: '휴관일 해제' };
const TITLES = { list: '예약 목록', cal: '달력', log: '이력', new: '직접 등록', block: '휴관일', qr: 'QR 코드', set: '설정' };
const TAB_ICON = { list: 'list', cal: 'cal', log: 'hist', new: 'edit', block: 'ban', qr: 'qr', set: 'gear' };
const spaceNames = (ids) => ids.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');
const shortDate = (s) => { const [, m, d] = String(s).split('-').map(Number); return `${m}/${d}`; };

const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
const alertBox = (kind, ico, text, btn = '') => `<div class="alert a-${kind}">${ic(ico, 24)}<span>${text}</span>${btn}</div>`;
const errMsg = (t) => (t ? `<p class="msg err">${ic('alert', 18)}${esc(t)}</p>` : '');
const stateBox = (ico, text) => `<div class="state"><div class="ico">${ic(ico, 36)}</div><h2>${text}</h2></div>`;
function statusBadge(r) {
  if (r.status === 'confirmed' && r.cancelRequest) return badge('bad', '취소 요청', 'alert');
  if (r.status === 'pending') return badge('pend', '입금 대기', 'clock');
  if (r.status === 'confirmed') return badge('ok', '확정', 'check');
  if (r.status === 'expired') return badge('off', '기한 만료', 'clock');
  return badge('off', '취소', 'ban');
}

let pw = '';
let items = [];
let events = [];
let blocks = [];
let filter = 'pending';
let query = '';
let openId = null;
let density = 'card';
let calMonth = null;
let calDay = null;
const selected = new Set();
try { density = localStorage.getItem('women:density') || 'card'; } catch { /* 무시 */ }

const holdLeft = (r) => (r.holdUntil - Date.now()) / 3600000;
const holdText = (r) => { const h = holdLeft(r); return h <= 0 ? '지남' : h < 1 ? `${Math.ceil(h * 60)}분 남음` : `${Math.floor(h)}시간 남음`; };

async function call(body) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) {
    const e = new Error(j?.error?.message || '요청에 실패했습니다.');
    e.code = j?.error?.code;
    throw e;
  }
  return j;
}

/* ---------- 알림(토스트)과 확인 창 ---------- */
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.className = `toast ${bad ? 't-err' : 't-ok'}`;
  t.innerHTML = `${ic(bad ? 'alert' : 'check', 22)}<span>${esc(msg)}</span>`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

function ask({ title, body = '', reason = null, ok = '확인', okClass = 'primary', okIcon = '', no = '돌아가기' }) {
  return new Promise((resolve) => {
    const d = $('#adlg');
    $('#adlgBox').innerHTML = `<div class="dlg-h"><h2 id="adlgT">${title}</h2><button type="button" class="xbtn" data-no aria-label="닫기">${ic('x', 24)}</button></div>${body}${reason ? `<div class="field"><label for="adlgR">${reason.label} <span class="muted" style="font-weight:400">(선택)</span></label><textarea id="adlgR" class="input" maxlength="200" placeholder="${reason.placeholder}"></textarea></div>` : ''}<div class="cols2"><button type="button" class="btn ${okClass}" data-ok>${okIcon ? ic(okIcon, 20) : ''}${ok}</button><button type="button" class="btn secondary" data-no>${no}</button></div>`;
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      d.removeEventListener('click', onClick);
      d.removeEventListener('close', onClose);
      closeOverlay(d);
      resolve(v);
    };
    const onClick = (e) => {
      if (e.target.closest('[data-ok]')) finish({ note: $('#adlgR')?.value.trim() ?? '' });
      else if (e.target.closest('[data-no]') || e.target.classList.contains('scrim')) finish(null);
    };
    const onClose = () => finish(null);
    d.addEventListener('click', onClick);
    d.addEventListener('close', onClose);
    openOverlay(d);
    ($('#adlgR') || $('#adlgBox [data-ok]')).focus();
  });
}

/* ---------- 틀: 탭, 머리글 ---------- */
let curTab = 'list';
function badgeCount() {
  const n = items.filter((r) => r.status === 'pending').length + items.filter((r) => r.status === 'confirmed' && r.cancelRequest).length;
  document.title = n ? `(${n}) 예약 관리` : '예약 관리';
  for (const b of document.querySelectorAll('[data-t="list"]')) {
    b.querySelector('.n')?.remove();
    if (n) b.insertAdjacentHTML('beforeend', `<span class="n" aria-label="처리할 예약 ${n}건">${n}</span>`);
  }
}
function pageHead(tab) {
  $('#aTitle').textContent = TITLES[tab] || '';
  $('#density').hidden = tab !== 'list';
  const t = todayKst(Date.now());
  const n = items.filter((r) => r.status === 'confirmed' && r.date === t).length;
  $('#aDate').textContent = `${formatKoreanDate(t)}${n ? ` · 오늘 이용 ${n}건` : ''}`;
}
function setTab(t) {
  curTab = t;
  for (const b of document.querySelectorAll('[data-t]')) {
    const on = b.dataset.t === t;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  for (const x of Object.keys(TITLES)) $(`#tab-${x}`).hidden = x !== t;
  pageHead(t);
  if (['list', 'cal', 'log', 'block'].includes(t)) refresh();
  if (t === 'set') { loadNotify(); loadSms(); }
  window.scrollTo(0, 0);
}
function decorateStatic() {
  for (const b of document.querySelectorAll('[data-t]')) b.insertAdjacentHTML('afterbegin', ic(TAB_ICON[b.dataset.t], b.closest('.mtabs') ? 18 : 22));
  $('#logout').innerHTML = `${ic('out', 22)}나가기`;
  $('#logoutM').innerHTML = `${ic('out', 20)}나가기`;
  $('#cal-prev').innerHTML = ic('left');
  $('#cal-next').innerHTML = ic('right');
  $('#density [data-d="card"]').innerHTML = `${ic('grid', 18)}카드`;
  $('#density [data-d="dense"]').innerHTML = `${ic('list', 18)}목록`;
  $('.search .si').innerHTML = ic('search', 24);
  for (const a of document.querySelectorAll('.alert > .ai')) a.outerHTML = ic('info', 24);
  $('#n-submit').dataset.label = '등록하기';
  $('.result .ri').outerHTML = ic('clock', 24);
  $('#qr-png').innerHTML = `${ic('down', 18)}PNG`;
  $('#qr-svg').innerHTML = `${ic('down', 18)}SVG`;
  $('#qr-print').innerHTML = `${ic('print', 18)}인쇄`;
  $('#csv').innerHTML = `${ic('down', 18)}CSV 내려받기`;
  $('#notifyTest').innerHTML = `${ic('bell', 18)}테스트 알림 보내기`;
  for (const h of document.querySelectorAll('.hi')) h.outerHTML = ic(h.dataset.i, 24);
  $('#n-confirmed-l .box').innerHTML = ic('check', 20);
}
function applyDensity() {
  document.querySelectorAll('#density [data-d]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === density)));
}

/* ---------- 예약 목록 ---------- */
function stats() {
  const today = todayKst(Date.now());
  const month = today.slice(0, 7);
  const pending = items.filter((r) => r.status === 'pending');
  const confirmed = items.filter((r) => r.status === 'confirmed');
  const monthSum = confirmed.filter((r) => r.date.startsWith(month)).reduce((a, r) => a + r.amount, 0);
  const todays = confirmed.filter((r) => r.date === today).length;
  const reqs = confirmed.filter((r) => r.cancelRequest).length;
  $('#stats').innerHTML = `
    <div class="stat"><span class="b">입금 대기</span><span class="v num">${pending.length}<small>건</small></span><span class="sm muted">합계 ${won(pending.reduce((a, r) => a + r.amount, 0))}</span></div>
    <div class="stat"><span class="b">확정 예약</span><span class="v num">${confirmed.length}<small>건</small></span><span class="sm muted">이번 달 ${won(monthSum)}</span></div>
    <div class="stat"><span class="b">오늘 이용</span><span class="v num">${todays}<small>건</small></span><span class="sm muted">${formatKoreanDate(today)}</span></div>
    <div class="stat ${reqs ? 'warn' : ''}"><span class="b row-f">${reqs ? ic('alert', 20) : ''}취소 요청</span><span class="v num">${reqs}<small>건</small></span><span class="sm" style="font-weight:600">${reqs ? '환불 처리가 필요해요' : '없음'}</span></div>`;
}

function filtered() {
  const q = query.trim().toLowerCase().replace(/-/g, '');
  const today = todayKst(Date.now());
  const cmp = (a, b) => (a.date + String(a.start).padStart(2, '0')).localeCompare(b.date + String(b.start).padStart(2, '0'));
  const list = items.filter((r) => {
    if (filter === 'req') { if (!(r.status === 'confirmed' && r.cancelRequest)) return false; } else if (filter !== 'all' && r.status !== filter) return false;
    if (!q) return true;
    return [r.name, r.phone, r.id, r.purpose].some((v) => String(v || '').toLowerCase().replace(/-/g, '').includes(q));
  });
  // 입금 대기는 기한이 급한 순, 확정은 다가오는 이용일 순, 그 외는 최근 순
  if (filter === 'pending') return list.sort((a, b) => (a.holdUntil || 0) - (b.holdUntil || 0));
  if (filter === 'confirmed' || filter === 'req') return list.sort((a, b) => ((a.date >= today) === (b.date >= today) ? ((a.date >= today) ? cmp(a, b) : cmp(b, a)) : (a.date >= today ? -1 : 1)));
  return list.sort((a, b) => cmp(b, a));
}

function renderFilters() {
  const count = (s) => (s === 'all' ? items.length : s === 'req' ? items.filter((r) => r.status === 'confirmed' && r.cancelRequest).length : items.filter((r) => r.status === s).length);
  $('#filters').innerHTML = ['pending', 'req', 'confirmed', 'expired', 'canceled', 'all']
    .map((s) => `<button type="button" class="chip" data-f="${s}" aria-pressed="${filter === s}">${s === 'all' ? '전체' : s === 'req' ? '취소 요청' : LABEL[s]} <span class="n">${count(s)}</span></button>`).join('');
}

function historyFor(id) {
  const ev = events.filter((e) => e.id === id).sort((a, b) => a.t - b.t);
  return ev.length ? ev.map((e) => `<div><b>${formatKstDateTime(e.t)}</b>${ACTION[e.action] || e.action}${e.note ? ` · ${esc(e.note)}` : ''}</div>`).join('') : '<div>이력이 없습니다.</div>';
}

const boxChecked = (id) => `<label class="boxl"><input type="checkbox" class="sr-only" data-pick="${esc(id)}" ${selected.has(id) ? 'checked' : ''} aria-label="예약 선택"><span class="box ${selected.has(id) ? 'on' : ''}">${selected.has(id) ? ic('check', 18) : ''}</span></label>`;

function detail(r) {
  const acts = [`<button type="button" class="btn secondary s" data-act="memo" data-id="${esc(r.id)}">${ic('edit', 18)}메모 저장</button>`];
  if (r.status === 'pending' || r.status === 'expired') acts.push(`<button type="button" class="btn ok-btn s" data-act="confirm" data-id="${esc(r.id)}">${ic('check', 18)}입금 확인(확정)</button>`);
  if (r.status === 'confirmed' && r.cancelRequest) acts.push(`<button type="button" class="btn secondary s" data-act="dismiss" data-id="${esc(r.id)}">취소 요청 반려</button>`);
  if (r.status !== 'canceled') acts.push(r.cancelRequest
    ? `<button type="button" class="btn danger s" data-act="cancel" data-id="${esc(r.id)}">취소 승인(환불 후 처리)</button>`
    : `<button type="button" class="btn secondary s" style="color:var(--c-bad-fg);border-color:var(--c-bad-fg)" data-act="cancel" data-id="${esc(r.id)}">취소</button>`);
  const dd = (v) => `<dd style="text-align:left">${v}</dd>`;
  return `<div class="rdet"><dl class="kv" style="grid-template-columns:auto 1fr;text-align:left">
      <dt>예약번호</dt>${dd(`${esc(r.id)}${r.source === 'admin' ? ' (직접 등록)' : ''}`)}
      <dt>연락처</dt>${dd(`<a href="tel:${esc(r.phone)}" class="row-f" style="display:inline-flex">${ic('phone', 18)}${esc(r.phone)}</a>`)}
      <dt>인원</dt>${dd(`${r.people}명`)}
      <dt>이용 목적</dt>${dd(esc(r.purpose) || '-')}
      <dt>접수 시각</dt>${dd(formatKstDateTime(r.createdAt))}
      ${r.cancelRequest ? `<dt>취소 요청</dt><dd style="text-align:left;color:var(--c-bad-fg)">${formatKstDateTime(r.cancelRequest.at)}${r.cancelRequest.reason ? ` · 사유: ${esc(r.cancelRequest.reason)}` : ''}</dd>` : ''}
      ${r.holdUntil && r.status === 'pending' ? `<dt>입금 기한</dt>${dd(formatKstDateTime(r.holdUntil))}` : ''}
    </dl>
    <div class="field"><label for="memo-${esc(r.id)}">관리자 메모</label><textarea id="memo-${esc(r.id)}" class="input" maxlength="300">${esc(r.memo || '')}</textarea></div>
    <div class="row-f wrapf">${acts.join('')}</div>
    <div class="hist"><b>변경 이력</b>${historyFor(r.id)}</div></div>`;
}

function cardRow(r) {
  const open = openId === r.id;
  const pick = r.status !== 'canceled' ? boxChecked(r.id) : '<span class="boxl"></span>';
  const memo = r.memo ? ` <span class="badge b-off" style="margin-left:4px">${ic('edit', 14)}메모 있음</span>` : '';
  const late = r.status === 'pending' ? `<span class="late ${holdLeft(r) < 6 ? 'hot' : ''}">${ic(holdLeft(r) < 6 ? 'alert' : 'clock', 18)}입금 기한 ${holdText(r)}</span>` : '';
  const quick = r.status === 'pending' ? `<button type="button" class="btn ok-btn s" data-act="confirm" data-id="${esc(r.id)}">입금 확인(확정)</button>` : '';
  return `<div class="ritem ${open ? 'open' : ''} ${r.cancelRequest && r.status === 'confirmed' ? 'req' : ''} ${selected.has(r.id) ? 'picked' : ''}"><div class="rrow">${pick}
    <button type="button" class="rmain" data-open="${esc(r.id)}" aria-expanded="${open}"><b style="font-size:20px">${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)}</b><span>${esc(r.name)} · ${esc(spaceNames(r.spaces))}${memo}</span>${late}</button>
    <div class="rside"><span class="amt num">${won(r.amount)}</span>${statusBadge(r)}${quick}</div></div>${open ? detail(r) : ''}</div>`;
}

function tableRow(r) {
  const open = openId === r.id;
  const pick = r.status !== 'canceled' ? boxChecked(r.id) : '<span class="boxl"></span>';
  const quick = r.status === 'pending' ? `<button type="button" class="btn ok-btn s" style="min-height:44px" data-act="confirm" data-id="${esc(r.id)}">입금 확인</button>` : '<span></span>';
  return `<div class="ritem ${open ? 'open' : ''} ${selected.has(r.id) ? 'picked' : ''}"><div class="trow">${pick}<b class="num">${shortDate(r.date)}</b>
    <button type="button" class="tmain" data-open="${esc(r.id)}" aria-expanded="${open}">${hh(r.start)}~${hh(r.end)} · ${esc(r.name)} · ${esc(spaceNames(r.spaces))}</button>
    <b class="num">${won(r.amount)}</b>${statusBadge(r)}${quick}</div>${open ? detail(r) : ''}</div>`;
}

function renderRows() {
  const list = filtered();
  $('#rows').innerHTML = list.length ? list.map(density === 'dense' ? tableRow : cardRow).join('') : stateBox('file', '해당하는 예약이 없습니다.');
  renderBulk(list);
}

// 선택 취소 막대: 현재 목록에서 취소할 수 있는 건만 고를 수 있습니다.
function renderBulk(list) {
  const cancelable = list.filter((r) => r.status !== 'canceled');
  for (const id of [...selected]) if (!cancelable.some((r) => r.id === id)) selected.delete(id);
  const bar = $('#bulk');
  bar.hidden = !cancelable.length;
  if (!cancelable.length) return;
  const n = selected.size;
  const all = n === cancelable.length;
  const mid = n > 0 && !all;
  bar.innerHTML = `<label class="boxl"><input type="checkbox" class="sr-only" id="pickAll" ${all ? 'checked' : ''} aria-label="현재 목록 전체 선택"><span class="box ${all ? 'on' : mid ? 'mid' : ''}">${all ? ic('check', 18) : mid ? ic('minus', 18) : ''}</span></label>
    <b>전체 선택 (현재 목록 ${cancelable.length}건)</b><span class="muted">${n ? `${n}건 선택됨` : ''}</span>
    <span style="margin-left:auto" class="row-f wrapf">${n ? `<button type="button" class="btn ghost s" id="pickClear">선택 해제</button>` : ''}<button type="button" class="btn s ${n ? 'danger' : 'dis'}" id="bulkCancel" ${n ? '' : 'disabled'}>선택 취소 (${n})</button></span>`;
}

function renderLog() {
  $('#logList').innerHTML = events.length ? events.map((e) => {
    const r = e.rec;
    const detail = r ? `${esc(r.name)} · ${esc(spaceNames(r.spaces))} · ${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)} · ${won(r.amount)}` : '';
    const note = e.note ? ` · ${esc(e.note)}` : '';
    return `<div><span class="muted sm b">${formatKstDateTime(e.t)}</span><div><b>${ACTION[e.action] || e.action}</b><br><span class="muted sm">${detail}${r ? ` · ${esc(e.id)}` : ''}${note}</span></div></div>`;
  }).join('') : stateBox('hist', '아직 이력이 없습니다.');
}

async function load() {
  const [a, b, c] = await Promise.all([call({ action: 'list' }), call({ action: 'history' }), call({ action: 'blocks' })]);
  blocks = c.blocks;
  items = a.items.sort((x, y) => (y.date + String(y.start).padStart(2, '0')).localeCompare(x.date + String(x.start).padStart(2, '0')));
  events = b.events;
  stats(); renderFilters(); renderRows(); renderLog(); renderBlocks(); renderCal(); badgeCount();
  pageHead(curTab); applyDensity();
}

async function refresh() {
  try { await load(); } catch (e) { toast(e.message, true); }
}

/* ---------- 로그인 ---------- */
function showApp() { $('#loginView').hidden = true; $('#appView').hidden = false; }
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  pw = $('#pw').value;
  $('#loginErr').innerHTML = '';
  $('#pw').classList.remove('err');
  const btn = $('#loginBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>확인하는 중…';
  try {
    await load();
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    showApp();
  } catch (err) { $('#loginErr').innerHTML = errMsg(err.message); $('#pw').classList.add('err'); }
  btn.disabled = false; btn.textContent = '들어가기';
});
const logout = () => { try { sessionStorage.removeItem('women:adm'); } catch { /* 무시 */ } location.reload(); };
$('#logout').addEventListener('click', logout);
$('#logoutM').addEventListener('click', logout);

/* ---------- 이벤트: 탭, 목록 ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (b && b.closest('#appView')) setTab(b.dataset.t);
});

$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; selected.clear(); renderFilters(); renderRows(); } });
$('#q').addEventListener('input', (e) => { query = e.target.value; selected.clear(); renderRows(); });
$('#density').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  density = b.dataset.d;
  try { localStorage.setItem('women:density', density); } catch { /* 무시 */ }
  applyDensity();
  renderRows();
});

$('#rows').addEventListener('change', (e) => {
  const c = e.target.closest('[data-pick]');
  if (!c) return;
  if (c.checked) selected.add(c.dataset.pick); else selected.delete(c.dataset.pick);
  renderRows();
});
$('#bulk').addEventListener('change', (e) => {
  if (e.target.id !== 'pickAll') return;
  const ids = filtered().filter((r) => r.status !== 'canceled').map((r) => r.id);
  selected.clear();
  if (e.target.checked) ids.forEach((id) => selected.add(id));
  renderRows();
});

$('#bulk').addEventListener('click', async (e) => {
  if (e.target.closest('#pickClear')) { selected.clear(); return renderRows(); }
  if (!e.target.closest('#bulkCancel') || !selected.size) return;
  const picked = items.filter((r) => selected.has(r.id));
  const confirmed = picked.filter((r) => r.status === 'confirmed').length;
  const a = await ask({
    title: '선택한 예약 취소',
    body: `<p class="b">선택한 ${picked.length}건을 모두 취소합니다. 해당 시간이 다시 열려요.</p>${confirmed ? alertBox('warn', 'alert', `입금이 확정된 예약 ${confirmed}건이 들어 있어요. 환불은 따로 처리해야 해요.`) : ''}`,
    reason: { label: '취소 사유', placeholder: '사유를 적어 주세요' }, ok: '취소하기', okClass: 'danger', no: '돌아가기',
  });
  if (!a) return;
  try {
    const { canceled, skipped } = await call({ action: 'cancel_many', ids: [...selected], note: a.note });
    selected.clear();
    toast(skipped.length ? `${canceled.length}건을 취소했고, ${skipped.length}건은 취소하지 못했어요.` : `${canceled.length}건을 취소했어요.`, skipped.length > 0);
    await load();
  } catch (err) { toast(err.message, true); }
});

$('#rows').addEventListener('click', async (e) => {
  const head = e.target.closest('[data-open]');
  if (head) { openId = openId === head.dataset.open ? null : head.dataset.open; return renderRows(); }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  const rec = items.find((r) => r.id === id);
  try {
    if (b.dataset.act === 'memo') {
      await call({ action: 'memo', id, memo: $(`#memo-${id}`).value });
      toast('메모를 저장했어요.');
    } else if (b.dataset.act === 'dismiss') {
      await call({ action: 'dismiss', id });
      toast('취소 요청을 반려했어요.');
    } else if (b.dataset.act === 'confirm') {
      const a = await ask({ title: '입금 확인', body: `<p>${esc(rec.name)}님이 ${won(rec.amount)}을 입금한 것을 통장에서 확인했나요?</p>`, ok: '확인했어요', okClass: 'ok-btn', okIcon: 'check', no: '아니요' });
      if (!a) return;
      await call({ action: 'confirm', id });
      toast('입금을 확인하고 예약을 확정했어요.');
    } else if (b.dataset.act === 'cancel') {
      const a = await ask({
        title: '예약 취소',
        body: `<p class="b">${esc(rec.name)}님 · ${formatKoreanDate(rec.date)} ${hh(rec.start)}~${hh(rec.end)} · ${esc(spaceNames(rec.spaces))}</p><p class="muted sm">취소하면 해당 시간이 다시 열려요.</p>`,
        reason: { label: '취소 사유', placeholder: '사유를 적어 주세요' }, ok: '취소하기', okClass: 'danger', no: '돌아가기',
      });
      if (!a) return;
      await call({ action: 'cancel', id, note: a.note });
      toast(`${rec.name}님 예약을 취소했어요.`);
    }
    await load();
  } catch (err) { toast('처리하지 못했어요. 다시 시도해 주세요.' + (err.message ? ` (${err.message})` : ''), true); }
});

/* ---------- 달력 ---------- */
function dayBlockLabel(date) {
  const cfg = { ...C, blockedDates: [...C.blockedDates, ...blocks.flatMap((b) => { const out = []; for (let d = b.from, i = 0; d <= b.to && i < 400; d = addDays(d, 1), i++) out.push({ date: d, label: b.reason }); return out; })] };
  return blockLabel(cfg, date, null, null);
}

function renderCal() {
  if (!calMonth) { const p = parseYmd(todayKst(Date.now())); calMonth = { y: p.y, m: p.m }; }
  const { y, m } = calMonth;
  $('#cal-title').textContent = `${y}년 ${m}월`;
  const today = todayKst(Date.now());
  const first = parseYmd(ymd(y, m, 1));
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const live = items.filter((r) => r.status === 'confirmed' || r.status === 'pending');
  let html = ['일', '월', '화', '수', '목', '금', '토'].map((d) => `<div class="dw">${d}</div>`).join('');
  for (let i = 0; i < first.dow; i++) html += '<div class="cd fade"></div>';
  for (let d = 1; d <= n; d++) {
    const date = ymd(y, m, d);
    const day = live.filter((r) => r.date === date).sort((a, b) => a.start - b.start);
    const lbl = dayBlockLabel(date);
    const tags = day.slice(0, 2).map((r) => `<span class="tag ${r.status === 'confirmed' ? 'tg-ok' : 'tg-p'}">${esc(r.name)} ${r.status === 'confirmed' ? '확정' : '대기'}</span>`).join('')
      + (day.length > 2 ? `<span class="tag tg-off">외 ${day.length - 2}건</span>` : '');
    html += `<button type="button" class="cd ${date === calDay ? 'sel' : ''} ${date === today ? 'today' : ''}" data-d="${date}" aria-label="${formatKoreanDate(date)}${lbl ? ` ${esc(lbl)}` : ''} 예약 ${day.length}건"><span class="dn">${d}</span>${lbl ? `<span class="tag tg-off">${esc(lbl)}</span>` : ''}${tags}</button>`;
  }
  $('#acal').innerHTML = html;
  renderCalDay();
}

function renderCalDay() {
  const box = $('#cal-day');
  if (!calDay) { box.innerHTML = '<p class="muted">날짜를 누르면 그날의 예약이 여기에 보여요.</p>'; return; }
  const day = items.filter((r) => r.date === calDay && (r.status === 'confirmed' || r.status === 'pending')).sort((a, b) => a.start - b.start);
  const lbl = dayBlockLabel(calDay);
  box.innerHTML = `<h2>${formatKoreanDate(calDay)}의 예약${lbl ? ` · ${esc(lbl)}` : ''}</h2>${day.length
    ? day.map((r) => `<div class="trow" style="grid-template-columns:auto 1fr auto"><b class="num">${hh(r.start)}~${hh(r.end)}</b><span>${esc(r.name)} · ${esc(spaceNames(r.spaces))} · ${r.people}명</span><span class="row-f">${won(r.amount)} ${statusBadge(r)}</span></div>`).join('')
    : '<div class="state" style="padding:16px"><p class="b">이 날은 예약이 없습니다.</p></div>'}`;
}

$('#acal').addEventListener('click', (e) => { const c = e.target.closest('[data-d]'); if (c) { calDay = c.dataset.d; renderCal(); } });
function shiftCal(n) { let { y, m } = calMonth; m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } calMonth = { y, m }; renderCal(); }
$('#cal-prev').addEventListener('click', () => shiftCal(-1));
$('#cal-next').addEventListener('click', () => shiftCal(1));
$('#cal-today').addEventListener('click', () => { calMonth = null; calDay = todayKst(Date.now()); renderCal(); });

/* ---------- 직접 등록 ---------- */
const HOURS = Array.from({ length: C.closeHour - C.openHour + 1 }, (_, i) => C.openHour + i);
const chipsSp = new Set();
function renderSpaceChips() {
  $('#n-spaces').innerHTML = C.spaces.map((s) => `<button type="button" class="chip" data-sp="${s.id}" aria-pressed="${chipsSp.has(s.id)}">${chipsSp.has(s.id) ? ic('check', 18) : ''}${esc(s.name)}</button>`).join('');
}
renderSpaceChips();
$('#n-start').innerHTML = HOURS.slice(0, -1).map((h) => `<option value="${h}">${hh(h)}</option>`).join('');
$('#n-end').innerHTML = HOURS.slice(1).map((h) => `<option value="${h}">${hh(h)}</option>`).join('');
$('#n-start').value = '11';
$('#n-end').value = '15';
$('#n-date').value = todayKst(Date.now());

let amountTouched = false;
const picked = () => [...chipsSp];
function newPrice() {
  const q = quote(C, { spaceIds: picked(), startHour: Number($('#n-start').value), endHour: Number($('#n-end').value), people: Number($('#n-people').value) || 0 });
  $('#n-price').textContent = q.ok ? `자동 계산 ${won(q.total)} · 협의 금액이면 직접 고치세요` : q.message;
  if (!amountTouched) $('#n-amount').value = q.ok ? q.total : '';
  return q;
}
$('#n-spaces').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sp]');
  if (!b) return;
  if (chipsSp.has(b.dataset.sp)) chipsSp.delete(b.dataset.sp); else chipsSp.add(b.dataset.sp);
  renderSpaceChips();
  newPrice();
});
$('#n-confirmed').addEventListener('change', (e) => {
  $('#n-confirmed-l').classList.toggle('on', e.target.checked);
  const bx = $('#n-confirmed-l .box');
  bx.classList.toggle('on', e.target.checked);
  bx.innerHTML = e.target.checked ? ic('check', 20) : '';
});
$('#n-amount').addEventListener('input', () => { amountTouched = $('#n-amount').value !== ''; });
$('#newForm').addEventListener('input', newPrice);
newPrice();

$('#newForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-err').innerHTML = '';
  $('#n-phone').classList.remove('err');
  const btn = $('#n-submit');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>등록하는 중…';
  try {
    const made = await call({
      action: 'create',
      reservation: {
        date: $('#n-date').value, start: Number($('#n-start').value), end: Number($('#n-end').value), spaces: picked(),
        name: $('#n-name').value, phone: $('#n-phone').value, people: Number($('#n-people').value),
        purpose: $('#n-purpose').value, confirmed: $('#n-confirmed').checked, amount: $('#n-amount').value,
      },
    });
    toast(made.smsSent ? '직접 등록했어요. 확정 문자를 보냈어요.' : '직접 등록했어요.');
    $('#newForm').reset(); amountTouched = false;
    chipsSp.clear(); renderSpaceChips();
    $('#n-confirmed-l').classList.add('on'); $('#n-confirmed-l .box').classList.add('on'); $('#n-confirmed-l .box').innerHTML = ic('check', 20);
    $('#n-date').value = todayKst(Date.now());
    $('#n-start').value = '11'; $('#n-end').value = '15';
    newPrice();
    await load();
  } catch (err) {
    $('#n-err').innerHTML = errMsg(err.message);
    if (/번호|전화/.test(err.message)) $('#n-phone').classList.add('err');
  }
  btn.disabled = false; btn.textContent = '등록하기';
});

/* ---------- 휴관일 ---------- */
function renderBlocks() {
  $('#blockList').innerHTML = blocks.length
    ? [...blocks].sort((a, b) => a.from.localeCompare(b.from)).map((b) => `<div class="trow" style="grid-template-columns:1fr auto"><span><b>${formatKoreanDate(b.from)}${b.from === b.to ? '' : ` ~ ${formatKoreanDate(b.to)}`}</b><br>${esc(b.reason)}</span><button type="button" class="btn secondary s" data-bdel="${esc(b.id)}">해제</button></div>`).join('')
    : '<div class="state" style="padding:16px"><p class="b">등록된 휴관일이 없습니다.</p></div>';
}
$('#b-from').value = $('#b-to').value = todayKst(Date.now());
$('#b-from').addEventListener('change', () => { if ($('#b-to').value < $('#b-from').value) $('#b-to').value = $('#b-from').value; });
$('#blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#b-err').innerHTML = '';
  try {
    const r = await call({ action: 'block_add', from: $('#b-from').value, to: $('#b-to').value, reason: $('#b-reason').value });
    toast(r.affected ? `휴관일을 추가했어요. 이 기간에 이미 예약이 ${r.affected}건 있어요. 예약 목록에서 확인하고 예약자에게 연락하세요.` : '휴관일을 추가했어요.', r.affected > 0);
    $('#b-reason').value = '';
    await load();
  } catch (err) { $('#b-err').innerHTML = errMsg(err.message); }
});
$('#blockList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-bdel]');
  if (!b) return;
  const a = await ask({ title: '휴관일 해제', body: '<p>이 휴관일을 해제할까요? 해당 날짜가 다시 예약 가능해져요.</p>', ok: '해제하기', okClass: 'danger', no: '돌아가기' });
  if (!a) return;
  try { await call({ action: 'block_remove', blockId: b.dataset.bdel }); toast('휴관일을 해제했어요.'); await load(); } catch (err) { toast(err.message, true); }
});

/* ---------- QR 코드 ---------- */
function qrSvg(url) {
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#1B2236"/></svg>`;
}
function renderQr() {
  const url = $('#qr-url').value.trim();
  const card = $('#qr-card');
  if (!/^https?:\/\/\S+$/i.test(url)) { card.innerHTML = '<p class="muted">http:// 또는 https://로 시작하는 주소를 입력하세요.</p>'; return null; }
  try {
    const svg = qrSvg(url);
    const cap = $('#qr-title').value.trim();
    card.innerHTML = `${svg}${cap ? `<p class="b qr-cap" style="font-size:22px">${esc(cap)}</p>` : ''}<p class="muted sm" style="word-break:break-all">${esc(url)}</p>`;
    return svg;
  } catch { card.innerHTML = alertBox('err', 'alert', '주소가 너무 길어 QR 코드로 만들 수 없어요.'); return null; }
}
function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
$('#qr-url').value = location.origin + '/';
$('#qr-url').addEventListener('input', renderQr);
$('#qr-title').addEventListener('input', renderQr);
$('#qr-svg').addEventListener('click', () => { const s = renderQr(); if (s) download('reservation-qr.svg', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)); });
$('#qr-png').addEventListener('click', () => {
  const s = renderQr();
  if (!s) return;
  const img = new Image();
  img.onload = () => {
    const px = 1024;
    const cap = $('#qr-title').value.trim();
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px + (cap ? 120 : 0);
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, px, px);
    if (cap) { g.fillStyle = '#1B2236'; g.font = '700 48px "Pretendard Variable", Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText(cap, px / 2, px + 70); }
    download('reservation-qr.png', cv.toDataURL('image/png'));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
});
$('#qr-print').addEventListener('click', () => { if (renderQr()) window.print(); });

/* ---------- 설정 ---------- */
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#pwErr').innerHTML = '';
  if ($('#pw1').value !== $('#pw2').value) { $('#pwErr').innerHTML = errMsg('새 비밀번호가 서로 달라요.'); $('#pw2').classList.add('err'); return; }
  $('#pw2').classList.remove('err');
  try {
    await call({ action: 'setpw', newPassword: $('#pw1').value });
    pw = $('#pw1').value;
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    $('#pwForm').reset();
    toast('비밀번호를 바꿨어요. 다음 접속부터 새 비밀번호를 쓰세요.');
    await load();
  } catch (err) { $('#pwErr').innerHTML = errMsg(err.message); }
});

$('#csv').addEventListener('click', () => {
  const head = ['예약번호', '상태', '날짜', '시작', '종료', '공간', '이름', '연락처', '인원', '금액', '이용 목적', '메모', '접수 시각'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = items.map((r) => [r.id, LABEL[r.status], r.date, hh(r.start), hh(r.end), spaceNames(r.spaces), r.name, r.phone, r.people, r.amount, r.purpose, r.memo, formatKstDateTime(r.createdAt)].map(cell).join(','));
  const blob = new Blob(['﻿' + [head.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reservations-${todayKst(Date.now())}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

async function loadSms() {
  try {
    const { enabled } = await call({ action: 'sms_status' });
    $('#smsState').innerHTML = enabled
      ? alertBox('ok', 'check', '문자 발송이 연결되어 있어요. 예약 직후 송금 안내, 입금 확인 시 송금 완료 문자가 예약자에게 가요.')
      : alertBox('warn', 'alert', '문자 발송이 아직 연결되지 않았어요. Render 환경변수에 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER를 넣으면 켜져요(docs/sms.md).');
  } catch (e) { $('#smsState').innerHTML = alertBox('err', 'alert', esc(e.message)); }
}
async function loadNotify() {
  try {
    const { enabled } = await call({ action: 'notify_status' });
    $('#notifyState').innerHTML = enabled
      ? alertBox('ok', 'check', '알림이 연결되어 있어요. 새 예약, 취소, 취소 요청이 들어오면 알림이 가요.')
      : alertBox('warn', 'alert', '알림이 아직 연결되지 않았어요. NOTIFY_WEBHOOK_URL(슬랙·디스코드) 또는 TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 넣으면 켜져요.');
    $('#notifyTest').hidden = !enabled;
  } catch (e) { $('#notifyState').innerHTML = alertBox('err', 'alert', esc(e.message)); }
}
$('#notifyTest').addEventListener('click', async () => {
  try { await call({ action: 'notify_test' }); toast('테스트 알림을 보냈어요. 채널을 확인하세요.'); } catch (e) { toast(e.message, true); }
});

/* ---------- 시작 ---------- */
watchOverlay($('#adlg'));
window.addEventListener('popstate', () => { overlayPop(); });
decorateStatic();
applyDensity();
renderQr();
(async function init() {
  try { pw = sessionStorage.getItem('women:adm') || ''; } catch { /* 무시 */ }
  if (!pw) return;
  try { await load(); showApp(); } catch { /* 로그인 화면 유지 */ }
})();

/* ---------- 자동 새로고침 (1분마다, 입력 중이거나 창이 열려 있으면 건너뜀) ---------- */
setInterval(() => {
  if (document.hidden || $('#appView').hidden || $('#adlg').open) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.closest('#appView')) return;
  load().catch(() => {});
}, 60000);
