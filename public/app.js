import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { blockLabel, dayFullyBlocked } from '/shared/rules.mjs';
import { ic } from '/icons.js';
import { watchOverlay, openOverlay, closeOverlay, overlayPop } from '/overlay.js';
import { todayKst, parseYmd, addDays, kstEpoch, ymd, ymdNum, formatKoreanDate, formatKstDateTime, hh, DOW_LABELS } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOUR_MS = 3600 * 1000;
const HOURS = Array.from({ length: C.closeHour - C.openHour }, (_, i) => C.openHour + i);
const STEPS = 6; // 1 날짜, 2 공간, 3 시간, 4 인원, 5 예약자, 6 확인. 7은 입금 안내, 8은 내 예약 확인.
const BASE_BLOCKED = [...C.blockedDates];

const state = {
  offset: 0,
  info: { bank: null, contact: null, storeReady: true },
  taken: {},
  step: 1,
  date: null,
  month: null,
  spaceIds: [],
  start: null,
  end: null,
  people: 10,
  purpose: '',
  name: '',
  phone: '',
  agree: false,
  website: '',
  submitting: false,
  error: '',
  done: null,
  photos: {},
  mapKey: null,
  kakaoKey: null,
  lk: { id: '', phone: '', rec: null, err: '', msg: '', busy: false, cancelOpen: false, reason: '' },
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
    throw err;
  }
  return json;
}

function indexItems(items) {
  const idx = {};
  for (const it of items) {
    for (const sp of it.spaces) {
      for (let h = it.start; h < it.end; h++) {
        const bySpace = ((idx[it.date] ||= {})[sp] ||= {});
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
    state.photos = j.photos || {};
    state.mapKey = j.naverMapClientId || null;
    state.kakaoKey = j.kakaoMapKey || null;
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
    C.blockedDates = [...BASE_BLOCKED, ...(j.blocks || [])];
    $('#netNotice').hidden = true;
  } catch {
    $('#netNotice').hidden = false;
  }
  if (state.step <= 3) render(true);
}

/* ---------- 상태 계산 ---------- */
function slotState(date, spaceId, hour) {
  const label = blockLabel(C, date, spaceId, hour);
  if (label) return { s: 'blocked', label };
  if (kstEpoch(date, hour) < now() + C.minLeadHours * HOUR_MS) return { s: 'past' };
  return { s: state.taken[date]?.[spaceId]?.[hour] || 'free' };
}
const isFree = (date, spaceId, hour) => slotState(date, spaceId, hour).s === 'free';
const allFree = (date, ids, hour) => ids.length > 0 && ids.every((id) => isFree(date, id, hour));
const freeHours = (date, spaceId) => HOURS.filter((h) => isFree(date, spaceId, h)).length;

function dayStatus(date) {
  const today = todayKst(now());
  if (ymdNum(date) < ymdNum(today) || ymdNum(date) > ymdNum(addDays(today, C.horizonDays))) return 'out';
  if (dayFullyBlocked(C, date)) return 'blocked';
  return C.spaces.some((s) => freeHours(date, s.id) >= C.minHours) ? 'open' : 'full';
}

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

const capacity = () => state.spaceIds.reduce((a, id) => a + C.spaces.find((s) => s.id === id).capacity, 0);
const spaceNames = (ids) => ids.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');

function currentQuote() {
  if (!state.spaceIds.length || state.start == null || state.end == null) return null;
  const q = quote(C, { spaceIds: state.spaceIds, startHour: state.start, endHour: state.end, people: state.people || 0 });
  return q.ok ? q : null;
}

/* ---------- 입력 검증 ---------- */
const phoneDigits = (s) => s.replace(/\D/g, '');
const phoneOk = (s) => /^01[016789]\d{7,8}$/.test(phoneDigits(s));
function formatPhone(s) {
  const d = phoneDigits(s).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function stepProblem(step) {
  if (!state.info.storeReady) return '지금은 예약할 수 없습니다.';
  switch (step) {
    case 1: return state.date ? '' : '이용하실 날짜를 먼저 골라 주세요.';
    case 2: return state.spaceIds.length ? '' : '공간을 하나 이상 골라 주세요.';
    case 3: return state.start == null ? '시작 시간을 골라 주세요.' : state.end == null ? '끝나는 시간도 골라 주세요.' : '';
    case 4: return state.people >= 1 ? '' : '오시는 인원을 알려 주세요.';
    case 5: return state.name.trim().length < 2 ? '이름을 알려 주세요.' : !phoneOk(state.phone) ? '연락받을 휴대전화 번호를 알려 주세요.' : '';
    case 6: return state.agree ? '' : '이용 안내 확인에 체크하세요.';
    case 8: return state.lk.rec ? '' : state.lk.id.trim().length < 6 ? '예약번호를 입력해 주세요.' : !phoneOk(state.lk.phone) ? '휴대전화 번호를 입력해 주세요.' : '';
    default: return '';
  }
}

/* ---------- 작은 조각 ---------- */
const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
const alertBox = (kind, ico, text, btn = '') => `<div class="alert a-${kind}">${ic(ico, 24)}<span>${text}</span>${btn}</div>`;
const sw = (style) => `<i class="sw" style="${style}"></i>`;
const LEGEND = `<div class="legend"><span>${sw('background:#fff;border-color:var(--c-line-strong)')}예약 가능</span><span>${sw('background:var(--c-pend-bg);border-color:var(--c-pend-line)')}입금 대기</span><span>${sw('background:var(--c-booked)')}예약 완료</span><span>${sw('background:repeating-linear-gradient(135deg,#C6CCD9 0 3px,#F3F5F9 3px 6px)')}휴무</span></div>`;
const OFF_STRIPE = 'background:repeating-linear-gradient(135deg,#C6CCD9 0 3px,#F3F5F9 3px 6px)';

/* ---------- 단계 화면 ---------- */
function viewDate() {
  const { y, m } = state.month;
  const today = todayKst(now());
  const tp = parseYmd(today);
  const lastDate = parseYmd(addDays(today, C.horizonDays));
  const first = parseYmd(ymd(y, m, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = DOW_LABELS.map((d) => `<div class="dw">${d}</div>`).join('');
  for (let i = 0; i < first.dow; i++) cells += '<span></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(y, m, d);
    const st = dayStatus(date);
    const label = date === today ? '오늘' : st === 'blocked' ? '휴무' : st === 'full' ? '마감' : '';
    const k = [st === 'out' ? 'past' : '', st === 'blocked' ? 'off' : '', st === 'full' ? 'full' : '', date === today ? 'today' : '', date === state.date ? 'sel' : ''].filter(Boolean).join(' ');
    const dot = state.taken[date] && st === 'open' ? '<i class="dot"></i>' : '';
    const aria = `${formatKoreanDate(date)}${st === 'blocked' ? ' 휴무' : st === 'full' ? ' 마감' : ''}`;
    cells += `<button type="button" class="day ${k}" data-date="${date}" ${st === 'out' ? 'disabled' : ''} aria-pressed="${date === state.date}" aria-label="${aria}">${d}${label ? `<small>${label}</small>` : ''}${dot}</button>`;
  }
  return `<h1>언제 이용하실 건가요?</h1>
    <p class="lead">이용 ${C.minLeadHours}시간 전까지 신청할 수 있어요.</p>
    <div class="card">
      <div class="calhd">
        <button type="button" class="circ" id="prevM" aria-label="이전 달" ${y === tp.y && m === tp.m ? 'disabled style="opacity:.45"' : ''}>${ic('left')}</button>
        <h2 class="num">${y}년 ${m}월</h2>
        <button type="button" class="circ" id="nextM" aria-label="다음 달" ${y === lastDate.y && m === lastDate.m ? 'disabled style="opacity:.45"' : ''}>${ic('right')}</button>
      </div>
      <div class="cal">${cells}</div>
    </div>
    <div class="legend" style="margin-top:14px"><span><i class="sw" style="border-color:var(--c-brand)"></i>오늘</span><span><i class="dot"></i>예약 있음</span><span>${sw(OFF_STRIPE)}휴무</span><span>${sw('background:var(--c-off-bg)')}마감</span></div>`;
}

const coverIdx = {}; // 공간별로 지금 보고 있는 사진 번호
function spaceCard(s) {
  const free = freeHours(state.date, s.id);
  const dis = free < C.minHours;
  const on = state.spaceIds.includes(s.id);
  const real = state.photos[s.id] || [];
  const strip = real.length
    ? real.map((src, i) => `<img class="ph" src="${esc(src)}" alt="${esc(s.name)} 사진 ${i + 1}" ${i ? 'loading="lazy"' : ''} data-zoom="${s.id}" data-i="${i}" draggable="false">`).join('')
    : `<div class="ph" role="img" aria-label="${esc(s.name)} 사진 준비 중">${ic('cam', 30)}</div>`;
  const desc = `${s.note}${s.layout ? ` · ${s.layout}` : ''}`;
  return `<div class="sp ${on ? 'on' : ''} ${dis ? 'dis' : ''}">
    <div class="stripw"><div class="strip" data-track="${s.id}" role="group" aria-label="${esc(s.name)} 사진, 옆으로 밀어서 넘기기">${strip}</div>${real.length > 1 ? `<span class="cnt num" data-count="${s.id}">${(coverIdx[s.id] || 0) + 1}/${real.length}</span>` : ''}<span class="chk" aria-hidden="true">${on ? ic('check', 18) : ''}</span></div>
    <button type="button" class="spb" data-id="${s.id}" aria-pressed="${on}" ${dis ? 'disabled' : ''} title="${esc(desc)}">
      <span class="spt"><h3>${esc(s.name)}</h3>${dis ? badge('off', '예약 불가', 'ban') : badge('ok', `${free}시간 가능`, 'clock')}</span>
      <span class="meta">${ic('users', 16)}최대 ${s.capacity}명 · ${s.pyeong}평</span>
      <span class="num sp-price"><b>시간당 ${won(s.hourly)}</b> <span class="muted"><i class="dotsep">· </i>1일 ${won(s.daily)}</span></span>
    </button></div>`;
}

function viewSpace() {
  const all = state.spaceIds.length === C.spaces.length;
  const saved = C.spaces.reduce((a, s) => a + s.daily, 0) - C.packageDayPrice;
  return `<h1>어떤 공간이 필요하세요?</h1>
    <p class="lead">${formatKoreanDate(state.date)} · 여러 공간을 함께 고를 수 있어요.</p>
    <div class="sps">${C.spaces.map(spaceCard).join('')}</div>
    <div class="all ${all ? 'on' : ''}">
      <div style="flex:1"><h3>전체 통대관</h3><p class="muted sm">${C.spaces.length}개 공간 전체 · 1일(${C.dayHours}시간) ${won(C.packageDayPrice)}${saved > 0 ? `<br>개별 합계보다 ${won(saved)} 저렴해요.` : ''}</p></div>
      <button type="button" class="pick pick-all" data-id="__all" aria-pressed="${all}">${all ? `${ic('check', 20)}선택됨` : '전체 선택'}</button>
    </div>`;
}

// 공간별 시간 칸 상태를 작은 현황표로 보여 줍니다.
function miniStatus(spaceIds) {
  const date = state.date;
  const picked = new Set(state.spaceIds);
  let html = `<div class="stat-mini" style="grid-template-columns:56px repeat(${HOURS.length},1fr)">`;
  for (const sp of C.spaces.filter((s) => spaceIds.includes(s.id))) {
    html += `<span>${esc(sp.name)}</span>`;
    for (const h of HOURS) {
      const st = slotState(date, sp.id, h);
      const mine = picked.has(sp.id) && state.start != null && state.end != null && h >= state.start && h < state.end;
      const k = mine && st.s === 'free' ? 's' : { confirmed: 'k', pending: 'p', blocked: 'o', past: 'o', free: '' }[st.s];
      const title = `${sp.name} ${h}시 ${{ confirmed: '예약 완료', pending: '입금 대기', blocked: '휴무', past: '예약 마감', free: '예약 가능' }[st.s]}`;
      html += `<span class="m ${k}" title="${title}"><span class="sr-only">${title}</span></span>`;
    }
  }
  return `${html}</div>`;
}

function hourGrid() {
  const ids = state.spaceIds;
  const sel = (h) => state.start != null && state.end != null && h >= state.start && h < state.end;
  const startable = (h) => maxEndFor(h) - h >= C.minHours;
  const endable = (h) => state.start != null && state.end == null && h > state.start && h + 1 - state.start >= C.minHours && h + 1 <= maxEndFor(state.start);
  let html = `<div class="hgrid" style="grid-template-columns:84px repeat(${HOURS.length},minmax(0,1fr))"><span></span>${HOURS.map((h) => `<span class="hh">${h}시</span>`).join('')}`;
  for (const sp of C.spaces.filter((x) => ids.includes(x.id))) {
    html += `<span class="rl">${esc(sp.name)}</span>`;
    for (const h of HOURS) {
      const st = slotState(state.date, sp.id, h);
      const title = `${sp.name} ${h}시 ${{ confirmed: '예약 완료', pending: '입금 대기', blocked: '휴무', past: '예약 마감', free: '예약 가능' }[st.s]}`;
      if (st.s !== 'free') {
        const k = { confirmed: 'book', pending: 'pend', blocked: 'off', past: 'off' }[st.s];
        const t = { confirmed: '예약', pending: '대기', blocked: '휴무', past: '마감' }[st.s];
        html += `<div class="hc ${k}" title="${title}">${t}<span class="sr-only"> ${title}</span></div>`;
      } else {
        const on = startable(h) || endable(h);
        const isSel = sel(h) || (state.start === h && state.end == null);
        html += `<button type="button" class="hc ${isSel ? 'sel' : ''}" data-h="${h}" ${on || isSel ? '' : 'disabled style="background:#F1F3F8;cursor:not-allowed"'} aria-pressed="${isSel}" aria-label="${hh(h)} ${on ? '선택' : '선택 불가'}">${isSel ? ic('check', 16) : ''}</button>`;
      }
    }
  }
  return `${html}</div>`;
}

function viewTime() {
  const ids = state.spaceIds;
  const chip = (attr, h, on, dis) => `<button type="button" class="chip ${on ? 'on' : ''} ${dis ? 'dis' : ''}" ${attr}="${h}" aria-pressed="${on}" ${dis ? 'disabled' : ''}>${hh(h)}</button>`;
  let starts = '';
  for (let h = C.openHour; h <= C.closeHour - C.minHours; h++) {
    let ok = true;
    for (let k = 0; ok && k < C.minHours; k++) ok = allFree(state.date, ids, h + k);
    starts += chip('data-start', h, state.start === h, !ok);
  }
  // 시작 시간을 고른 뒤에는 한 줄로 접어 화면을 아낍니다("변경"을 누르면 다시 펼쳐짐).
  let startCard = `<div class="card"><p class="lab">시작 시간</p><div class="chips">${starts}</div></div>`;
  let endCard = `<p class="muted row-f">${ic('info', 20)}시작 시간을 고르면 종료 시간을 고를 수 있어요.</p>`;
  if (state.start != null) {
    let e = '';
    const max = maxEndFor(state.start);
    for (let x = state.start + C.minHours; x <= max; x++) e += chip('data-end', x, state.end === x, false);
    startCard = `<div class="card row-f sp-b" style="padding:8px 8px 8px 16px"><span class="row-f"><span class="b muted">시작</span><b class="num" style="font-size:22px">${hh(state.start)}</b></span><button type="button" class="btn secondary s" id="chgStart">변경</button></div>`;
    endCard = `<div class="card"><p class="lab">종료 시간</p><div class="chips">${e}</div></div>`;
  }
  const result = state.start != null && state.end != null ? `<div class="result num only-d" style="margin-top:16px">${ic('clock', 24)}${hh(state.start)} ~ ${hh(state.end)} (${state.end - state.start}시간)</div>` : '';
  const err = state.error ? `<div style="margin-top:16px">${alertBox('err', 'alert', esc(state.error))}</div>` : '';
  return `<h1>몇 시부터 몇 시까지 쓰실까요?</h1>
    <p class="lead">최소 ${C.minHours}시간부터 신청할 수 있어요.</p>
    <div class="only-m stack">
      ${startCard}
      ${endCard}
      <details class="card"><summary>이날 예약 현황${ic('chev', 22)}</summary><div style="margin-top:12px">${miniStatus(ids)}<div style="margin-top:12px">${LEGEND}</div></div></details>
    </div>
    <div class="only-d card"><p class="lab">시간표에서 시작 칸과 끝 칸을 차례로 눌러 주세요.</p>${hourGrid()}<div style="margin-top:14px">${LEGEND}</div></div>
    ${result}${err}`;
}

const QUICK_PEOPLE = [5, 10, 20, 30, 50];
const PURPOSES = ['동아리', '회의', '전시', '강연', '워크숍'];

function overAlert() {
  const cap = capacity();
  const extra = Math.max(0, state.people - cap);
  return extra ? alertBox('warn', 'info', `최대 인원을 ${extra}명 넘었어요. ${extra}명 × ${won(C.overagePerPerson)} = ${won(extra * C.overagePerPerson)}이 더해져요.`) : '';
}

function viewPeople() {
  return `<h1>몇 분이 오시나요?</h1>
    <p class="lead" id="overnote">최대 ${capacity()}명, 초과 시 1인당 ${won(C.overagePerPerson)}</p>
    <div class="card stack">
      <div class="counter">
        <button type="button" class="circ" id="pMinus" aria-label="1명 줄이기">${ic('minus', 28)}</button>
        <div class="num"><input id="f-people" class="cnum" type="number" inputmode="numeric" min="1" max="500" value="${state.people}" aria-label="이용 인원"><small>명</small></div>
        <button type="button" class="circ" id="pPlus" aria-label="1명 늘리기">${ic('plus', 28)}</button>
      </div>
      <div class="chips five" role="group" aria-label="인원 빠른 선택">${QUICK_PEOPLE.map((n) => `<button type="button" class="chip" data-people="${n}" aria-pressed="${state.people === n}">${n}명</button>`).join('')}</div>
      <div id="overAlert">${overAlert()}</div>
    </div>
    <div class="card stack" style="margin-top:16px">
      <p class="lab" style="margin:0">이용 목적 <span class="muted" style="font-weight:400">(선택)</span></p>
      <div class="chips" role="group" aria-label="이용 목적">${PURPOSES.map((t) => `<button type="button" class="chip" data-purpose="${t}" aria-pressed="${state.purpose === t}">${t}</button>`).join('')}</div>
      <input id="f-purpose" class="input" maxlength="100" placeholder="직접 입력" value="${esc(state.purpose)}" aria-label="이용 목적 직접 입력">
    </div>`;
}

function viewPerson() {
  return `<h1>예약하시는 분을 알려 주세요</h1>
    <p class="lead">입금하실 분 이름과 같게 적어 주세요. 연락처는 예약 안내와 확인에만 써요.</p>
    <div class="card stack">
      <div class="field"><label for="f-name">이름</label>
        <input id="f-name" class="input" autocomplete="name" maxlength="20" placeholder="예: 김미영" value="${esc(state.name)}"><div id="e-name" aria-live="polite"></div></div>
      <div class="field"><label for="f-phone">휴대전화</label>
        <input id="f-phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(state.phone)}"><div id="e-phone" aria-live="polite"><p class="msg hint">숫자만 눌러도 돼요. 010-0000-0000 형식</p></div></div>
      <input class="hp" type="text" id="f-website" tabindex="-1" autocomplete="off" aria-hidden="true">
    </div>`;
}

function viewReview() {
  const q = currentQuote();
  let calc = '';
  if (q) {
    for (const l of q.lines) {
      let detail;
      if (l.fullDays > 0) detail = `${l.fullDays}일${l.remHours ? ` + ${l.remHours}시간` : ''}`;
      else if (l.usesDayRate) detail = '1일 요금';
      else detail = `${l.hours}시간 × ${won(l.hourly)}`;
      calc += `<div class="pr"><span>${esc(l.name)} (${detail})</span><span>${won(l.cost)}</span></div>`;
    }
    if (q.packageDiscount > 0) calc += `<div class="pr neg"><span>전체 통대관 할인</span><span>-${won(q.packageDiscount)}</span></div>`;
    if (q.extraPeople > 0) calc += `<div class="pr"><span>인원 초과 ${q.extraPeople}명 (최대 ${q.capacity}명)</span><span>${won(q.overageFee)}</span></div>`;
  }
  const rules = `${C.holdHours}시간 안에 입금하시면 예약이 확정돼요.${state.info.contact ? ` 문의 ${esc(state.info.contact)}` : ''}`;
  const on = state.agree;
  const people = `${state.people}명${state.purpose ? ` · ${esc(state.purpose)}` : ''}`;
  return `<h1>마지막으로 확인해 주세요</h1>
    <p class="lead">내용이 맞는지 살펴보고 신청해 주세요.</p>
    <div class="stack">
      <div class="card"><dl class="kv"><dt>일정</dt><dd>${formatKoreanDate(state.date)} ${hh(state.start)} ~ ${hh(state.end)}</dd><dt>공간</dt><dd>${esc(spaceNames(state.spaceIds))}</dd><dt>인원</dt><dd>${people}</dd><dt>예약자</dt><dd>${esc(state.name)} · ${esc(state.phone)}</dd></dl></div>
      <div class="card"><div class="stack" style="gap:10px">${calc}</div><div class="hr"></div><div class="pr" style="align-items:baseline"><b>입금할 금액</b><span class="amount num" style="color:var(--c-brand-strong)">${q ? won(q.total) : '0원'}</span></div></div>
      <label class="check ${on ? 'on' : ''}"><input type="checkbox" id="f-agree" class="sr-only" ${on ? 'checked' : ''}><span class="box ${on ? 'on' : ''}">${on ? ic('check', 20) : ''}</span><span>내용을 확인했어요. ${rules}</span></label>
      ${state.error ? alertBox('err', 'alert', esc(state.error)) : ''}
    </div>`;
}

const acctCard = (b, holderNote = '') => b
  ? `<div class="acct"><div class="row-f sp-b"><span class="b muted">입금 계좌</span><span class="sm">${esc(b.name)} · 예금주 ${esc(b.holder)}</span></div><p class="no num">${esc(b.number)}</p>${holderNote}<button type="button" class="btn primary block" data-copy="${esc(b.number)}">${ic('copy', 20)}계좌번호 복사하기</button></div>`
  : '<div class="acct"><p class="b muted">입금 계좌</p><p class="sm">계좌 정보가 없습니다. 담당자에게 문의하세요.</p></div>';

function viewDone() {
  const r = state.done;
  return `<div class="paytop"><div class="ico-ok">${ic('check', 30)}</div><div><h1>입금해 주세요</h1><p class="muted">입금이 확인되면 예약이 확정됩니다.</p></div></div>
    <div class="stack paygrid">
      <div class="stack"><div class="card amt-row"><div><p class="muted sm">입금하실 금액</p><p class="amount num" style="color:var(--c-brand-strong)">${won(r.amount)}</p></div><button type="button" class="btn secondary s" data-copy="${r.amount}">${ic('copy', 18)}금액 복사</button></div>
      ${acctCard(state.info.bank)}</div>
      <div class="card"><dl class="kv"><dt>예약번호</dt><dd class="num" style="font-size:20px;letter-spacing:.06em">${esc(r.id)}</dd><dt>일정</dt><dd>${formatKoreanDate(r.date)} ${hh(r.start)} ~ ${hh(r.end)}</dd><dt>공간</dt><dd>${esc(spaceNames(r.spaces))}</dd><dt>입금자명</dt><dd>${esc(r.name)}</dd><dt>입금 기한</dt><dd style="color:var(--c-pend-fg)">${formatKstDateTime(r.holdUntil)}까지</dd></dl>
      <div class="hr"></div>
      <ol class="notes"><li>입금자명을 예약하신 분 이름과 같게 보내 주세요.</li><li>기한(${C.holdHours}시간)이 지나면 예약이 자동으로 취소돼요.</li><li>예약번호는 조회·취소에 필요해요. 화면을 캡처해 두세요.</li></ol></div>
    </div>`;
}

function lookupBadge(r) {
  if (r.status === 'pending') return badge('pend', '입금 대기', 'clock');
  if (r.status === 'confirmed') return r.cancelRequested ? badge('bad', '취소 요청 중', 'alert') : badge('ok', '확정', 'check');
  if (r.status === 'expired') return badge('off', '기한 만료', 'clock');
  return badge('off', '취소', 'ban');
}

function viewLookup() {
  const k = state.lk;
  const r = k.rec;
  const bad = Boolean(k.err);
  let result = '';
  if (r) {
    const pend = r.status === 'pending';
    const bank = state.info.bank;
    let extra = '';
    if (pend) extra = acctCard(bank, `<p class="sm">입금자명 ${esc(r.name)}</p>`);
    else if (r.status === 'expired') extra = alertBox('warn', 'info', '입금 기한이 지났어요. 다시 예약해 주세요.');
    const canCancel = pend || (r.status === 'confirmed' && !r.cancelRequested);
    let cancel = '';
    if (canCancel) {
      cancel = k.cancelOpen
        ? `<div class="stack" style="border-top:1px solid var(--c-line);padding-top:16px"><p class="b">${pend ? '바로 취소됩니다.' : '담당자가 확인한 뒤 취소하고 환불합니다. (취소 요청으로 접수돼요)'}</p><div class="field"><label for="f-reason">취소 사유 <span class="muted" style="font-weight:400">(선택)</span></label><textarea id="f-reason" class="input" maxlength="100" placeholder="사유를 적어 주세요">${esc(k.reason)}</textarea></div><div class="cols2"><button type="button" class="btn danger" id="lkDoCancel" ${k.busy ? 'disabled' : ''}>${k.busy ? '<span class="spin"></span>처리하는 중…' : '취소하기'}</button><button type="button" class="btn secondary" id="lkCancelClose">돌아가기</button></div></div>`
        : `<button type="button" class="btn secondary block" id="lkCancelOpen">예약 취소</button>`;
    }
    result = `${k.msg ? alertBox('ok', 'check', esc(k.msg)) : ''}<div class="card stack"><div class="row-f sp-b">${lookupBadge(r)}<span class="muted sm num">예약번호 ${esc(r.id)}</span></div>
      <dl class="kv"><dt>일정</dt><dd>${formatKoreanDate(r.date)} ${hh(r.start)} ~ ${hh(r.end)}</dd><dt>공간</dt><dd>${esc(spaceNames(r.spaces))}</dd><dt>인원</dt><dd>${r.people}명</dd><dt>금액</dt><dd>${won(r.amount)}</dd>${pend ? `<dt>입금 기한</dt><dd style="color:var(--c-pend-fg)">${formatKstDateTime(r.holdUntil)}까지</dd>` : ''}</dl>
      ${r.status === 'confirmed' && r.cancelRequested ? '<p class="muted sm">취소 요청이 접수되었어요. 담당자가 환불 방법을 안내해 드려요.</p>' : ''}${extra}${cancel}</div>
      <button type="button" class="btn ${k.msg ? 'primary' : 'ghost'} block" id="lkDone">확인했어요</button>`;
  }
  const form = r ? '' : `<div class="card stack">
      <div class="field"><label for="f-lkid">예약번호</label><input id="f-lkid" class="input ${bad ? 'err' : ''}" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="8자리 영문·숫자" value="${esc(k.id)}"></div>
      <div class="field"><label for="f-lkphone">휴대전화</label><input id="f-lkphone" class="input ${bad ? 'err' : ''}" type="tel" inputmode="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(k.phone)}"></div>
      <button type="button" class="btn primary block" id="lkGo" ${stepProblem(8) || k.busy ? 'disabled' : ''}>${k.busy ? '<span class="spin"></span>찾는 중…' : `${ic('search', 20)}내 예약 찾기`}</button>
    </div>`;
  return `<h1>내 예약 찾기</h1>
    <p class="lead">예약번호와 휴대전화 번호를 입력해 주세요.</p>
    <div class="stack">${form}${k.err ? alertBox('err', 'alert', esc(k.err)) : ''}${result}</div>`;
}

async function doLookup() {
  const k = state.lk;
  if (k.busy) return;
  k.busy = true; k.err = ''; k.msg = ''; render(true);
  try {
    const j = await api('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id.trim(), phone: k.phone }) });
    k.rec = j.reservation; k.cancelOpen = false;
  } catch (e) { k.rec = null; k.err = e.message; }
  k.busy = false;
  render(true);
}

async function doCancel() {
  const k = state.lk;
  k.busy = true; render(true);
  try {
    const j = await api('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.rec.id, phone: k.phone, reason: k.reason }) });
    k.msg = j.mode === 'canceled' ? '예약을 취소했어요. 해당 시간이 다시 열렸어요.' : '취소 요청을 접수했어요. 담당자가 확인한 뒤 환불해 드려요.';
    k.cancelOpen = false;
    const r = await api('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.rec.id, phone: k.phone }) });
    k.rec = r.reservation;
    try { localStorage.removeItem('women:last'); } catch { /* 무시 */ }
    loadAvailability();
  } catch (e) { k.err = e.message; }
  k.busy = false;
  render(true);
}

/* ---------- 사진 확대 ---------- */
const lb = { list: [], i: 0, name: '', dir: 0 };
const lbGo = (step) => { lb.dir = step; lb.i = (lb.i + step + lb.list.length) % lb.list.length; paintLb(); };
function openLightbox(spaceId, i) {
  lb.list = state.photos[spaceId] || [];
  lb.i = i;
  lb.name = C.spaces.find((s) => s.id === spaceId)?.name || '';
  let d = $('#lightbox');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'lightbox';
    d.className = 'sheet dark';
    d.setAttribute('aria-label', '사진 보기');
    let swipedAt = 0;
    d.addEventListener('click', (e) => {
      if (Date.now() - swipedAt < 400) return; // 넘기는 동작 끝에 생기는 클릭은 무시
      if (e.target.closest('[data-lb=close]') || e.target === d) closeOverlay(d);
      else if (e.target.closest('[data-lb=prev]')) lbGo(-1);
      else if (e.target.closest('[data-lb=next]')) lbGo(1);
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') lbGo(-1);
      if (e.key === 'ArrowRight') lbGo(1);
    });
    // 화면을 좌우로 밀어서 사진 넘기기 (터치, 마우스 드래그 모두)
    let sx = 0; let sy = 0; let track = false;
    d.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sx = e.clientX; sy = e.clientY; track = true; });
    d.addEventListener('pointercancel', () => { track = false; });
    d.addEventListener('pointerup', (e) => {
      if (!track) return;
      track = false;
      const dx = e.clientX - sx; const dy = e.clientY - sy;
      if (lb.list.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipedAt = Date.now(); lbGo(dx < 0 ? 1 : -1); }
    });
    document.body.append(d);
    watchOverlay(d);
  }
  paintLb();
  openOverlay(d);
}
function paintLb() {
  const many = lb.list.length > 1;
  $('#lightbox').innerHTML = `<div class="lb"><div class="lb-top"><button type="button" class="lb-b" data-lb="close" aria-label="닫기">${ic('x', 26)}</button></div>
    <div class="lb-mid">${many ? `<button type="button" class="lb-b" data-lb="prev" aria-label="이전 사진">${ic('left', 26)}</button>` : ''}<img class="${lb.dir > 0 ? 'in-next' : lb.dir < 0 ? 'in-prev' : ''}" src="${esc(lb.list[lb.i])}" alt="${esc(lb.name)} 사진 ${lb.i + 1}" draggable="false">${many ? `<button type="button" class="lb-b" data-lb="next" aria-label="다음 사진">${ic('right', 26)}</button>` : ''}</div>
    <p class="lb-cap num">${esc(lb.name)} ${lb.i + 1} / ${lb.list.length}</p></div>`;
  lb.dir = 0;
  // 다음 사진을 미리 불러 둡니다.
  for (const k of [1, -1]) { const s = lb.list[(lb.i + k + lb.list.length) % lb.list.length]; if (s) new Image().src = s; }
}

/* 사진 줄을 밀면 "2/3"처럼 번호가 바뀝니다. scroll은 버블링하지 않아 캡처로 받습니다. */
document.addEventListener('scroll', (e) => {
  const t = e.target;
  if (!t || !t.matches || !t.matches('[data-track]')) return;
  const n = t.children.length;
  const i = Math.min(n - 1, Math.max(0, Math.round(t.scrollLeft / (t.clientWidth || 1))));
  coverIdx[t.dataset.track] = i;
  const c = t.parentElement.querySelector('[data-count]');
  if (c) c.textContent = `${i + 1}/${n}`;
}, { capture: true, passive: true });

/* ---------- 렌더 ---------- */
function render(keepScroll = false) {
  normalizeTime();
  const views = { 1: viewDate, 2: viewSpace, 3: viewTime, 4: viewPeople, 5: viewPerson, 6: viewReview, 7: viewDone, 8: viewLookup };
  const y = window.scrollY;
  const active = document.activeElement?.id;
  $('#main').innerHTML = `<section class="view s${state.step}">${views[state.step]()}</section>`;
  document.querySelectorAll('[data-track]').forEach((t) => { const i = coverIdx[t.dataset.track] || 0; if (i) t.scrollLeft = i * t.clientWidth; });
  if (keepScroll) {
    window.scrollTo(0, y);
    if (active && /^f-/.test(active)) {
      const el = document.getElementById(active);
      if (el) {
        el.focus({ preventScroll: true });
        // 글자 입력칸만 커서를 끝으로 옮깁니다. 체크박스, 숫자, 전화 칸에서는 오류가 나므로 건너뜁니다.
        const textLike = el.tagName === 'TEXTAREA' || ['text', 'search', 'url', 'email', 'password'].includes(el.type);
        if (textLike) { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* 지원하지 않는 칸 */ } }
      }
    }
  } else { const h = $('#main h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  chrome();
}

const NAMES = ['날짜', '공간', '시간', '인원', '예약자', '확인'];

function chrome() {
  const st = state.step;
  document.body.dataset.step = String(st);
  const withSteps = st <= STEPS;
  $('#back').hidden = st === 1 || st === 7;
  $('#myres').classList.toggle('on', st === 8);
  $('#prog').hidden = !withSteps;
  $('#stepnav').hidden = !withSteps;
  if (withSteps) {
    $('#progBar').style.width = `${st / STEPS * 100}%`;
    $('#progText').textContent = `${st}/${STEPS} · ${NAMES[st - 1]}`;
    $('#prog').setAttribute('aria-valuenow', String(st));
    $('#stepnav').innerHTML = NAMES.map((n, i) => `${i ? '<span class="sep"></span>' : ''}<span class="step ${i + 1 < st ? 'done' : i + 1 === st ? 'cur' : ''}" ${i + 1 === st ? 'aria-current="step"' : ''}><span class="n">${i + 1 < st ? ic('check', 16) : i + 1}</span>${n}</span>`).join('');
  }
  const hot = $('#hotline');
  if (state.info.contact) { hot.hidden = false; hot.innerHTML = `${ic('phone', 20)}대관 문의 ${esc(state.info.contact)}`; hot.href = `tel:${state.info.contact.replace(/[^0-9+]/g, '')}`; }

  // 하단 영역: 단계 1~7에서 보입니다. 버튼이 꺼진 이유는 요약 줄 자리에 한 줄로 알려 줍니다.
  const q = currentQuote();
  const dock = $('#dock');
  dock.hidden = st === 8;
  const timeTxt = state.start != null && state.end != null ? `${state.start}~${state.end}시` : null;
  const sum = [state.date ? formatKoreanDate(state.date) : null, state.spaceIds.length ? spaceNames(state.spaceIds) : null, timeTxt, q ? `예상 <em>${won(q.total)}</em>` : null].filter(Boolean);
  const peek = $('#peek');

  const btn = $('#next');
  const problem = state.submitting ? '' : stepProblem(st);
  const NEXT_LABEL = { 1: '공간 고르기', 2: '시간 정하기', 3: '인원 정하기', 4: '예약자 정보 입력', 5: '내용 확인하기' };
  btn.innerHTML = st === 6 ? (state.submitting ? '<span class="spin"></span>신청하는 중…' : q ? `${won(q.total)} 예약 신청하기` : '예약 신청하기') : st === 7 ? '확인했어요' : NEXT_LABEL[st] || '다음';
  btn.disabled = st === 7 ? false : Boolean(problem) || state.submitting;
  btn.classList.toggle('dis', btn.disabled);
  if (st >= 7) peek.hidden = true;
  else if (problem) { peek.className = 'dsum hint'; peek.innerHTML = `${ic('info', 18)}${esc(problem)}`; peek.hidden = false; }
  else if (sum.length) { peek.className = 'dsum'; peek.innerHTML = sum.map((x) => (x.startsWith('예상') ? x : esc(x))).join(' · '); peek.hidden = false; }
  else peek.hidden = true;

  renderSide();
  renderLast();
  fitVars();
}

// 화면 높이에 맞춰 본문을 가운데에 놓거나 채울 수 있도록 머리글·하단 영역 높이를 CSS 변수로 알려 줍니다.
function fitVars() {
  const root = document.documentElement.style;
  const wrap = document.querySelector('.wrap');
  root.setProperty('--top-h', `${Math.round(wrap.getBoundingClientRect().top + window.scrollY)}px`);
  const dock = $('#dock');
  const fixed = getComputedStyle(dock).position === 'fixed';
  root.setProperty('--dock-h', fixed && !dock.hidden ? `${Math.round(dock.getBoundingClientRect().height)}px` : '0px');
}
window.addEventListener('resize', () => fitVars());

// PC에서는 입금 안내 화면(7단계)에서만 입금 기한과 계좌 요약을 본문 아래에 보여 줍니다. 그 밖의 단계에는 요약 패널이 없습니다.
function renderSide() {
  if (state.step === 7 && state.done) {
    const b7 = state.info.bank;
    $('#side').innerHTML = `<div class="card soft slim"><p class="row-f b">${ic('clock', 20)}${C.holdHours}시간 안에 입금해 주세요</p><p class="sm">${b7 ? `${esc(b7.name)} ${esc(b7.number)} · 예금주 ${esc(b7.holder)}` : '입금 계좌는 담당자에게 문의해 주세요.'}</p><p class="sm" style="color:var(--c-pend-fg);font-weight:700">입금 기한 ${formatKstDateTime(state.done.holdUntil)}까지</p></div>`;
    return;
  }
  $('#side').innerHTML = '';
}

function go(step, push = true) {
  state.step = step;
  state.error = '';
  if (push) history.pushState({ step }, '');
  render();
  window.scrollTo(0, 0);
}

function renderLast() {
  let last = null;
  try { last = JSON.parse(localStorage.getItem('women:last') || 'null'); } catch { /* 무시 */ }
  const show = state.step === 1 && last && last.holdUntil > now() && ymdNum(last.date) >= ymdNum(todayKst(now()));
  $('#lastNotice').hidden = !show;
  if (show) $('#lastText').textContent = `최근 예약 ${formatKoreanDate(last.date)} ${hh(last.start)}~${hh(last.end)} · ${won(last.amount)}`;
}

/* ---------- 이벤트 ---------- */
$('#main').addEventListener('click', (e) => {
  const t = e.target;
  const day = t.closest('.day[data-date]');
  if (day && !day.disabled) {
    if (day.classList.contains('off') || day.classList.contains('full')) return;
    if (state.date !== day.dataset.date) state.start = state.end = null;
    state.date = day.dataset.date;
    return render(true);
  }
  if (t.closest('#prevM') || t.closest('#nextM')) {
    if (t.closest('button').disabled) return;
    let { y, m } = state.month;
    m += t.closest('#nextM') ? 1 : -1;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    state.month = { y, m };
    return render(true);
  }
  const z = t.closest('[data-zoom]');
  if (z) return openLightbox(z.dataset.zoom, Number(z.dataset.i));
  const pick = t.closest('[data-id]');
  if (pick && !pick.disabled) {
    const id = pick.dataset.id;
    if (id === '__all') state.spaceIds = state.spaceIds.length === C.spaces.length ? [] : C.spaces.map((s) => s.id);
    else state.spaceIds = state.spaceIds.includes(id) ? state.spaceIds.filter((x) => x !== id) : [...state.spaceIds, id];
    return render(true);
  }
  const hc = t.closest('[data-h]');
  if (hc && !hc.disabled) {
    const h = Number(hc.dataset.h);
    const maxS = state.start != null ? maxEndFor(state.start) : 0;
    if (state.start != null && state.end == null && h > state.start && h + 1 - state.start >= C.minHours && h + 1 <= maxS) state.end = h + 1;
    else { state.start = h; state.end = null; }
    state.error = '';
    return render(true);
  }
  const qp = t.closest('[data-people]');
  if (qp) { state.people = Number(qp.dataset.people); return render(true); }
  const qu = t.closest('[data-purpose]');
  if (qu) { state.purpose = state.purpose === qu.dataset.purpose ? '' : qu.dataset.purpose; return render(true); }
  const s = t.closest('[data-start]');
  if (s && !s.disabled) { state.start = Number(s.dataset.start); state.end = null; state.error = ''; return render(true); }
  const en = t.closest('[data-end]');
  if (en) { state.end = Number(en.dataset.end); return render(true); }
  if (t.closest('#pMinus')) return setPeople(state.people - 1);
  if (t.closest('#pPlus')) return setPeople(state.people + 1);
  if (t.closest('#chgStart')) { state.start = state.end = null; return render(true); }
  if (t.closest('#lkGo')) { if (!stepProblem(8)) doLookup(); return; }
  if (t.closest('#lkDone')) return reset();
  if (t.closest('#lkCancelOpen')) { state.lk.cancelOpen = true; return render(true); }
  if (t.closest('#lkCancelClose')) { state.lk.cancelOpen = false; return render(true); }
  if (t.closest('#lkDoCancel')) return doCancel();
  const c = t.closest('[data-copy]');
  if (c) copyText(c);
});

function setPeople(n) {
  state.people = Math.max(1, Math.min(500, n || 1));
  const i = $('#f-people');
  if (i) i.value = state.people;
  syncPeople();
  chrome();
}
function syncPeople() {
  const a = $('#overAlert');
  if (a) a.innerHTML = overAlert();
  const n = $('#overnote');
  if (n) n.textContent = `최대 ${capacity()}명, 초과 시 1인당 ${won(C.overagePerPerson)}`;
  for (const b of document.querySelectorAll('[data-people]')) b.setAttribute('aria-pressed', String(Number(b.dataset.people) === state.people));
}

$('#main').addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'f-people') { state.people = Math.max(0, Math.min(500, Number(e.target.value) || 0)); syncPeople(); chrome(); }
  else if (id === 'f-purpose') state.purpose = e.target.value;
  else if (id === 'f-name') {
    state.name = e.target.value;
    if (state.name.trim().length >= 2) { $('#e-name').innerHTML = ''; e.target.classList.remove('err'); }
    chrome();
  } else if (id === 'f-phone') {
    e.target.value = state.phone = formatPhone(e.target.value);
    if (phoneOk(state.phone)) { $('#e-phone').innerHTML = '<p class="msg hint">숫자만 눌러도 돼요. 010-0000-0000 형식</p>'; e.target.classList.remove('err'); }
    chrome();
  }
  else if (id === 'f-website') state.website = e.target.value;
  else if (id === 'f-lkid') { state.lk.id = e.target.value.toUpperCase(); e.target.value = state.lk.id; state.lk.rec = null; state.lk.err = ''; lookupButton(); }
  else if (id === 'f-lkphone') { e.target.value = state.lk.phone = formatPhone(e.target.value); state.lk.rec = null; state.lk.err = ''; lookupButton(); }
  else if (id === 'f-reason') state.lk.reason = e.target.value;
});
// 조회 버튼은 입력할 때마다 켜고 끕니다(화면을 다시 그리지 않아 입력이 끊기지 않습니다).
function lookupButton() {
  const b = $('#lkGo');
  if (b) b.disabled = Boolean(stepProblem(8)) || state.lk.busy;
}
$('#main').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.step === 8 && !state.lk.rec && !stepProblem(8)) { e.preventDefault(); doLookup(); }
  else if (e.key === 'Enter' && (state.step === 4 || state.step === 5) && e.target.tagName === 'INPUT' && !stepProblem(state.step)) { e.preventDefault(); go(state.step + 1); }
});
$('#main').addEventListener('change', (e) => {
  if (e.target.id === 'f-agree') { state.agree = e.target.checked; render(true); }
});
$('#main').addEventListener('focusout', (e) => {
  if (e.target.id === 'f-name') {
    const bad = state.name && state.name.trim().length < 2;
    $('#e-name').innerHTML = bad ? `<p class="msg err">${ic('alert', 18)}이름을 2자 이상 적어 주세요.</p>` : '';
    e.target.classList.toggle('err', Boolean(bad));
  }
  if (e.target.id === 'f-phone') {
    const bad = state.phone && !phoneOk(state.phone);
    $('#e-phone').innerHTML = bad ? `<p class="msg err">${ic('alert', 18)}번호를 010-0000-0000 형식으로 적어 주세요.</p>` : '<p class="msg hint">숫자만 눌러도 돼요. 010-0000-0000 형식</p>';
    e.target.classList.toggle('err', Boolean(bad));
  }
});

async function copyText(btn) {
  try { await navigator.clipboard.writeText(btn.dataset.copy); } catch {
    const t = document.createElement('textarea'); t.value = btn.dataset.copy; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  const old = btn.innerHTML;
  const size = btn.classList.contains('s') ? 18 : 20;
  btn.innerHTML = `${ic('check', size)}복사됐어요`;
  btn.classList.add('copied');
  setTimeout(() => { btn.innerHTML = old; btn.classList.remove('copied'); }, 1800);
}

$('#next').addEventListener('click', () => {
  const st = state.step;
  if (st === 7) return reset();
  if (stepProblem(st)) return;
  if (st === 6) return submit();
  go(st + 1);
});
$('#back').addEventListener('click', () => history.back());
window.addEventListener('popstate', (e) => {
  if (overlayPop()) return;
  const step = e.state?.step || 1;
  state.step = step === 8 ? 8 : state.done && step === 7 ? 7 : Math.min(step, 6);
  state.error = '';
  render();
  window.scrollTo(0, 0);
});
$('#retryBtn').addEventListener('click', loadAvailability);
$('#back').innerHTML = ic('left', 26);
$('#whereBtn').innerHTML = `${ic('pin', 20)}오시는 길`;
$('#myres').innerHTML = `${ic('search', 20)}내 예약`;
$('#myres').addEventListener('click', () => go(8));
$('#whereBtn').addEventListener('click', openWhere);
watchOverlay($('#whereDlg'));
$('#whereDlg').addEventListener('click', (e) => { if (e.target.classList.contains('scrim')) closeOverlay(e.currentTarget); });
$('#lastBtn').addEventListener('click', () => {
  try { state.done = JSON.parse(localStorage.getItem('women:last')); go(7); } catch { /* 무시 */ }
});

/* ---------- 예약 ---------- */
async function submit() {
  if (state.submitting) return;
  state.submitting = true;
  state.error = '';
  chrome();
  const body = {
    date: state.date, start: state.start, end: state.end, spaces: state.spaceIds,
    name: state.name.trim(), phone: state.phone, people: state.people,
    purpose: state.purpose.trim(), agree: state.agree, website: state.website,
  };
  try {
    const j = await api('/api/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    state.done = { ...j.reservation, holdHours: j.holdHours };
    try { localStorage.setItem('women:last', JSON.stringify(state.done)); localStorage.setItem('women:me', JSON.stringify({ name: state.name.trim(), phone: state.phone })); } catch { /* 저장 불가 환경 */ }
    state.submitting = false;
    state.step = 7;
    await loadAvailability();
    go(7);
  } catch (err) {
    state.submitting = false;
    if (err.code === 'CONFLICT') {
      await loadAvailability();
      state.start = state.end = null;
      state.step = 3;
      history.pushState({ step: 3 }, '');
      state.error = `${err.message} 다른 시간을 골라 주세요.`;
      render();
      return;
    }
    state.error = err.message;
    render(true);
  }
}

function reset() {
  Object.assign(state, { spaceIds: [], start: null, end: null, people: 10, purpose: '', agree: false, done: null, error: '', lk: { id: '', phone: '', rec: null, err: '', msg: '', busy: false, cancelOpen: false, reason: '' } });
  go(1);
}

/* ---------- 오시는 길, 네이버 지도 ---------- */
const mapQuery = () => encodeURIComponent(C.address.replace(/\s*\d+층$/, ''));
const naverUrl = () => `https://map.naver.com/p/search/${mapQuery()}`;

const MAP_LABEL = { naver: '네이버', kakao: '카카오', google: '구글' };
const mapInited = {};

function mapChoices() {
  const list = [];
  if (state.mapKey) list.push('naver');
  if (state.kakaoKey) list.push('kakao');
  list.push('google');
  return list;
}

function bizHtml() {
  const b = C.business || {};
  const parts = [b.name && `상호 ${esc(b.name)}`, b.rep && `대표 ${esc(b.rep)}`, b.regNo && `사업자등록번호 ${esc(b.regNo)}`, b.phone && `대표전화 ${esc(b.phone)}`].filter(Boolean);
  return parts.length ? `<p class="muted sm">${parts.join(' · ')}</p>` : '';
}

function buildWhere() {
  const choices = mapChoices();
  const first = choices[0];
  const panes = choices.map((m) => m === 'google'
    ? `<iframe class="map-pane" data-map="google" title="센터 위치 지도(구글)" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapQuery()}&hl=ko&z=17&output=embed" ${m === first ? '' : 'hidden'}></iframe>`
    : `<div class="map-pane" data-map="${m}" role="img" aria-label="${MAP_LABEL[m]} 지도" ${m === first ? '' : 'hidden'}></div>`).join('');
  const tel = state.info.contact ? `<a class="btn primary block" href="tel:${state.info.contact.replace(/[^0-9+]/g, '')}">${ic('phone', 20)}대관 문의 ${esc(state.info.contact)}</a>` : '';
  $('#where').innerHTML = `<div class="dlg-h"><h2>오시는 길</h2><button type="button" class="xbtn" data-close aria-label="닫기">${ic('x', 24)}</button></div>
    ${choices.length > 1 ? `<div class="chips" role="tablist" aria-label="지도 선택">${choices.map((m) => `<button type="button" class="chip" role="tab" data-maptab="${m}" aria-selected="${m === first}">${MAP_LABEL[m]} 지도</button>`).join('')}</div>` : ''}
    <div class="map">${panes}</div>
    <a class="btn secondary block" href="${naverUrl()}" target="_blank" rel="noopener">${ic('pin', 20)}지도 앱 열기 (네이버)</a>
    <a class="btn secondary block" href="https://map.kakao.com/?q=${mapQuery()}" target="_blank" rel="noopener">${ic('pin', 20)}카카오맵에서 열기</a>
    <dl class="kv" style="text-align:left"><dt>주소</dt><dd style="text-align:left">${esc(C.address)}</dd><dt>가까운 역</dt><dd style="text-align:left">${esc(C.access)}</dd></dl>
    <button type="button" class="btn secondary s" style="justify-self:start" data-copy="${esc(C.address)}">${ic('copy', 18)}주소 복사</button>
    <p class="sm">길찾기와 대중교통은 네이버 지도나 카카오맵에서 확인하세요.</p>
    ${tel}
    ${bizHtml()}`;
  mapCur = first;
}
let mapCur = 'google';

function openWhere() {
  const d = $('#whereDlg');
  openOverlay(d);
  showMap(mapCur);
}

function showMap(m) {
  mapCur = m;
  for (const el of document.querySelectorAll('#where [data-map]')) el.hidden = el.dataset.map !== m;
  for (const b of document.querySelectorAll('#where [data-maptab]')) b.setAttribute('aria-selected', String(b.dataset.maptab === m));
  if (mapInited[m]) return;
  mapInited[m] = true;
  if (m === 'naver') initNaverMap();
  else if (m === 'kakao') initKakaoMap();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}
function mapFail(m) {
  const el = $(`#where [data-map="${m}"]`);
  if (el) el.replaceWith(Object.assign(document.createElement('p'), { className: 'muted sm', textContent: `${MAP_LABEL[m]} 지도를 불러오지 못했습니다. 아래 버튼으로 지도 앱을 여세요.` }));
}

async function initNaverMap() {
  const el = $('#where [data-map="naver"]');
  try {
    if (!window.naver?.maps) await loadScript(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(state.mapKey)}&submodules=geocoder`);
    window.naver.maps.Service.geocode({ query: C.address.replace(/\s*\d+층$/, '') }, (status, resp) => {
      const a = resp?.v2?.addresses?.[0];
      if (status !== window.naver.maps.Service.Status.OK || !a) return mapFail('naver');
      const pos = new window.naver.maps.LatLng(Number(a.y), Number(a.x));
      const map = new window.naver.maps.Map(el, { center: pos, zoom: 16, zoomControl: true, zoomControlOptions: { position: window.naver.maps.Position.TOP_RIGHT } });
      new window.naver.maps.Marker({ position: pos, map });
    });
  } catch { mapFail('naver'); }
}

async function initKakaoMap() {
  const el = $('#where [data-map="kakao"]');
  try {
    if (!window.kakao?.maps) await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(state.kakaoKey)}&libraries=services&autoload=false`);
    window.kakao.maps.load(() => {
      new window.kakao.maps.services.Geocoder().addressSearch(C.address.replace(/\s*\d+층$/, ''), (result, status) => {
        if (status !== window.kakao.maps.services.Status.OK || !result[0]) return mapFail('kakao');
        const pos = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
        const map = new window.kakao.maps.Map(el, { center: pos, level: 3 });
        new window.kakao.maps.Marker({ position: pos, map });
        map.addControl(new window.kakao.maps.ZoomControl(), window.kakao.maps.ControlPosition.RIGHT);
      });
    });
  } catch { mapFail('kakao'); }
}
$('#where').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeOverlay($('#whereDlg'));
  const t = e.target.closest('[data-maptab]');
  if (t) return showMap(t.dataset.maptab);
  const c = e.target.closest('[data-copy]');
  if (c) copyText(c);
});

/* ---------- 시작 ---------- */
(async function init() {
  await loadInfo();
  const p = parseYmd(todayKst(now()));
  state.month = { y: p.y, m: p.m };
  try { const me = JSON.parse(localStorage.getItem('women:me') || 'null'); if (me) { state.name = me.name || ''; state.phone = me.phone || ''; state.lk.phone = me.phone || ''; } } catch { /* 무시 */ }
  history.replaceState({ step: 1 }, '');
  buildWhere();
  render();
  await loadAvailability();
  setInterval(() => { if (!document.hidden && state.step <= 3) loadAvailability(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.step <= 3) loadAvailability(); });
})();
