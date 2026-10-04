import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { formatKoreanDate, formatKstDateTime, hh, todayKst } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { pending: '입금 대기', confirmed: '확정', canceled: '취소', expired: '기한 만료' };
const ACTION = { created: '예약 접수', admin_created: '직접 등록', confirmed: '입금 확인(확정)', canceled: '취소', memo: '메모 수정', password_changed: '비밀번호 변경', cancel_requested: '취소 요청', cancel_dismissed: '취소 요청 반려', block_added: '휴관일 추가', block_removed: '휴관일 해제' };
const spaceNames = (ids) => ids.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');

let pw = '';
let items = [];
let events = [];
let filter = 'pending';
let query = '';
let openId = null;
const holdLeft = (r) => (r.holdUntil - Date.now()) / 3600000;
const holdText = (r) => { const h = holdLeft(r); return h <= 0 ? '지남' : h < 1 ? `${Math.ceil(h * 60)}분 남음` : `${Math.floor(h)}시간 남음`; };
function badge() {
  const n = items.filter((r) => r.status === 'pending').length + items.filter((r) => r.status === 'confirmed' && r.cancelRequest).length;
  document.title = n ? `(${n}) 예약 관리` : '예약 관리';
  const b = document.querySelector('[data-t="list"]');
  if (b) b.textContent = n ? `예약 목록 ${n}` : '예약 목록';
}
let blocks = [];
let calMonth = null;
let calDay = null;

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

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.textContent = ''; }, 5000);
}

/* ---------- 목록 ---------- */
function stats() {
  const today = todayKst(Date.now());
  const month = today.slice(0, 7);
  const pending = items.filter((r) => r.status === 'pending');
  const confirmed = items.filter((r) => r.status === 'confirmed');
  const monthSum = confirmed.filter((r) => r.date.startsWith(month)).reduce((a, r) => a + r.amount, 0);
  const todays = confirmed.filter((r) => r.date === today).length;
  const reqs = confirmed.filter((r) => r.cancelRequest).length;
  $('#stats').innerHTML = `
    <div class="stat"><span>입금 대기</span><b>${pending.length}건</b><small>${won(pending.reduce((a, r) => a + r.amount, 0))}</small></div>
    <div class="stat"><span>확정 예약</span><b>${confirmed.length}건</b><small>이번 달 ${won(monthSum)}</small></div>
    <div class="stat"><span>오늘 이용</span><b>${todays}건</b><small>${formatKoreanDate(today)}</small></div>
    <div class="stat ${reqs ? 'alert' : ''}"><span>취소 요청</span><b>${reqs}건</b><small>${reqs ? '환불 처리가 필요합니다' : '없음'}</small></div>`;
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
    .map((s) => `<button data-f="${s}" aria-pressed="${filter === s}">${s === 'all' ? '전체' : s === 'req' ? '취소 요청' : LABEL[s]} ${count(s)}</button>`).join('');
}

function historyFor(id) {
  const ev = events.filter((e) => e.id === id).sort((a, b) => a.t - b.t);
  return ev.length ? `<ul class="hist">${ev.map((e) => `<li>${formatKstDateTime(e.t)} · ${ACTION[e.action] || e.action}${e.note ? ` · ${esc(e.note)}` : ''}</li>`).join('')}</ul>` : '<p class="hint">이력이 없습니다.</p>';
}

function renderRows() {
  const list = filtered();
  $('#rows').innerHTML = list.length ? list.map((r) => {
    const open = openId === r.id;
    const acts = [];
    if (r.status === 'pending' || r.status === 'expired') acts.push(`<button class="pri" data-act="confirm" data-id="${esc(r.id)}">입금 확인(확정)</button>`);
    if (r.status === 'confirmed' && r.cancelRequest) acts.push(`<button data-act="dismiss" data-id="${esc(r.id)}">취소 요청 반려</button>`);
    if (r.status !== 'canceled') acts.push(`<button class="dng" data-act="cancel" data-id="${esc(r.id)}">${r.cancelRequest ? '취소 승인(환불 후 처리)' : '취소'}</button>`);
    const body = open ? `<div class="item-body">
      <dl>
        <dt>예약번호</dt><dd>${esc(r.id)}${r.source === 'admin' ? ' (직접 등록)' : ''}</dd>
        <dt>연락처</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></dd>
        <dt>인원</dt><dd>${r.people}명</dd>
        <dt>이용 목적</dt><dd>${esc(r.purpose) || '-'}</dd>
        <dt>접수</dt><dd>${formatKstDateTime(r.createdAt)}</dd>
        ${r.cancelRequest ? `<dt>취소 요청</dt><dd><b>${formatKstDateTime(r.cancelRequest.at)}</b>${r.cancelRequest.reason ? ` · ${esc(r.cancelRequest.reason)}` : ''}</dd>` : ''}
        ${r.holdUntil && r.status === 'pending' ? `<dt>입금 기한</dt><dd>${formatKstDateTime(r.holdUntil)}</dd>` : ''}
      </dl>
      <div class="field"><label for="memo-${esc(r.id)}">관리자 메모</label><textarea id="memo-${esc(r.id)}" maxlength="300">${esc(r.memo || '')}</textarea></div>
      <div class="acts">${acts.join('')}<button data-act="memo" data-id="${esc(r.id)}">메모 저장</button></div>
      <div><p class="hint" style="margin-bottom:6px">이력</p>${historyFor(r.id)}</div>
    </div>` : '';
    return `<article class="item">
      <button type="button" class="item-head" data-open="${esc(r.id)}" aria-expanded="${open}">
        <span class="when"><b>${formatKoreanDate(r.date)}</b><small>${hh(r.start)}~${hh(r.end)}</small></span>
        <span class="who"><b>${esc(r.name)}</b> <small>${esc(spaceNames(r.spaces))}${r.memo ? ' · 메모 있음' : ''}</small>${r.status === 'pending' ? `<small class="left ${holdLeft(r) < 6 ? 'warn' : ''}">입금 기한 ${holdText(r)}</small>` : ''}</span>
        <span class="amt">${won(r.amount)}</span>
        <span class="badge ${r.cancelRequest && r.status === 'confirmed' ? 'req' : r.status}">${r.cancelRequest && r.status === 'confirmed' ? '취소 요청' : LABEL[r.status]}</span>
      </button>${!open && (r.status === 'pending') ? `<div class="quick"><button class="pri" data-act="confirm" data-id="${esc(r.id)}">입금 확인(확정)</button></div>` : ''}${body}</article>`;
  }).join('') : '<p class="empty">해당하는 예약이 없습니다.</p>';
}

function renderLog() {
  $('#logList').innerHTML = events.length ? events.map((e) => {
    const r = e.rec;
    const detail = r ? `${esc(r.name)} · ${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)} · ${esc(spaceNames(r.spaces))} · ${won(r.amount)}` : '';
    return `<div class="ev"><time>${formatKstDateTime(e.t)}</time><span class="what">${ACTION[e.action] || e.action}</span><span>${detail}${r ? `<small>${esc(e.id)}${e.note ? ` · ${esc(e.note)}` : ''}</small>` : (e.note ? `<small>${esc(e.note)}</small>` : '')}</span></div>`;
  }).join('') : '<p class="empty">아직 이력이 없습니다.</p>';
}

async function load() {
  const [a, b, c] = await Promise.all([call({ action: 'list' }), call({ action: 'history' }), call({ action: 'blocks' })]);
  blocks = c.blocks;
  items = a.items.sort((x, y) => (y.date + String(y.start).padStart(2, '0')).localeCompare(x.date + String(x.start).padStart(2, '0')));
  events = b.events;
  stats(); renderFilters(); renderRows(); renderLog(); renderBlocks(); renderCal(); badge();
}

async function refresh() {
  try { await load(); } catch (e) { toast(e.message, true); }
}

/* ---------- 로그인 ---------- */
function showApp() { $('#loginView').hidden = true; $('#appView').hidden = false; }
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  pw = $('#pw').value;
  $('#loginErr').textContent = '';
  try {
    await load();
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    showApp();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#logout').addEventListener('click', () => { try { sessionStorage.removeItem('women:adm'); } catch { /* 무시 */ } location.reload(); });

/* ---------- 탭 ---------- */
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  for (const x of document.querySelectorAll('#tabs button')) x.setAttribute('aria-pressed', String(x === b));
  for (const t of ['list', 'cal', 'log', 'new', 'block', 'qr', 'set']) $(`#tab-${t}`).hidden = t !== b.dataset.t;
  if (['list', 'cal', 'log', 'block'].includes(b.dataset.t)) refresh();
  if (b.dataset.t === 'set') loadNotify();
});

$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderFilters(); renderRows(); } });
$('#q').addEventListener('input', (e) => { query = e.target.value; renderRows(); });

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
      toast('메모를 저장했습니다.');
    } else if (b.dataset.act === 'dismiss') {
      await call({ action: 'dismiss', id });
      toast('취소 요청을 반려했습니다.');
    } else if (b.dataset.act === 'confirm') {
      if (!confirm(`${rec.name}님이 ${won(rec.amount)}을 입금한 것을 통장에서 확인했나요?`)) return;
      await call({ action: 'confirm', id });
      toast(`${rec.name}님 예약을 확정했습니다.`);
    } else if (b.dataset.act === 'cancel') {
      const note = prompt(`${rec.name}님 예약을 취소합니다. 취소 사유를 적으세요(선택). 해당 시간이 다시 열립니다.`);
      if (note === null) return;
      await call({ action: 'cancel', id, note });
      toast(`${rec.name}님 예약을 취소했습니다.`);
    }
    await load();
  } catch (err) { toast(err.message, true); }
});

/* ---------- 직접 등록 ---------- */
const HOURS = Array.from({ length: C.closeHour - C.openHour + 1 }, (_, i) => C.openHour + i);
$('#n-spaces').innerHTML = C.spaces.map((s) => `<label><input type="checkbox" value="${s.id}"> ${s.name}</label>`).join('');
$('#n-start').innerHTML = HOURS.slice(0, -1).map((h) => `<option value="${h}">${hh(h)}</option>`).join('');
$('#n-end').innerHTML = HOURS.slice(1).map((h) => `<option value="${h}">${hh(h)}</option>`).join('');
$('#n-start').value = '10';
$('#n-end').value = '14';
$('#n-date').value = todayKst(Date.now());

const picked = () => [...document.querySelectorAll('#n-spaces input:checked')].map((i) => i.value);
function newPrice() {
  const q = quote(C, { spaceIds: picked(), startHour: Number($('#n-start').value), endHour: Number($('#n-end').value), people: Number($('#n-people').value) || 0 });
  $('#n-price').textContent = q.ok ? `금액 ${won(q.total)}` : q.message;
  return q;
}
$('#newForm').addEventListener('input', newPrice);
newPrice();

$('#newForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-err').textContent = '';
  try {
    await call({
      action: 'create',
      reservation: {
        date: $('#n-date').value, start: Number($('#n-start').value), end: Number($('#n-end').value), spaces: picked(),
        name: $('#n-name').value, phone: $('#n-phone').value, people: Number($('#n-people').value),
        purpose: $('#n-purpose').value, confirmed: $('#n-confirmed').checked,
      },
    });
    toast('예약을 등록했습니다.');
    $('#newForm').reset();
    $('#n-date').value = todayKst(Date.now());
    $('#n-start').value = '10'; $('#n-end').value = '14';
    newPrice();
    await load();
  } catch (err) { $('#n-err').textContent = err.message; }
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#16202B"/></svg>`;
}
function renderQr() {
  const url = $('#qr-url').value.trim();
  const card = $('#qr-card');
  if (!/^https?:\/\/\S+$/i.test(url)) { card.innerHTML = '<p class="hint">http:// 또는 https://로 시작하는 주소를 입력하세요.</p>'; return null; }
  try {
    const svg = qrSvg(url);
    const cap = $('#qr-title').value.trim();
    card.innerHTML = `${svg}${cap ? `<div class="cap">${esc(cap)}</div>` : ''}<div class="u">${esc(url)}</div>`;
    return svg;
  } catch { card.innerHTML = '<p class="err">주소가 너무 길어 QR 코드로 만들 수 없습니다.</p>'; return null; }
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
    if (cap) { g.fillStyle = '#16202B'; g.font = '700 48px "Pretendard Variable", sans-serif'; g.textAlign = 'center'; g.fillText(cap, px / 2, px + 70); }
    download('reservation-qr.png', cv.toDataURL('image/png'));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
});
$('#qr-print').addEventListener('click', () => { if (renderQr()) window.print(); });
renderQr();

/* ---------- 설정 ---------- */
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#pwErr').textContent = '';
  if ($('#pw1').value !== $('#pw2').value) { $('#pwErr').textContent = '새 비밀번호가 서로 다릅니다.'; return; }
  try {
    await call({ action: 'setpw', newPassword: $('#pw1').value });
    pw = $('#pw1').value;
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    $('#pwForm').reset();
    toast('비밀번호를 변경했습니다. 다음 접속부터 새 비밀번호를 쓰세요.');
    await load();
  } catch (err) { $('#pwErr').textContent = err.message; }
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

/* ---------- 시작 ---------- */
(async function init() {
  try { pw = sessionStorage.getItem('women:adm') || ''; } catch { /* 무시 */ }
  if (!pw) return;
  try { await load(); showApp(); } catch { /* 로그인 화면 유지 */ }
})();


/* ---------- 달력 ---------- */
import { blockLabel } from '/shared/rules.mjs';
import { parseYmd, ymd, addDays } from '/shared/time.mjs';

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
  let html = ['일', '월', '화', '수', '목', '금', '토'].map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < first.dow; i++) html += '<div class="cell out"></div>';
  for (let d = 1; d <= n; d++) {
    const date = ymd(y, m, d);
    const day = live.filter((r) => r.date === date);
    const lbl = dayBlockLabel(date);
    const conf = day.filter((r) => r.status === 'confirmed').length;
    const pend = day.filter((r) => r.status === 'pending').length;
    html += `<button type="button" class="cell ${lbl ? 'blocked' : ''} ${date === today ? 'today' : ''} ${date === calDay ? 'sel' : ''}" data-d="${date}"><b>${d}</b>
      ${lbl ? `<span class="tag lbl">${esc(lbl)}</span>` : ''}${conf ? `<span class="tag confirmed">확정 ${conf}</span>` : ''}${pend ? `<span class="tag pending">대기 ${pend}</span>` : ''}</button>`;
  }
  $('#acal').innerHTML = html;
  renderCalDay();
}

function renderCalDay() {
  const box = $('#cal-day');
  if (!calDay) { box.innerHTML = '<p class="hint">날짜를 누르면 그날의 예약이 아래에 보입니다.</p>'; return; }
  const day = items.filter((r) => r.date === calDay && (r.status === 'confirmed' || r.status === 'pending')).sort((a, b) => a.start - b.start);
  const lbl = dayBlockLabel(calDay);
  box.innerHTML = `<div class="dayline"><h3>${formatKoreanDate(calDay)}${lbl ? ` · ${esc(lbl)}` : ''}</h3>${day.length ? day.map((r) => `<div class="li"><span class="num">${hh(r.start)}~${hh(r.end)}</span><span><b>${esc(r.name)}</b> ${esc(spaceNames(r.spaces))} · ${r.people}명</span><span class="badge ${r.status}">${LABEL[r.status]}</span></div>`).join('') : '<p class="hint">예약이 없습니다.</p>'}</div>`;
}

$('#acal').addEventListener('click', (e) => { const c = e.target.closest('[data-d]'); if (c) { calDay = c.dataset.d; renderCal(); } });
function shiftCal(n) { let { y, m } = calMonth; m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } calMonth = { y, m }; renderCal(); }
$('#cal-prev').addEventListener('click', () => shiftCal(-1));
$('#cal-next').addEventListener('click', () => shiftCal(1));
$('#cal-today').addEventListener('click', () => { calMonth = null; calDay = todayKst(Date.now()); renderCal(); });

/* ---------- 휴관일 ---------- */
function renderBlocks() {
  $('#blockList').innerHTML = blocks.length
    ? [...blocks].sort((a, b) => a.from.localeCompare(b.from)).map((b) => `<div class="blk"><span><b>${formatKoreanDate(b.from)}${b.from === b.to ? '' : ` ~ ${formatKoreanDate(b.to)}`}</b> · ${esc(b.reason)}</span><span class="acts"><button class="dng" data-bdel="${esc(b.id)}">해제</button></span></div>`).join('')
    : '<p class="empty">지정한 휴관일이 없습니다.</p>';
}
$('#b-from').value = $('#b-to').value = todayKst(Date.now());
$('#b-from').addEventListener('change', () => { if ($('#b-to').value < $('#b-from').value) $('#b-to').value = $('#b-from').value; });
$('#blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#b-err').textContent = '';
  try {
    const r = await call({ action: 'block_add', from: $('#b-from').value, to: $('#b-to').value, reason: $('#b-reason').value });
    toast(r.affected ? `휴관일을 추가했습니다. 이 기간에 이미 예약이 ${r.affected}건 있습니다. 예약 목록에서 확인하고 예약자에게 연락하세요.` : '휴관일을 추가했습니다.', r.affected > 0);
    $('#b-reason').value = '';
    await load();
  } catch (err) { $('#b-err').textContent = err.message; }
});
$('#blockList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-bdel]');
  if (!b || !confirm('이 휴관일을 해제할까요? 해당 날짜가 다시 예약 가능해집니다.')) return;
  try { await call({ action: 'block_remove', blockId: b.dataset.bdel }); toast('휴관일을 해제했습니다.'); await load(); } catch (err) { toast(err.message, true); }
});

/* ---------- 알림 ---------- */
async function loadNotify() {
  try {
    const { enabled } = await call({ action: 'notify_status' });
    $('#notifyState').textContent = enabled ? '연결되어 있습니다. 새 예약, 취소, 취소 요청이 들어오면 알림이 갑니다.' : '아직 연결되지 않았습니다. Render 환경변수에 NOTIFY_WEBHOOK_URL(슬랙, 디스코드) 또는 TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID(텔레그램)를 넣으면 켜집니다.';
    $('#notifyTest').hidden = !enabled;
  } catch (e) { $('#notifyState').textContent = e.message; }
}
$('#notifyTest').addEventListener('click', async () => {
  try { await call({ action: 'notify_test' }); toast('테스트 알림을 보냈습니다. 채널을 확인하세요.'); } catch (e) { toast(e.message, true); }
});


/* ---------- 자동 새로고침 (1분마다, 입력 중이면 건너뜀) ---------- */
setInterval(() => {
  if (document.hidden || $('#appView').hidden) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.closest('#appView')) return;
  load().catch(() => {});
}, 60000);
