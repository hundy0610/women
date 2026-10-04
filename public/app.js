import { CONFIG as C } from '/shared/config.mjs';
import { quote } from '/shared/pricing.mjs';
import { blockLabel, dayFullyBlocked } from '/shared/rules.mjs';
import { todayKst, parseYmd, addDays, kstEpoch, ymd, ymdNum, formatKoreanDate, formatKstDateTime, hh, DOW_LABELS } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOUR_MS = 3600 * 1000;
const HOURS = Array.from({ length: C.closeHour - C.openHour }, (_, i) => C.openHour + i);
const STEPS = 6; // 1 날짜, 2 공간, 3 시간, 4 인원, 5 예약자, 6 확인. 7은 입금 안내, 8은 내 예약 확인.
const BASE_BLOCKED = [...C.blockedDates];
const STATUS_TEXT = { pending: '입금 대기', confirmed: '예약 확정', expired: '입금 기한 만료', canceled: '취소됨' };

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
  openPhotos: new Set(),
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
    case 1: return state.date ? '' : '날짜를 선택하세요.';
    case 2: return state.spaceIds.length ? '' : '공간을 하나 이상 선택하세요.';
    case 3: return state.start == null ? '시작 시간을 선택하세요.' : state.end == null ? '종료 시간을 선택하세요.' : '';
    case 4: return state.people >= 1 ? '' : '인원을 입력하세요.';
    case 5: return state.name.trim().length < 2 ? '이름을 입력하세요.' : !phoneOk(state.phone) ? '휴대전화 번호를 입력하세요.' : '';
    case 6: return state.agree ? '' : '이용 안내 확인에 체크하세요.';
    case 8: return state.lk.rec ? '' : state.lk.id.trim().length < 6 ? '예약번호를 입력하세요.' : !phoneOk(state.lk.phone) ? '휴대전화 번호를 입력하세요.' : '';
    default: return '';
  }
}

/* ---------- 단계 화면 ---------- */
function viewDate() {
  const { y, m } = state.month;
  const today = todayKst(now());
  const tp = parseYmd(today);
  const lastDate = parseYmd(addDays(today, C.horizonDays));
  const first = parseYmd(ymd(y, m, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cells = DOW_LABELS.map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < first.dow; i++) cells += '<div class="day out"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(y, m, d);
    const st = dayStatus(date);
    const small = st === 'blocked' ? '휴무' : st === 'full' ? '마감' : '';
    const cls = ['day', st === 'blocked' ? 'blocked' : '', date === today ? 'today' : '', date === state.date ? 'sel' : ''].join(' ').trim();
    const dot = state.taken[date] && !small ? '<span class="dot"></span>' : '';
    cells += `<button type="button" class="${cls}" data-date="${date}" ${st === 'out' ? 'disabled' : ''} aria-pressed="${date === state.date}" aria-label="${formatKoreanDate(date)}${small ? ' ' + small : ''}">${d}${small ? `<small>${small}</small>` : ''}${dot}</button>`;
  }
  return `<h1>이용할 날짜를 선택하세요</h1>
    <p class="sub">이용 ${C.minLeadHours}시간 전까지 예약할 수 있고, 오늘부터 ${C.horizonDays}일 뒤까지 열려 있습니다.</p>
    <div class="body">
      <div class="card">
        <div class="cal-head">
          <button type="button" class="icon-btn" id="prevM" aria-label="이전 달" ${y === tp.y && m === tp.m ? 'disabled' : ''}>&lsaquo;</button>
          <strong class="num">${y}년 ${m}월</strong>
          <button type="button" class="icon-btn" id="nextM" aria-label="다음 달" ${y === lastDate.y && m === lastDate.m ? 'disabled' : ''}>&rsaquo;</button>
        </div>
        <div class="cal">${cells}</div>
      </div>
      <div class="legend"><span><i class="l-sel"></i>오늘</span><span><i class="l-pending"></i>점은 예약이 있는 날</span><span><i class="l-blocked"></i>휴무</span></div>
    </div>`;
}

function viewSpace() {
  const cards = C.spaces.map((s) => {
    const free = freeHours(state.date, s.id);
    const real = state.photos[s.id] || [];
    const holder = real.length === 0 && C.photoPlaceholders;
    const pics = holder ? [null, null] : real;
    const isOpen = pics.length > 0 && state.openPhotos.has(s.id);
    const photoBlock = isOpen
      ? `<div class="photos" role="group" aria-label="${s.name} 사진">${pics.map((src, i) => (src ? `<img src="${esc(src)}" alt="${s.name} 사진 ${i + 1}" loading="lazy" data-zoom="${s.id}" data-i="${i}">` : `<div class="ph" role="img" aria-label="${s.name} 사진 준비 중"><b>${s.name}</b><span>사진 준비 중</span></div>`)).join('')}${pics.length > 1 && !holder ? `<span class="pcount num">${pics.length}장</span>` : ''}</div>`
      : '';
    return `<div class="opt-card"><div class="opt-main"><button type="button" class="opt" data-id="${s.id}" aria-pressed="${state.spaceIds.includes(s.id)}">
      <span class="l1"><b>${s.name}</b><span class="meta num">${s.pyeong}평 · ${s.capacity}명</span></span>
      <span class="l2"><span class="price num">시간당 ${won(s.hourly)} · 1일 ${won(s.daily)}</span><span class="free num ${free >= C.minHours ? '' : 'none'}">${free >= C.minHours ? `${free}시간 가능` : '예약 불가'}</span></span>
    </button>${pics.length ? `<button type="button" class="photo-toggle" data-photos="${s.id}" aria-expanded="${isOpen}">${isOpen ? '접기' : holder ? '사진' : `사진 ${pics.length}`}</button>` : ''}</div>${photoBlock}</div>`;
  }).join('');
  const all = state.spaceIds.length === C.spaces.length;
  return `<h1>사용할 공간을 선택하세요</h1>
    <p class="sub">${formatKoreanDate(state.date)} 기준입니다. 여러 공간을 함께 고를 수 있습니다.</p>
    <div class="body"><div class="options">${cards}
      <button type="button" class="opt all" data-id="__all" aria-pressed="${all}">
        <span><b>전체 통대관</b><br><span class="meta">5개 공간 전부 · 1일(${C.dayHours}시간)</span></span>
        <span class="price num">${won(C.packageDayPrice)}</span>
      </button></div></div>`;
}

function statusTable(all = false) {
  const date = state.date;
  const sel = new Set(all ? C.spaces.map((s) => s.id) : state.spaceIds);
  const picked = new Set(state.spaceIds);
  let html = `<thead><tr><th scope="col"><span class="sr-only">공간</span></th>${HOURS.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>`;
  for (const sp of C.spaces.filter((s) => sel.has(s.id))) {
    html += `<tr><th scope="row">${sp.name}</th>`;
    for (const h of HOURS) {
      const st = slotState(date, sp.id, h);
      const mine = picked.has(sp.id) && state.start != null && state.end != null && h >= state.start && h < state.end;
      const text = { confirmed: '예약', pending: '대기', blocked: '휴무', past: '마감', free: '' }[st.s];
      const title = `${sp.name} ${h}시 ${{ confirmed: '예약 완료', pending: '입금 대기', blocked: '휴무', past: '예약 마감', free: '예약 가능' }[st.s]}`;
      html += `<td class="${st.s}${mine && st.s === 'free' ? ' sel' : ''}" title="${title}">${mine && st.s === 'free' ? '선택' : text}<span class="sr-only"> ${title}</span></td>`;
    }
    html += '</tr>';
  }
  return html + '</tbody>';
}

function viewTime() {
  const ids = state.spaceIds;
  let s = '';
  for (let h = C.openHour; h <= C.closeHour - C.minHours; h++) {
    let ok = true;
    for (let k = 0; ok && k < C.minHours; k++) ok = allFree(state.date, ids, h + k);
    s += `<button type="button" class="chip" data-start="${h}" aria-pressed="${state.start === h}" ${ok ? '' : 'disabled'}>${hh(h)}</button>`;
  }
  let endBlock = '';
  if (state.start != null) {
    let e = '';
    const max = maxEndFor(state.start);
    for (let x = state.start + C.minHours; x <= max; x++) e += `<button type="button" class="chip" data-end="${x}" aria-pressed="${state.end === x}">${hh(x)}</button>`;
    endBlock = `<div><p class="time-label">몇 시에 끝나나요?</p><div class="chips">${e}</div></div>`;
  }
  const result = state.start != null && state.end != null ? `<p class="time-result num">${hh(state.start)} ~ ${hh(state.end)} (${state.end - state.start}시간)</p>` : '';
  return `<h1>이용 시간을 선택하세요</h1>
    <p class="sub">${formatKoreanDate(state.date)} · ${esc(spaceNames(ids))}. 최소 ${C.minHours}시간부터입니다. 선택한 공간이 모두 비어 있는 시간만 누를 수 있습니다.</p>
    <div class="body">
      <div><p class="time-label">몇 시에 시작하나요?</p><div class="chips">${s}</div></div>
      ${endBlock}${result}
      <details class="status"><summary>이날 예약 현황</summary>
        <div class="table-scroll"><table class="grid">${statusTable()}</table></div>
        <div class="legend" style="margin-top:10px"><span><i></i>예약 가능</span><span><i class="l-pending"></i>입금 대기</span><span><i class="l-confirmed"></i>예약 완료</span><span><i class="l-blocked"></i>휴무</span></div>
      </details>
    </div>`;
}

function viewPeople() {
  return `<h1>이용 인원을 알려 주세요</h1>
    <p class="sub">선택한 공간의 최대 인원은 ${capacity()}명입니다. 넘으면 1인당 ${won(C.overagePerPerson)}이 추가됩니다.</p>
    <div class="body">
      <div class="stepper">
        <button type="button" id="pMinus" aria-label="1명 줄이기">&minus;</button>
        <input id="f-people" type="number" inputmode="numeric" min="1" max="500" value="${state.people}" aria-label="이용 인원">
        <span class="unit">명</span>
        <button type="button" id="pPlus" aria-label="1명 늘리기">+</button>
      </div>
      <div class="field"><label for="f-purpose">이용 목적 (선택)</label>
        <input id="f-purpose" maxlength="100" placeholder="예: 독서 모임, 소규모 전시" value="${esc(state.purpose)}"></div>
    </div>`;
}

function viewPerson() {
  return `<h1>예약하시는 분의 정보를 입력하세요</h1>
    <p class="sub">입금자명과 같은 이름을 입력하세요. 연락처는 예약과 입금 확인에만 쓰입니다.</p>
    <div class="body">
      <div class="field"><label for="f-name">이름</label>
        <input id="f-name" autocomplete="name" maxlength="20" value="${esc(state.name)}"><span class="err" id="e-name"></span></div>
      <div class="field"><label for="f-phone">휴대전화</label>
        <input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(state.phone)}"><span class="err" id="e-phone"></span></div>
      <input class="hp" type="text" id="f-website" tabindex="-1" autocomplete="off" aria-hidden="true">
    </div>`;
}

function viewReview() {
  const q = currentQuote();
  const rows = `<div class="row"><span>일정</span><span>${formatKoreanDate(state.date)} ${hh(state.start)}~${hh(state.end)}</span></div>
    <div class="row"><span>공간</span><span>${esc(spaceNames(state.spaceIds))}</span></div>
    <div class="row"><span>인원</span><span>${state.people}명</span></div>
    <div class="row"><span>예약자</span><span>${esc(state.name)} ${esc(state.phone)}</span></div>`;
  let calc = '';
  if (q) {
    for (const l of q.lines) {
      let detail;
      if (l.fullDays > 0) detail = `${l.fullDays}일${l.remHours ? ` + ${l.remHours}시간` : ''}`;
      else if (l.usesDayRate) detail = '1일 요금';
      else detail = `${l.hours}시간 × ${won(l.hourly)}`;
      calc += `<div class="row"><span>${l.name} (${detail})</span><span>${won(l.cost)}</span></div>`;
    }
    if (q.packageDiscount > 0) calc += `<div class="row minus"><span>전체 통대관 할인</span><span>-${won(q.packageDiscount)}</span></div>`;
    if (q.extraPeople > 0) calc += `<div class="row"><span>인원 초과 ${q.extraPeople}명 (최대 ${q.capacity}명)</span><span>${won(q.overageFee)}</span></div>`;
  }
  const rules = `${C.holdHours}시간 안에 입금하세요. 입금이 확인되면 예약이 확정됩니다. ${state.info.contact ? `변경과 취소는 ${esc(state.info.contact)}로 문의하세요.` : '변경과 취소는 담당자에게 문의하세요.'}`;
  return `<h1>예약 내용을 확인하세요</h1>
    <p class="sub">아래 내용으로 예약하면 입금 계좌가 나옵니다.</p>
    <div class="body">
      <div class="card"><div class="sum-rows">${rows}</div></div>
      <div class="card"><div class="sum-rows">${calc}</div>
        <div class="total-row"><span class="label">입금할 금액</span><span class="price-lg num">${q ? won(q.total) : '0원'}</span></div></div>
      <label class="check"><input type="checkbox" id="f-agree" ${state.agree ? 'checked' : ''}><span>이용 안내를 확인했습니다.</span></label>
      <p class="hint">${rules}</p>
    </div>`;
}

function viewDone() {
  const r = state.done;
  const b = state.info.bank;
  const bank = b
    ? `<div class="bank"><h3>입금 계좌</h3><div class="acct num">${esc(b.name)} ${esc(b.number)}</div><p class="who">예금주 ${esc(b.holder)}</p><button type="button" class="copy" data-copy="${esc(b.number)}">계좌번호 복사</button></div>`
    : '<div class="bank"><h3>입금 계좌</h3><p class="hint">계좌 정보가 설정되지 않았습니다. 담당자에게 문의하세요.</p></div>';
  return `<h1>아래 계좌로 입금해 주세요</h1>
    <p class="sub">입금이 확인되면 예약이 확정됩니다.</p>
    <div class="body">
      <div class="amount-row"><div class="amount num">${won(r.amount)}</div><button type="button" class="copy" data-copy="${r.amount}">금액 복사</button></div>
      ${bank}
      <div class="card"><dl class="info">
        <dt>예약번호</dt><dd>${esc(r.id)}</dd>
        <dt>일정</dt><dd>${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)}</dd>
        <dt>공간</dt><dd>${esc(spaceNames(r.spaces))}</dd>
        <dt>입금자명</dt><dd>${esc(r.name)}</dd>
        <dt>입금 기한</dt><dd>${formatKstDateTime(r.holdUntil)}</dd>
      </dl></div>
      <ol class="todo"><li>입금자명을 "${esc(r.name)}"으로 입금합니다.</li><li>${formatKstDateTime(r.holdUntil)}까지 입금이 확인되지 않으면 예약이 취소됩니다.</li><li>예약번호 ${esc(r.id)}는 예약 조회와 취소에 필요합니다. 화면을 캡처해 두세요.</li></ol>
    </div>`;
}

function viewLookup() {
  const k = state.lk;
  const r = k.rec;
  let result = '';
  if (r) {
    const bank = state.info.bank;
    let note = '';
    if (r.status === 'pending') note = `<p class="notice-line">${formatKstDateTime(r.holdUntil)}까지 입금해 주세요.</p>${bank ? `<div class="bank"><h3>입금 계좌</h3><div class="acct num">${esc(bank.name)} ${esc(bank.number)}</div><p class="who">예금주 ${esc(bank.holder)} · 입금자명 ${esc(r.name)}</p><button type="button" class="copy" data-copy="${esc(bank.number)}">계좌번호 복사</button></div>` : ''}`;
    else if (r.status === 'confirmed' && r.cancelRequested) note = '<p class="notice-line">취소 요청이 접수되었습니다. 담당자가 확인한 뒤 환불 방법을 안내합니다.</p>';
    else if (r.status === 'expired') note = '<p class="notice-line">입금 기한이 지났습니다. 다시 예약하거나 담당자에게 문의하세요.</p>';
    const canCancel = r.status === 'pending' || (r.status === 'confirmed' && !r.cancelRequested);
    const cancelLabel = r.status === 'pending' ? '예약 취소' : '취소 요청';
    const cancelBox = k.cancelOpen
      ? `<div class="field"><label for="f-reason">취소 사유 (선택)</label><input id="f-reason" maxlength="100" value="${esc(k.reason)}"></div>
         <p class="hint">${r.status === 'pending' ? '입금 전 예약은 바로 취소되고 시간이 다시 열립니다.' : '입금이 확인된 예약은 담당자가 확인한 뒤 취소하고 환불합니다.'}</p>
         <div class="btnrow"><button type="button" class="btn danger" id="lkDoCancel" ${k.busy ? 'disabled' : ''}>${cancelLabel}하기</button><button type="button" class="btn ghost" id="lkCancelClose">돌아가기</button></div>`
      : canCancel ? `<button type="button" class="btn ghost" id="lkCancelOpen">${cancelLabel}</button>` : '';
    result = `<div class="card"><p class="status-pill ${r.status}">${STATUS_TEXT[r.status]}</p>
      <dl class="info"><dt>예약번호</dt><dd>${esc(r.id)}</dd><dt>일정</dt><dd>${formatKoreanDate(r.date)} ${hh(r.start)}~${hh(r.end)}</dd><dt>공간</dt><dd>${esc(spaceNames(r.spaces))}</dd><dt>인원</dt><dd>${r.people}명</dd><dt>금액</dt><dd>${won(r.amount)}</dd></dl>
      ${note}${k.msg ? `<p class="notice-line ok">${esc(k.msg)}</p>` : ''}${cancelBox}</div>`;
  }
  return `<h1>내 예약을 확인하세요</h1>
    <p class="sub">예약할 때 받은 예약번호와 휴대전화 번호를 입력하세요. 회원가입은 필요 없습니다.</p>
    <div class="body">
      <div class="field"><label for="f-lkid">예약번호</label><input id="f-lkid" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="예: AB12CD34" value="${esc(k.id)}"></div>
      <div class="field"><label for="f-lkphone">휴대전화</label><input id="f-lkphone" type="tel" inputmode="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(k.phone)}"></div>
      ${k.err ? `<p class="err">${esc(k.err)}</p>` : ''}
      ${result}
    </div>`;
}

async function doLookup() {
  const k = state.lk;
  k.busy = true; k.err = ''; k.msg = ''; chrome();
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
    k.msg = j.mode === 'canceled' ? '예약을 취소했습니다. 해당 시간이 다시 열렸습니다.' : '취소 요청을 접수했습니다. 담당자가 확인한 뒤 환불 방법을 안내합니다.';
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
const lb = { list: [], i: 0, name: '' };
function openLightbox(spaceId, i) {
  lb.list = state.photos[spaceId] || [];
  lb.i = i;
  lb.name = C.spaces.find((s) => s.id === spaceId)?.name || '';
  let d = $('#lightbox');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'lightbox';
    d.setAttribute('aria-label', '사진 보기');
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb=close]') || e.target === d) d.close();
      else if (e.target.closest('[data-lb=prev]')) { lb.i = (lb.i + lb.list.length - 1) % lb.list.length; paintLb(); }
      else if (e.target.closest('[data-lb=next]')) { lb.i = (lb.i + 1) % lb.list.length; paintLb(); }
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { lb.i = (lb.i + lb.list.length - 1) % lb.list.length; paintLb(); }
      if (e.key === 'ArrowRight') { lb.i = (lb.i + 1) % lb.list.length; paintLb(); }
    });
    document.body.append(d);
  }
  paintLb();
  if (!d.open) d.showModal();
}
function paintLb() {
  const many = lb.list.length > 1;
  $('#lightbox').innerHTML = `<div class="lb"><button type="button" class="lb-x" data-lb="close" aria-label="닫기">&times;</button>
    <img src="${esc(lb.list[lb.i])}" alt="${esc(lb.name)} 사진 ${lb.i + 1}">
    ${many ? `<button type="button" class="lb-n prev" data-lb="prev" aria-label="이전 사진">&lsaquo;</button><button type="button" class="lb-n next" data-lb="next" aria-label="다음 사진">&rsaquo;</button>` : ''}
    <p class="lb-c num">${esc(lb.name)} ${lb.i + 1} / ${lb.list.length}</p></div>`;
}

/* ---------- 렌더 ---------- */
function render(keepScroll = false) {
  normalizeTime();
  const views = { 1: viewDate, 2: viewSpace, 3: viewTime, 4: viewPeople, 5: viewPerson, 6: viewReview, 7: viewDone, 8: viewLookup };
  const y = $('#main').scrollTop;
  $('#main').innerHTML = `<section class="step" ${keepScroll ? 'style="animation:none"' : ''}>${views[state.step]()}</section>`;
  if (keepScroll) $('#main').scrollTop = y;
  else { const h = $('#main h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  chrome();
}

function chrome() {
  const st = state.step;
  $('#back').hidden = st === 1 || st === 7;
  $('#myres').hidden = st === 8;
  $('#progBar').style.width = `${Math.min(st, STEPS) / STEPS * 100}%`;
  $('#prog').setAttribute('aria-valuenow', String(Math.min(st, STEPS)));
  $('#prog').hidden = st >= 7;

  const q = currentQuote();
  const peek = $('#peek');
  if (st >= 3 && st <= 6) {
    const bits = [formatKoreanDate(state.date), spaceNames(state.spaceIds)].join(' · ');
    peek.innerHTML = `<span>${esc(bits)}</span>${q ? `<b>예상 ${won(q.total)}</b>` : ''}`;
    peek.hidden = false;
  } else peek.hidden = true;

  const btn = $('#next');
  const problem = state.submitting ? '' : stepProblem(st);
  btn.textContent = st === 6 ? (state.submitting ? '예약하는 중' : '예약하기') : st === 7 ? '처음으로' : st === 8 ? (state.lk.rec ? '처음으로' : state.lk.busy ? '조회하는 중' : '조회하기') : '다음';
  btn.disabled = st === 7 || (st === 8 && state.lk.rec) ? false : Boolean(problem) || state.submitting || state.lk.busy;
  $('#ctaHint').textContent = state.error || (st === 7 || (st === 8 && state.lk.rec) ? '' : problem);
  $('#ctaHint').style.color = state.error ? 'var(--danger)' : '';

  renderSide();
  renderLast();
}

function renderSide() {
  const q = currentQuote();
  const dash = '<span class="placeholder">선택 전</span>';
  const t = state.start != null && state.end != null ? `${hh(state.start)}~${hh(state.end)} (${state.end - state.start}시간)` : dash;
  let calc = '';
  if (q) {
    for (const l of q.lines) calc += `<div class="row"><span>${l.name}</span><span>${won(l.cost)}</span></div>`;
    if (q.packageDiscount > 0) calc += `<div class="row minus"><span>전체 통대관 할인</span><span>-${won(q.packageDiscount)}</span></div>`;
    if (q.extraPeople > 0) calc += `<div class="row"><span>인원 초과 ${q.extraPeople}명</span><span>${won(q.overageFee)}</span></div>`;
  }
  const b = state.info.bank;
  const day = state.date
    ? `<div class="card"><h2>${formatKoreanDate(state.date)} 공간별 현황</h2><div class="table-scroll" style="margin-top:10px"><table class="grid">${statusTable(true)}</table></div>
       <div class="legend" style="margin-top:10px"><span><i></i>예약 가능</span><span><i class="l-pending"></i>입금 대기</span><span><i class="l-confirmed"></i>예약 완료</span><span><i class="l-blocked"></i>휴무</span></div></div>`
    : '<div class="card"><h2>공간별 현황</h2><p class="placeholder" style="margin-top:8px">날짜를 선택하면 5개 공간의 시간별 예약 현황이 여기에 보입니다.</p></div>';
  $('#side').innerHTML = `
    <div class="card"><h2>내 예약</h2>
      <div class="sum-rows" style="margin-top:12px">
        <div class="row"><span>날짜</span><span>${state.date ? formatKoreanDate(state.date) : dash}</span></div>
        <div class="row"><span>공간</span><span>${state.spaceIds.length ? esc(spaceNames(state.spaceIds)) : dash}</span></div>
        <div class="row"><span>시간</span><span>${t}</span></div>
        <div class="row"><span>인원</span><span>${state.step >= 4 ? `${state.people}명` : dash}</span></div>
        ${calc}
      </div>
      <div class="total-row"><span class="label">예상 요금</span><span class="price-lg num">${q ? won(q.total) : '0원'}</span></div>
    </div>
    ${day}
    <div class="card pay-card"><h2>입금 안내</h2>
      <p style="margin-top:8px">예약 후 ${C.holdHours}시간 안에 입금하세요.</p>
      ${b ? `<p class="num" style="font-weight:800;margin-top:6px">${esc(b.name)} ${esc(b.number)}</p><p class="hint">예금주 ${esc(b.holder)}</p>` : '<p class="hint">계좌 정보는 예약을 마치면 안내됩니다.</p>'}
    </div>`;
}

function go(step, push = true) {
  state.step = step;
  state.error = '';
  if (push) history.pushState({ step }, '');
  render();
  $('#main').scrollTo(0, 0);
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
    if (day.classList.contains('blocked')) return;
    if (state.date !== day.dataset.date) state.start = state.end = null;
    state.date = day.dataset.date;
    return render(true);
  }
  if (t.closest('#prevM') || t.closest('#nextM')) {
    let { y, m } = state.month;
    m += t.closest('#nextM') ? 1 : -1;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    state.month = { y, m };
    return render(true);
  }
  const opt = t.closest('.opt');
  if (opt) {
    const id = opt.dataset.id;
    if (id === '__all') state.spaceIds = state.spaceIds.length === C.spaces.length ? [] : C.spaces.map((s) => s.id);
    else {
      const on = !state.spaceIds.includes(id);
      state.spaceIds = on ? [...state.spaceIds, id] : state.spaceIds.filter((x) => x !== id);
      // 카드를 누르면 사진이 펼쳐지고, 선택을 풀면 접힙니다.
      if (on && ((state.photos[id] || []).length || C.photoPlaceholders)) state.openPhotos.add(id); else state.openPhotos.delete(id);
    }
    return render(true);
  }
  const s = t.closest('[data-start]');
  if (s && !s.disabled) { state.start = Number(s.dataset.start); state.end = null; return render(true); }
  const en = t.closest('[data-end]');
  if (en) { state.end = Number(en.dataset.end); return render(true); }
  if (t.closest('#pMinus')) return setPeople(state.people - 1);
  if (t.closest('#pPlus')) return setPeople(state.people + 1);
  const pt = t.closest('[data-photos]');
  if (pt) { const id = pt.dataset.photos; if (state.openPhotos.has(id)) state.openPhotos.delete(id); else state.openPhotos.add(id); return render(true); }
  const z = t.closest('[data-zoom]');
  if (z) return openLightbox(z.dataset.zoom, Number(z.dataset.i));
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
  chrome();
}

$('#main').addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'f-people') { state.people = Math.max(0, Math.min(500, Number(e.target.value) || 0)); chrome(); }
  else if (id === 'f-purpose') state.purpose = e.target.value;
  else if (id === 'f-name') { state.name = e.target.value; chrome(); }
  else if (id === 'f-phone') { e.target.value = state.phone = formatPhone(e.target.value); chrome(); }
  else if (id === 'f-website') state.website = e.target.value;
  else if (id === 'f-lkid') { state.lk.id = e.target.value.toUpperCase(); e.target.value = state.lk.id; state.lk.rec = null; chrome(); }
  else if (id === 'f-lkphone') { e.target.value = state.lk.phone = formatPhone(e.target.value); state.lk.rec = null; chrome(); }
  else if (id === 'f-reason') state.lk.reason = e.target.value;
});
$('#main').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.step === 8 && !state.lk.rec && !stepProblem(8)) { e.preventDefault(); doLookup(); }
  else if (e.key === 'Enter' && (state.step === 4 || state.step === 5) && e.target.tagName === 'INPUT' && !stepProblem(state.step)) { e.preventDefault(); go(state.step + 1); }
});
$('#main').addEventListener('change', (e) => {
  if (e.target.id === 'f-agree') { state.agree = e.target.checked; chrome(); }
});
$('#main').addEventListener('focusout', (e) => {
  if (e.target.id === 'f-name') $('#e-name').textContent = state.name && state.name.trim().length < 2 ? '이름은 2자 이상 입력하세요.' : '';
  if (e.target.id === 'f-phone') $('#e-phone').textContent = state.phone && !phoneOk(state.phone) ? '휴대전화 번호 형식이 맞지 않습니다.' : '';
});

async function copyText(btn) {
  try { await navigator.clipboard.writeText(btn.dataset.copy); } catch {
    const t = document.createElement('textarea'); t.value = btn.dataset.copy; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  const old = btn.textContent;
  btn.textContent = '복사했습니다';
  btn.classList.add('done');
  setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1800);
}

$('#next').addEventListener('click', () => {
  const st = state.step;
  if (st === 7) return reset();
  if (st === 8) return state.lk.rec ? reset() : doLookup();
  if (stepProblem(st)) return;
  if (st === 6) return submit();
  go(st + 1);
});
$('#back').addEventListener('click', () => history.back());
window.addEventListener('popstate', (e) => {
  const step = e.state?.step || 1;
  state.step = step === 8 ? 8 : state.done && step === 7 ? 7 : Math.min(step, 6);
  state.error = '';
  render();
  $('#main').scrollTo(0, 0);
});
$('#retryBtn').addEventListener('click', loadAvailability);
$('#myres').addEventListener('click', () => go(8));
$('#whereBtn').addEventListener('click', openWhere);
$('#whereDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
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
      render();
      state.error = `${err.message} 시간을 다시 선택하세요.`;
      chrome();
      return;
    }
    state.error = err.message;
    chrome();
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

function buildWhere() {
  const choices = mapChoices();
  const first = choices[0];
  const panes = choices.map((m) => m === 'google'
    ? `<iframe class="map-pane" data-map="google" title="센터 위치 지도(구글)" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${mapQuery()}&hl=ko&z=17&output=embed" ${m === first ? '' : 'hidden'}></iframe>`
    : `<div class="map-pane" data-map="${m}" role="img" aria-label="${MAP_LABEL[m]} 지도" ${m === first ? '' : 'hidden'}></div>`).join('');
  $('#where').innerHTML = `<div class="card where-card">
    <div class="dlg-head"><h2>오시는 길</h2><button type="button" class="dlg-x" data-close aria-label="닫기">&times;</button></div>
    <p class="addr">${esc(C.address)}</p>
    <p class="hint">${esc(C.access)}</p>
    ${choices.length > 1 ? `<div class="map-tabs" role="tablist" aria-label="지도 선택">${choices.map((m) => `<button type="button" role="tab" data-maptab="${m}" aria-selected="${m === first}">${MAP_LABEL[m]} 지도</button>`).join('')}</div>` : ''}
    ${panes}
    <div class="where-actions">
      <a class="btn small" href="${naverUrl()}" target="_blank" rel="noopener">네이버 지도에서 열기</a>
      <a class="btn small ghost" href="https://map.kakao.com/?q=${mapQuery()}" target="_blank" rel="noopener">카카오맵에서 열기</a>
      <button type="button" class="copy" data-copy="${esc(C.address)}">주소 복사</button>
    </div>
    <p class="hint">길찾기, 대중교통, 주차 정보는 네이버 지도나 카카오맵에서 확인할 수 있습니다.</p>
    ${state.info.contact ? `<p class="hint">문의 ${esc(state.info.contact)}</p>` : ''}
  </div>`;
  mapCur = first;
}
let mapCur = 'google';

function openWhere() {
  const d = $('#whereDlg');
  if (!d.open) d.showModal();
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
  if (el) el.replaceWith(Object.assign(document.createElement('p'), { className: 'hint', textContent: `${MAP_LABEL[m]} 지도를 불러오지 못했습니다. 아래 버튼으로 지도 앱을 여세요.` }));
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
  if (e.target.closest('[data-close]')) return $('#whereDlg').close();
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
