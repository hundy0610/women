import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { blockLabel, dayFullyBlocked } from '/shared/rules.mjs';
import { todayKst, parseYmd, addDays, kstEpoch, ymd, ymdNum, formatKoreanDate, formatKstDateTime, hh, DOW_LABELS } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const HOUR_MS = 3600 * 1000;
const HOURS = Array.from({ length: C.closeHour - C.openHour }, (_, i) => C.openHour + i);

const state = {
  offset: 0,
  info: { bank: null, contact: null, storeReady: true },
  taken: {},
  date: null,
  month: null,
  spaceIds: [],
  start: null,
  end: null,
  agree: false,
  submitting: false,
};
const now = () => Date.now() + state.offset;

/* ---------- 서버 통신 ---------- */
async function api(path, opts) {
  const res = await fetch(path, opts);
  let json = {};
  try { json = await res.json(); } catch { /* 본문 없음 */ }
  if (!res.ok || json.ok === false) {
    const err = new Error(json?.error?.message || '요청에 실패했습니다.');
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

function indexItems(items) {
  const idx = {};
  for (const it of items) {
    for (const sp of it.spaces) {
      for (let h = it.start; h < it.end; h++) {
        const byDate = (idx[it.date] ||= {});
        const bySpace = (byDate[sp] ||= {});
        bySpace[h] = bySpace[h] === 'confirmed' || it.status === 'confirmed' ? 'confirmed' : 'pending';
      }
    }
  }
  return idx;
}

async function loadInfo() {
  try {
    const j = await api('/api/info');
    state.offset = j.now - Date.now();
    state.info = { bank: j.bank, contact: j.contact, storeReady: j.storeReady };
  } catch { /* 계좌 정보 없이도 화면은 열립니다 */ }
  $('#storeNotice').hidden = state.info.storeReady;
}

async function loadAvailability() {
  if (!state.info.storeReady) return;
  try {
    const today = todayKst(now());
    const j = await api(`/api/availability?from=${today}&to=${addDays(today, C.horizonDays)}`);
    state.offset = j.now - Date.now();
    state.taken = indexItems(j.items);
    $('#netNotice').hidden = true;
  } catch {
    $('#netNotice').hidden = false;
  }
  renderAll();
}

/* ---------- 상태 계산 ---------- */
function slotState(date, spaceId, hour) {
  const label = blockLabel(C, date, spaceId, hour);
  if (label) return { s: 'blocked', label };
  if (kstEpoch(date, hour) < now() + C.minLeadHours * HOUR_MS) return { s: 'past' };
  const t = state.taken[date]?.[spaceId]?.[hour];
  return { s: t || 'free' };
}
const isFree = (date, spaceId, hour) => slotState(date, spaceId, hour).s === 'free';
const allFree = (date, ids, hour) => ids.length > 0 && ids.every((id) => isFree(date, id, hour));
const freeHours = (date, spaceId) => HOURS.filter((h) => isFree(date, spaceId, h)).length;

function dayStatus(date) {
  const today = todayKst(now());
  if (ymdNum(date) < ymdNum(today) || ymdNum(date) > ymdNum(addDays(today, C.horizonDays))) return 'out';
  if (dayFullyBlocked(C, date)) return 'blocked';
  const anyFree = C.spaces.some((s) => freeHours(date, s.id) >= C.minHours);
  return anyFree ? 'open' : 'full';
}

function firstOpenDate() {
  const today = todayKst(now());
  for (let i = 0; i <= C.horizonDays; i++) {
    const d = addDays(today, i);
    if (dayStatus(d) === 'open') return d;
  }
  return today;
}

/* ---------- 달력 ---------- */
function renderCalendar() {
  const { y, m } = state.month;
  $('#monthLabel').textContent = `${y}년 ${m}월`;
  const today = todayKst(now());
  const tp = parseYmd(today);
  const lastDate = parseYmd(addDays(today, C.horizonDays));
  $('#prevM').disabled = y === tp.y && m === tp.m;
  $('#nextM').disabled = y === lastDate.y && m === lastDate.m;

  const first = parseYmd(ymd(y, m, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let html = DOW_LABELS.map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < first.dow; i++) html += '<div class="day out"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(y, m, d);
    const st = dayStatus(date);
    const hasBooking = Boolean(state.taken[date]);
    const cls = ['day', st === 'blocked' ? 'blocked' : '', date === today ? 'today' : '', date === state.date ? 'sel' : ''].join(' ').trim();
    const small = st === 'blocked' ? '불가' : st === 'full' ? '마감' : '';
    const disabled = st === 'out' || st === 'blocked';
    html += `<button type="button" class="${cls}" data-date="${date}" ${disabled && st === 'out' ? 'disabled' : ''} aria-pressed="${date === state.date}" aria-label="${formatKoreanDate(date)}${small ? ' ' + small : ''}">${d}${small ? `<small>${small}</small>` : ''}${hasBooking && !small ? '<span class="dot"></span>' : ''}</button>`;
  }
  $('#cal').innerHTML = html;
}

/* ---------- 현황표 ---------- */
function renderStatus() {
  const date = state.date;
  $('#statusTitle').textContent = `${formatKoreanDate(date)} 예약 현황`;
  const label = blockLabel(C, date, null, null);
  $('#statusNote').textContent = label ? `이 날은 예약할 수 없습니다(${label}).` : `${C.openHour}:00부터 ${C.closeHour}:00까지, 한 칸이 1시간입니다.`;

  const sel = new Set(state.spaceIds);
  let html = `<thead><tr><th scope="col"><span class="sr-only">공간</span></th>${HOURS.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>`;
  for (const sp of C.spaces) {
    html += `<tr><th scope="row">${sp.name}</th>`;
    for (const h of HOURS) {
      const st = slotState(date, sp.id, h);
      const mine = sel.has(sp.id) && state.start != null && h >= state.start && h < state.end;
      const text = { confirmed: '예약', pending: '대기', blocked: '불가', past: '마감', free: '' }[st.s];
      const title = `${sp.name} ${h}시 ${{ confirmed: '예약 완료', pending: '입금 대기', blocked: '이용 불가', past: '예약 마감', free: '예약 가능' }[st.s]}`;
      html += `<td class="${st.s}${mine ? ' sel' : ''}" title="${title}">${mine && st.s === 'free' ? '선택' : text}<span class="sr-only"> ${title}</span></td>`;
    }
    html += '</tr>';
  }
  $('#grid').innerHTML = html + '</tbody>';
}

/* ---------- 공간 ---------- */
function renderSpaces() {
  const all = state.spaceIds.length === C.spaces.length;
  let html = C.spaces.map((s) => {
    const free = freeHours(state.date, s.id);
    const cap = `최대 ${s.capacity}명${s.layout ? `(${s.layout})` : ''}`;
    return `<button type="button" class="space" data-id="${s.id}" aria-pressed="${state.spaceIds.includes(s.id)}">
      <b>${s.name}</b>
      <span class="meta num">${s.pyeong}평 · ${s.dims}</span>
      <span class="meta">${cap}</span>
      <span class="meta">${s.note}</span>
      <span class="price num">시간당 ${won(s.hourly)}<br>1일 ${won(s.daily)}</span>
      <span class="free num">${free >= C.minHours ? `이날 예약 가능 ${free}시간` : '이날 예약 가능 시간 없음'}</span>
    </button>`;
  }).join('');
  html += `<button type="button" class="space all" data-id="__all" aria-pressed="${all}">
    <span><b>전체 통대관</b><br><span class="meta">5개 공간 전부 · 1일(${C.dayHours}시간)</span></span>
    <span class="price num">${won(C.packageDayPrice)}</span>
  </button>`;
  $('#spaces').innerHTML = html;
}

/* ---------- 시간 ---------- */
function maxEndFor(start) {
  let e = start;
  while (e < C.closeHour && allFree(state.date, state.spaceIds, e)) e++;
  return e;
}

function normalizeTime() {
  if (!state.spaceIds.length || !state.date) { state.start = state.end = null; return; }
  if (state.start != null) {
    const max = maxEndFor(state.start);
    if (max - state.start < C.minHours) { state.start = state.end = null; return; }
    if (state.end != null && (state.end > max || state.end - state.start < C.minHours)) state.end = null;
  }
}

function renderTime() {
  const ids = state.spaceIds;
  const hint = $('#timeHint');
  const none = !ids.length;
  hint.textContent = none ? '공간을 먼저 선택하세요.' : `최소 ${C.minHours}시간부터 예약할 수 있습니다. 선택한 공간이 모두 비어 있는 시간만 누를 수 있습니다.`;

  let sHtml = '';
  for (let h = C.openHour; h <= C.closeHour - C.minHours; h++) {
    let ok = !none;
    for (let k = 0; ok && k < C.minHours; k++) ok = allFree(state.date, ids, h + k);
    sHtml += `<button type="button" class="chip" data-start="${h}" aria-pressed="${state.start === h}" ${ok ? '' : 'disabled'}>${hh(h)}</button>`;
  }
  $('#startChips').innerHTML = sHtml;

  let eHtml = '';
  if (state.start == null) {
    eHtml = '<p class="hint">시작 시간을 먼저 선택하세요.</p>';
  } else {
    const max = maxEndFor(state.start);
    for (let e = state.start + C.minHours; e <= max; e++) {
      eHtml += `<button type="button" class="chip" data-end="${e}" aria-pressed="${state.end === e}">${hh(e)}</button>`;
    }
  }
  $('#endChips').innerHTML = eHtml;

  const r = $('#timeResult');
  r.textContent = state.start != null && state.end != null
    ? `${formatKoreanDate(state.date)} ${hh(state.start)} ~ ${hh(state.end)} (${state.end - state.start}시간)`
    : '';
}

/* ---------- 입력 ---------- */
const val = (id) => $(id).value.trim();
const phoneDigits = (s) => s.replace(/\D/g, '');
const phoneOk = (s) => /^01[016789]\d{7,8}$/.test(phoneDigits(s));

function formatPhone(s) {
  const d = phoneDigits(s).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function formProblems() {
  const p = [];
  if (!state.date) p.push('날짜를 선택하세요.');
  else if (!state.spaceIds.length) p.push('공간을 선택하세요.');
  else if (state.start == null || state.end == null) p.push('시작·종료 시간을 선택하세요.');
  else if (val('#f-name').length < 2) p.push('이름을 입력하세요.');
  else if (!phoneOk(val('#f-phone'))) p.push('휴대전화 번호를 입력하세요.');
  else if (!(Number(val('#f-people')) >= 1)) p.push('이용 인원을 입력하세요.');
  else if (!state.agree) p.push('이용 안내 확인에 체크하세요.');
  if (!state.info.storeReady) p.push('지금은 예약할 수 없습니다.');
  return p;
}

/* ---------- 요약 ---------- */
function currentQuote() {
  if (!state.spaceIds.length || state.start == null || state.end == null) return null;
  const q = quote(C, { spaceIds: state.spaceIds, startHour: state.start, endHour: state.end, people: Number(val('#f-people')) || 0 });
  return q.ok ? q : null;
}

function renderSummary() {
  const q = currentQuote();
  let html = '';
  if (!q) {
    html = '<p class="empty">날짜, 공간, 시간을 선택하면 요금이 계산됩니다.</p>';
  } else {
    html += `<div class="sum-rows">
      <div class="row"><span>일정</span><span>${formatKoreanDate(state.date)} ${hh(state.start)}~${hh(state.end)}</span></div>
      <div class="row"><span>이용 시간</span><span>${q.hours}시간</span></div>`;
    for (const l of q.lines) {
      let detail;
      if (l.fullDays > 0) detail = `${l.fullDays}일${l.remHours ? ` + ${l.remHours}시간` : ''}`;
      else if (l.usesDayRate) detail = '1일 요금';
      else detail = `${l.hours}시간 × ${won(l.hourly)}`;
      html += `<div class="row"><span>${l.name}</span><span>${won(l.cost)}</span></div><div class="sub">${detail}${l.cost < l.listPrice ? ` (시간당 합계 ${won(l.listPrice)})` : ''}</div>`;
    }
    if (q.packageDiscount > 0) html += `<div class="row minus"><span>전체 통대관 할인</span><span>-${won(q.packageDiscount)}</span></div>`;
    if (q.extraPeople > 0) html += `<div class="row"><span>인원 초과 ${q.extraPeople}명</span><span>${won(q.overageFee)}</span></div><div class="sub">최대 ${q.capacity}명 초과, 1인당 ${won(C.overagePerPerson)}</div>`;
    html += '</div>';
  }
  $('#sumBody').innerHTML = html;
  const total = q ? won(q.total) : '0원';
  $('#sumTotal').textContent = total;
  $('#mTotal').textContent = total;

  const problems = formProblems();
  const disabled = problems.length > 0 || state.submitting;
  $('#submitBtn').disabled = disabled;
  $('#mSubmit').disabled = disabled;
  $('#ctaHint').textContent = problems[0] || '';

  const cap = state.spaceIds.reduce((a, id) => a + C.spaces.find((s) => s.id === id).capacity, 0);
  $('#peopleHint').textContent = cap ? `선택한 공간 최대 ${cap}명. 초과 시 1인당 ${won(C.overagePerPerson)}이 추가됩니다.` : '';
}

/* ---------- 계좌, 안내 ---------- */
function renderBank() {
  const b = state.info.bank;
  const box = $('#bankBox');
  if (!b) {
    box.innerHTML = '<h3>입금 계좌</h3><p class="hint">계좌 정보가 아직 설정되지 않았습니다. 담당자에게 문의하세요.</p>';
    return;
  }
  box.innerHTML = `<h3>입금 계좌</h3><div class="acct num">${esc(b.name)} ${esc(b.number)}</div><p class="who">예금주 ${esc(b.holder)}</p><button type="button" class="copy" data-copy="${esc(b.number)}">계좌번호 복사</button>`;
}

function renderStatic() {
  $('#where').innerHTML = `${esc(C.address)}<br>${esc(C.access)}`;
  const rules = [
    `최소 ${C.minHours}시간부터 예약할 수 있습니다.`,
    `${C.dayHours}시간 이상 이용하면 1일 요금이 적용됩니다.`,
    `최대 수용 인원을 넘으면 1인당 ${won(C.overagePerPerson)}이 추가됩니다.`,
    `이용 시작 ${C.minLeadHours}시간 전까지 예약할 수 있습니다.`,
    `예약 후 ${C.holdHours}시간 안에 입금하세요. 입금이 확인되지 않으면 예약이 취소됩니다.`,
    state.info.contact ? `변경과 취소는 ${esc(state.info.contact)}로 문의하세요.` : '변경과 취소는 담당자에게 문의하세요.',
  ];
  $('#rules').innerHTML = rules.map((r) => `<li>${r}</li>`).join('');
  $('#foot').innerHTML = `<span>입금 확인 후 예약이 확정됩니다.</span>${state.info.contact ? `<span>문의 ${esc(state.info.contact)}</span>` : ''}`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderAll() {
  normalizeTime();
  renderCalendar();
  renderStatus();
  renderSpaces();
  renderTime();
  renderSummary();
  renderBank();
  renderStatic();
  renderLast();
}

/* ---------- 이벤트 ---------- */
$('#cal').addEventListener('click', (e) => {
  const b = e.target.closest('.day[data-date]');
  if (!b || b.disabled) return;
  state.date = b.dataset.date;
  state.start = state.end = null;
  renderAll();
  $('#statusTitle').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#prevM').addEventListener('click', () => shiftMonth(-1));
$('#nextM').addEventListener('click', () => shiftMonth(1));
function shiftMonth(n) {
  let { y, m } = state.month;
  m += n;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  state.month = { y, m };
  renderCalendar();
}

$('#spaces').addEventListener('click', (e) => {
  const b = e.target.closest('.space');
  if (!b) return;
  const id = b.dataset.id;
  if (id === '__all') {
    state.spaceIds = state.spaceIds.length === C.spaces.length ? [] : C.spaces.map((s) => s.id);
  } else {
    state.spaceIds = state.spaceIds.includes(id) ? state.spaceIds.filter((x) => x !== id) : [...state.spaceIds, id];
  }
  renderAll();
});

$('#startChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-start]');
  if (!b || b.disabled) return;
  state.start = Number(b.dataset.start);
  state.end = null;
  renderAll();
});
$('#endChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-end]');
  if (!b) return;
  state.end = Number(b.dataset.end);
  renderAll();
});

for (const id of ['#f-name', '#f-people', '#f-purpose']) $(id).addEventListener('input', renderSummary);
$('#f-phone').addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); renderSummary(); });
$('#f-agree').addEventListener('change', (e) => { state.agree = e.target.checked; renderSummary(); });
$('#retryBtn').addEventListener('click', loadAvailability);

document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy]');
  if (!c) return;
  try { await navigator.clipboard.writeText(c.dataset.copy); } catch {
    const t = document.createElement('textarea'); t.value = c.dataset.copy; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  const old = c.textContent;
  c.textContent = '복사했습니다';
  c.classList.add('done');
  setTimeout(() => { c.textContent = old; c.classList.remove('done'); }, 1800);
});

/* ---------- 예약 ---------- */
async function submit() {
  const problems = formProblems();
  if (problems.length || state.submitting) return;
  state.submitting = true;
  renderSummary();
  const body = {
    date: state.date, start: state.start, end: state.end, spaces: state.spaceIds,
    name: val('#f-name'), phone: val('#f-phone'), people: Number(val('#f-people')),
    purpose: val('#f-purpose'), agree: state.agree, website: $('#f-website').value,
  };
  try {
    const j = await api('/api/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const last = { ...j.reservation, holdHours: j.holdHours };
    try { localStorage.setItem('women:last', JSON.stringify(last)); } catch { /* 저장 불가 환경 */ }
    state.start = state.end = null;
    await loadAvailability();
    showDone(last);
  } catch (err) {
    if (err.code === 'CONFLICT') await loadAvailability();
    $('#ctaHint').textContent = err.message;
    $('#ctaHint').style.color = 'var(--danger)';
    setTimeout(() => { $('#ctaHint').style.color = ''; }, 6000);
  } finally {
    state.submitting = false;
    renderSummary();
  }
}
$('#submitBtn').addEventListener('click', submit);
$('#mSubmit').addEventListener('click', submit);

/* ---------- 완료 대화상자 ---------- */
function showDone(r) {
  const dlg = $('#done');
  const b = state.info.bank;
  const spaces = r.spaces.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');
  dlg.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'dlg';

  const h = document.createElement('h2'); h.id = 'doneTitle'; h.textContent = '예약이 등록되었습니다'; wrap.append(h);
  const p = document.createElement('p'); p.textContent = `아래 계좌로 입금해 주세요. 입금이 확인되면 예약이 확정됩니다.`; wrap.append(p);
  const big = document.createElement('div'); big.className = 'big num'; big.textContent = won(r.amount); wrap.append(big);

  const bank = document.createElement('div'); bank.className = 'bank';
  if (b) {
    bank.innerHTML = `<h3>입금 계좌</h3><div class="acct num">${esc(b.name)} ${esc(b.number)}</div><p class="who">예금주 ${esc(b.holder)}</p>`;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'copy'; btn.dataset.copy = b.number; btn.textContent = '계좌번호 복사';
    bank.append(btn);
  } else {
    bank.innerHTML = '<h3>입금 계좌</h3><p class="hint">계좌 정보가 설정되지 않았습니다. 담당자에게 문의하세요.</p>';
  }
  wrap.append(bank);

  const dl = document.createElement('dl');
  const rows = [
    ['예약번호', r.id], ['일정', `${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)}`], ['공간', spaces],
    ['입금자명', r.name], ['입금 기한', formatKstDateTime(r.holdUntil)],
  ];
  for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
  wrap.append(dl);

  const ol = document.createElement('ol');
  for (const t of [
    `입금자명을 "${r.name}"으로 입금합니다.`,
    `${formatKstDateTime(r.holdUntil)}까지 입금이 확인되지 않으면 예약이 취소됩니다.`,
    '입금이 확인되면 예약 현황에 "예약 완료"로 표시됩니다.',
  ]) { const li = document.createElement('li'); li.textContent = t; ol.append(li); }
  wrap.append(ol);

  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn ghost'; close.textContent = '닫기';
  close.addEventListener('click', () => dlg.close());
  wrap.append(close);
  dlg.append(wrap);
  if (!dlg.open) dlg.showModal();
}

function renderLast() {
  let last = null;
  try { last = JSON.parse(localStorage.getItem('women:last') || 'null'); } catch { /* 무시 */ }
  const show = last && last.holdUntil > now() && ymdNum(last.date) >= ymdNum(todayKst(now()));
  $('#lastNotice').hidden = !show;
  if (show) $('#lastText').textContent = `최근 예약 ${formatKoreanDate(last.date)} ${hh(last.start)}~${hh(last.end)} · ${won(last.amount)}`;
}
$('#lastBtn').addEventListener('click', () => {
  try { showDone(JSON.parse(localStorage.getItem('women:last'))); } catch { /* 무시 */ }
});

/* ---------- 시작 ---------- */
(async function init() {
  await loadInfo();
  const t = todayKst(now());
  state.date = t;
  const p = parseYmd(t);
  state.month = { y: p.y, m: p.m };
  renderStatic();
  await loadAvailability();
  state.date = firstOpenDate();
  const dp = parseYmd(state.date);
  state.month = { y: dp.y, m: dp.m };
  renderAll();
  setInterval(() => { if (!document.hidden) loadAvailability(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAvailability(); });
})();
