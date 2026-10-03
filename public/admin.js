import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { formatKoreanDate, formatKstDateTime, hh, todayKst } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABEL = { pending: '입금 대기', confirmed: '확정', canceled: '취소', expired: '기한 만료' };
const ACTION = { created: '예약 접수', admin_created: '직접 등록', confirmed: '입금 확인(확정)', canceled: '취소', memo: '메모 수정', password_changed: '비밀번호 변경' };
const spaceNames = (ids) => ids.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');

let pw = '';
let items = [];
let events = [];
let filter = 'pending';
let query = '';
let openId = null;

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
  $('#stats').innerHTML = `
    <div class="stat"><span>입금 대기</span><b>${pending.length}건</b><small>${won(pending.reduce((a, r) => a + r.amount, 0))}</small></div>
    <div class="stat"><span>확정 예약</span><b>${confirmed.length}건</b><small>이번 달 ${won(monthSum)}</small></div>
    <div class="stat"><span>오늘 이용</span><b>${todays}건</b><small>${formatKoreanDate(today)}</small></div>
    <div class="stat"><span>전체 기록</span><b>${items.length}건</b><small>최근 4개월 이후</small></div>`;
}

function filtered() {
  const q = query.trim().toLowerCase().replace(/-/g, '');
  return items.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (!q) return true;
    return [r.name, r.phone, r.id, r.purpose].some((v) => String(v || '').toLowerCase().replace(/-/g, '').includes(q));
  });
}

function renderFilters() {
  const count = (s) => (s === 'all' ? items.length : items.filter((r) => r.status === s).length);
  $('#filters').innerHTML = ['pending', 'confirmed', 'expired', 'canceled', 'all']
    .map((s) => `<button data-f="${s}" aria-pressed="${filter === s}">${s === 'all' ? '전체' : LABEL[s]} ${count(s)}</button>`).join('');
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
    if (r.status !== 'canceled') acts.push(`<button class="dng" data-act="cancel" data-id="${esc(r.id)}">취소</button>`);
    const body = open ? `<div class="item-body">
      <dl>
        <dt>예약번호</dt><dd>${esc(r.id)}${r.source === 'admin' ? ' (직접 등록)' : ''}</dd>
        <dt>연락처</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></dd>
        <dt>인원</dt><dd>${r.people}명</dd>
        <dt>이용 목적</dt><dd>${esc(r.purpose) || '-'}</dd>
        <dt>접수</dt><dd>${formatKstDateTime(r.createdAt)}</dd>
        ${r.holdUntil && r.status === 'pending' ? `<dt>입금 기한</dt><dd>${formatKstDateTime(r.holdUntil)}</dd>` : ''}
      </dl>
      <div class="field"><label for="memo-${esc(r.id)}">관리자 메모</label><textarea id="memo-${esc(r.id)}" maxlength="300">${esc(r.memo || '')}</textarea></div>
      <div class="acts">${acts.join('')}<button data-act="memo" data-id="${esc(r.id)}">메모 저장</button></div>
      <div><p class="hint" style="margin-bottom:6px">이력</p>${historyFor(r.id)}</div>
    </div>` : '';
    return `<article class="item">
      <button type="button" class="item-head" data-open="${esc(r.id)}" aria-expanded="${open}">
        <span class="when"><b>${formatKoreanDate(r.date)}</b><small>${hh(r.start)}~${hh(r.end)}</small></span>
        <span class="who"><b>${esc(r.name)}</b> <small>${esc(spaceNames(r.spaces))}${r.memo ? ' · 메모 있음' : ''}</small></span>
        <span class="amt">${won(r.amount)}</span>
        <span class="badge ${r.status}">${LABEL[r.status]}</span>
      </button>${body}</article>`;
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
  const [a, b] = await Promise.all([call({ action: 'list' }), call({ action: 'history' })]);
  items = a.items.sort((x, y) => (y.date + String(y.start).padStart(2, '0')).localeCompare(x.date + String(x.start).padStart(2, '0')));
  events = b.events;
  stats(); renderFilters(); renderRows(); renderLog();
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
  for (const t of ['list', 'log', 'new', 'qr', 'set']) $(`#tab-${t}`).hidden = t !== b.dataset.t;
  if (b.dataset.t === 'list' || b.dataset.t === 'log') refresh();
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
    } else if (b.dataset.act === 'confirm') {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#24302A"/></svg>`;
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
    if (cap) { g.fillStyle = '#24302A'; g.font = '700 48px "Pretendard Variable", sans-serif'; g.textAlign = 'center'; g.fillText(cap, px / 2, px + 70); }
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
