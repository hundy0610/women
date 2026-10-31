// 소모임 신청 화면(마두 소모임, 한빛커뮤니티 공용). 포털 설정(cfg)만 바꿔서 같은 화면을 씁니다.
import { WEEKDAY, findProgram as findProgramIn, findSlot as findSlotIn, slotId } from '/shared/crew-config.mjs';
import { periodEnd, sessionsBetween, firstOnOrAfter } from '/shared/crew-rules.mjs';
import { ic } from '/icons.js';
import { openPhotos } from '/lightbox.js';
import { watchOverlay, openOverlay, closeOverlay, overlayPop } from '/overlay.js';
import { todayKst, parseYmd, addDays, ymd, formatKoreanDate, formatKstDateTime, DOW_LABELS } from '/shared/time.mjs';

export function startClub(CREW) {
  const $ = (s) => document.querySelector(s);
  const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STEPS = 4; // 1 소모임, 2 일정, 3 정보, 4 확인. 5는 입금 안내, 6은 내 신청 조회.
  const NAMES = ['소모임', '일정', '정보', '확인'];
  const SHORT = (d) => { const p = parseYmd(d); return `${p.m}/${p.d}`; };
  const LONG = (d) => { const p = parseYmd(d); return `${p.m}월 ${p.d}일`; };

  const emptyLk = () => ({ id: '', phone: '', rec: null, err: '', msg: '', busy: false, cancelOpen: false, reason: '' });
  const state = {
    info: { used: {}, photos: {}, bank: null, contact: null },
    storeReady: true,
    step: 1,
    programId: null,
    slot: null,
    start: null,
    month: null,
    name: '', phone: '', gender: '', age: '', dong: '',
    agree: false, website: '', submitting: false, error: '', done: null,
    lk: emptyLk(),
  };

  async function api(action, payload = {}) {
    const res = await fetch(CREW.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
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

  async function loadInfo() {
    try {
      const j = await api('info');
      state.info = { used: j.used || {}, photos: j.photos || {}, bank: j.bank, contact: j.contact };
      state.storeReady = true;
      $('#netNotice').hidden = true;
    } catch (e) {
      if (e.code === 'STORE_NOT_CONFIGURED') state.storeReady = false;
      else $('#netNotice').hidden = false;
    }
    $('#storeNotice').hidden = state.storeReady;
  }

  /* ---------- 계산 ---------- */
  const findProgram = (id) => findProgramIn(id, CREW);
  const findSlot = (id) => findSlotIn(id, CREW);
  const program = () => findProgram(state.programId);
  // 요일(월요일부터), 시간 순으로 정렬한 시간대
  const sortedSlots = (p) => [...p.slots].sort((x, y) => (((x.weekday + 6) % 7) - ((y.weekday + 6) % 7)) || x.time.localeCompare(y.time));
  const slotObj = () => (state.slot ? findSlot(state.slot) : null);
  const slotLabel = (s) => `매주 ${WEEKDAY[s.weekday]}요일 ${s.time}`;
  const phoneDigits = (s) => s.replace(/\D/g, '');
  const phoneOk = (s) => /^01[016789]\d{7,8}$/.test(phoneDigits(s));
  function formatPhone(s) {
    const d = phoneDigits(s).slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // 시작일을 골랐을 때 기간 안 수업 날짜 중 가장 붐비는 날 기준으로 남는 자리
  function seatsLeft(slot, start) {
    const dates = sessionsBetween(start, periodEnd(start, CREW.periodMonths), slot.weekday);
    const peak = Math.max(0, ...dates.map((d) => state.info.used[`${slot.id}|${d}`] || 0));
    return Math.max(0, slot.capacity - peak);
  }
  // 다음 수업일 기준으로 이 요일·시간 칸에 남은 자리(신청해서 입금 대기 중인 사람도 자리를 차지합니다)
  function nextLeft(slot) {
    const date = firstOnOrAfter(addDays(todayKst(Date.now()), CREW.leadDays), slot.weekday);
    const used = state.info.used[`${slot.id}|${date}`] || 0;
    return { date, used, left: Math.max(0, slot.capacity - used), cap: slot.capacity };
  }
  const period_ = (start) => ({ end: periodEnd(start, CREW.periodMonths), count: sessionsBetween(start, periodEnd(start, CREW.periodMonths), slotObj().weekday).length });

  function stepProblem(step) {
    if (!state.storeReady) return '지금은 신청할 수 없습니다.';
    switch (step) {
      case 1: return state.programId ? '' : '참여하실 소모임을 골라 주세요.';
      case 2: return !state.start ? '시작하실 날짜를 골라 주세요.' : seatsLeft(slotObj(), state.start) <= 0 ? '이 날은 자리가 모두 찼어요. 다른 날을 골라 주세요.' : '';
      case 3:
        if (state.name.trim().length < 2) return '이름을 알려 주세요.';
        if (!phoneOk(state.phone)) return '연락받을 휴대전화 번호를 알려 주세요.';
        if (!state.gender) return '성별을 골라 주세요.';
        if (state.age !== '' && !(Number(state.age) >= 10 && Number(state.age) <= 120)) return '나이는 숫자로 적어 주세요. 비워 두셔도 돼요.';
        return state.dong.trim().length >= 2 ? '' : '사시는 지역(동)을 알려 주세요.';
      case 4: return state.agree ? '' : '안내 내용에 동의해 주세요.';
      case 6: return state.lk.rec ? '' : state.lk.id.trim().length < 6 ? '신청번호를 입력해 주세요.' : !phoneOk(state.lk.phone) ? '휴대전화 번호를 입력해 주세요.' : '';
      default: return '';
    }
  }

  /* ---------- 작은 조각 ---------- */
  const badge = (kind, text, ico) => `<span class="badge b-${kind}">${ico ? ic(ico, 16) : ''}${text}</span>`;
  const alertBox = (kind, ico, text, btn = '') => `<div class="alert a-${kind}">${ic(ico, 24)}<span>${text}</span>${btn}</div>`;
  const policyList = () => `<ul class="policy">${CREW.policy.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

  /* ---------- 1. 소모임 고르기 ---------- */
  const coverIdx = {};
  // 시간대가 많은 소모임은 카드에 "월~토 · 시간대 13개"만 보이고, 자세한 시간표와 정원은 창에서 봅니다.
  const dayOrder = (d) => (d + 6) % 7;
  function daySummary(p) {
    const days = [...new Set(p.slots.map((sl) => sl.weekday))].sort((a, b) => dayOrder(a) - dayOrder(b));
    const run = days.length > 2 && days.every((d, k) => k === 0 || dayOrder(d) === dayOrder(days[k - 1]) + 1);
    return run ? `${WEEKDAY[days[0]]}~${WEEKDAY[days[days.length - 1]]}` : days.map((d) => WEEKDAY[d]).join('·');
  }
  function tableHtml(p) {
    const byDay = new Map();
    for (const sl of sortedSlots(p)) { if (!byDay.has(sl.weekday)) byDay.set(sl.weekday, []); byDay.get(sl.weekday).push(sl); }
    const rows = [...byDay.entries()].sort((a, b) => dayOrder(a[0]) - dayOrder(b[0])).map(([d, list]) => `<div class="ttrow"><b class="ttday">${WEEKDAY[d]}요일</b><span class="ttslots">${list.map((sl) => {
      const n = nextLeft(findSlot(slotId(p.id, sl)));
      return `<button type="button" class="tt ${n.left ? '' : 'full'}" data-pick="${slotId(p.id, sl)}" ${n.left ? '' : 'disabled'}><span class="num">${esc(sl.time)}</span><i>${n.left ? `${n.used}/${n.cap}` : '마감'}</i></button>`;
    }).join('')}</span></div>`).join('');
    return `<div class="dlg-h"><h2 id="tableT">${esc(p.name)} 시간표</h2><button type="button" class="xbtn" data-close aria-label="닫기">${ic('x', 24)}</button></div>
      <p class="muted sm">시간을 누르면 그 시간으로 신청해요. 오른쪽 숫자는 지금까지 신청 인원 / 정원이에요.</p>
      <div class="tt-list">${rows}</div>`;
  }
  function openTable(pid) {
    const p = findProgram(pid);
    if (!p) return;
    let d = document.getElementById('tableDlg');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'tableDlg'; d.className = 'sheet'; d.setAttribute('aria-labelledby', 'tableT');
      d.innerHTML = '<div class="scrim"><div class="dlg" id="tableBox"></div></div>';
      document.body.appendChild(d);
      watchOverlay(d);
      d.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target.classList.contains('scrim')) return closeOverlay(d);
        const pick = e.target.closest('[data-pick]');
        if (!pick) return;
        const sid = pick.dataset.pick;
        // 창을 닫느라 기록을 한 칸 되돌리므로, 그게 끝난 뒤에 다음 화면으로 넘어갑니다.
        let went = false;
        const proceed = () => {
          if (went) return;
          went = true;
          window.removeEventListener('popstate', proceed);
          setProgram(findSlot(sid).programId);
          state.slot = sid; state.start = null;
          ensureMonth();
          go(2);
        };
        window.addEventListener('popstate', proceed);
        setTimeout(proceed, 400);
        closeOverlay(d);
      });
    }
    d.querySelector('#tableBox').innerHTML = tableHtml(p);
    openOverlay(d);
  }
  function programCard(p) {
    const on = state.programId === p.id;
    const real = state.info.photos[p.id] || [];
    const flex = Boolean(p.flexible) || !p.slots.length;
    const strip = real.length
      ? real.map((src, i) => `<img class="ph" src="${esc(src)}" alt="${esc(p.name)} 사진 ${i + 1}, 누르면 크게 보기" ${i ? 'loading="lazy"' : ''} draggable="false" data-zoom="${p.id}" data-i="${i}">`).join('')
      : `<div class="ph" role="img" aria-label="${esc(p.name)} 사진 준비 중">${ic('cam', 30)}</div>`;
    let lines;
    if (flex) {
      lines = `<span class="slotline">${ic('info', 16)}<span>일정은 문의 후 정해요</span></span>${state.info.contact ? `<span class="slotline">${ic('phone', 16)}<span>${esc(state.info.contact)}</span></span>` : ''}`;
    } else if (p.slots.length > 3) {
      lines = `<span class="slotline">${ic('clock', 16)}<span>${daySummary(p)} · 시간대 ${p.slots.length}개</span></span><span class="slotline muted">시간마다 정원 ${p.capacity ?? CREW.capacity}명</span>`;
    } else {
      lines = p.slots.map((sl) => {
        const n = nextLeft(findSlot(slotId(p.id, sl)));
        return `<span class="slotline">${ic('clock', 16)}<span>${WEEKDAY[sl.weekday]} ${esc(sl.time)}</span><b class="${n.left ? '' : 'full'}">${n.left ? `정원 : ${n.used}/${n.cap}` : `정원 : ${n.used}/${n.cap} 마감`}</b></span>`;
      }).join('');
    }
    const nav = real.length > 1 ? `<button type="button" class="pn pn-prev" data-pn="-1" data-for="${p.id}" aria-label="이전 사진">${ic('left', 18)}</button><button type="button" class="pn pn-next" data-pn="1" data-for="${p.id}" aria-label="다음 사진">${ic('right', 18)}</button><span class="cnt num" data-count="${p.id}">${(coverIdx[p.id] || 0) + 1}/${real.length}</span>` : '';
    return `<div class="sp ${on ? 'on' : ''} ${flex ? 'flex' : ''}">
      <div class="stripw"><div class="strip" data-track="${p.id}" role="group" aria-label="${esc(p.name)} 사진, 옆으로 밀어서 넘기기">${strip}</div>${nav}<span class="chk" aria-hidden="true">${on ? ic('check', 18) : ''}</span></div>
      <button type="button" class="spb" data-program="${p.id}" aria-pressed="${on}" ${flex ? 'disabled' : ''}>
        <span class="spt"><h3>${esc(p.name)}</h3>${flex ? badge('off', '문의', 'phone') : ''}</span>
        <span class="slots">${lines}${flex ? '' : `<span class="ttbtn" role="button" tabindex="0" data-table="${p.id}">${ic('cal', 16)}시간표·정원 보기</span>`}</span>
        ${flex ? '' : `<span class="num sp-price"><b>한 달 ${won(CREW.fee)}</b></span>`}
      </button></div>`;
  }

  function viewProgram() {
    const many = CREW.programs.length > 8;
    const q = (state.q || '').trim();
    const list = q ? CREW.programs.filter((p) => p.name.includes(q)) : CREW.programs;
    const search = CREW.searchable ? `<div class="field search clubsearch"><input class="input" id="f-search" type="search" placeholder="소모임 이름으로 찾기 (예: 매듭, 뜨개)" value="${esc(state.q || '')}" aria-label="소모임 검색"><span class="si" aria-hidden="true">${ic('search', 24)}</span></div>` : '';
    return `<h1>어떤 소모임에 참여하실래요?</h1>
      <p class="lead">한 달 ${won(CREW.fee)}이고 신청한 날부터 한 달 이용해요.</p>
      ${CREW.address ? `<p class="placeline">${ic('pin', 20)}<span>${esc(CREW.address)}</span></p>` : ''}
      ${search}
      <div class="sps ${many ? 'many' : ''}">${list.length ? list.map(programCard).join('') : '<div class="state"><h2>찾는 소모임이 없어요</h2></div>'}</div>`;
  }

  /* ---------- 2. 요일·시간과 시작일 ---------- */
  function viewSchedule() {
    const p = program();
    const sl = slotObj();
    const today = todayKst(Date.now());
    const minD = addDays(today, CREW.leadDays);
    const maxD = addDays(today, CREW.horizonDays);
    const { y, m } = state.month;
    const first = parseYmd(ymd(y, m, 1));
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const tp = parseYmd(today);
    const lastP = parseYmd(maxD);
    const inRange = state.start ? new Set(sessionsBetween(state.start, periodEnd(state.start, CREW.periodMonths), sl.weekday)) : new Set();

    let cells = DOW_LABELS.map((d) => `<div class="dw">${d}</div>`).join('');
    for (let i = 0; i < first.dow; i++) cells += '<span></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = ymd(y, m, d);
      const dow = parseYmd(date).dow;
      const ok = dow === sl.weekday && date >= minD && date <= maxD;
      const left = ok ? seatsLeft(sl, date) : 0;
      const full = ok && left <= 0;
      const k = [!ok ? 'past' : '', full ? 'full' : '', date === today ? 'today' : '', date === state.start ? 'sel' : '', inRange.has(date) && date !== state.start ? 'inr' : ''].filter(Boolean).join(' ');
      const label = ok ? (full ? '마감' : `${sl.capacity - left}/${sl.capacity}`) : date === today ? '오늘' : '';
      cells += `<button type="button" class="day ${k}" data-day="${date}" ${!ok || full ? 'disabled' : ''} aria-pressed="${date === state.start}" aria-label="${formatKoreanDate(date)}${ok ? (full ? ' 정원 마감' : ` 정원 ${sl.capacity - left}/${sl.capacity}`) : ''}">${d}${label ? `<small>${label}</small>` : ''}</button>`;
    }
    const slotChips = p.slots.length > 1
      ? `<div class="chips c2chips ${p.slots.length > 6 ? 'many' : ''}" role="group" aria-label="요일과 시간">${sortedSlots(p).map((s) => { const id = slotId(p.id, s); return `<button type="button" class="chip ${state.slot === id ? 'on' : ''}" data-slot="${id}" aria-pressed="${state.slot === id}">${WEEKDAY[s.weekday]}요일 ${s.time} · 정원 ${nextLeft(findSlot(id)).used}/${nextLeft(findSlot(id)).cap}</button>`; }).join('')}</div>`
      : '';
    let sessions = '';
    if (state.start) sessions = `<div class="c2dates"><p class="lab">수업 날짜</p><div class="chips">${[...inRange].map((d) => `<span class="chip dt">${esc(SHORT(d))}</span>`).join('')}</div></div>`;
    let sum = `<p class="muted row-f c2hint">${ic('info', 20)}달력에서 첫 수업 날짜를 눌러 주세요. 그날부터 한 달간 이용해요.</p>`;
    if (state.start) {
      const pr = period_(state.start);
      sum = `<div class="card soft slim"><p class="b">${esc(LONG(state.start))}부터 ${esc(LONG(pr.end))}까지 · 수업 ${pr.count}번</p><p class="sm">${slotLabel(sl)} · 정원 : ${sl.capacity - seatsLeft(sl, state.start)}/${sl.capacity}</p></div>`;
    }
    return `<h1>${esc(p.name)}, 언제부터 하실래요?</h1>
      <p class="lead">${slotLabel(sl)} 수업이에요. 시작하실 날짜를 골라 주세요.</p>
      <div class="stack">
        ${slotChips}
        <div class="card c2cal">
          <div class="calhd">
            <button type="button" class="circ" id="prevM" aria-label="이전 달" ${y === tp.y && m === tp.m ? 'disabled style="opacity:.45"' : ''}>${ic('left')}</button>
            <h2 class="num">${y}년 ${m}월</h2>
            <button type="button" class="circ" id="nextM" aria-label="다음 달" ${y === lastP.y && m === lastP.m ? 'disabled style="opacity:.45"' : ''}>${ic('right')}</button>
          </div>
          <div class="cal">${cells}</div>
        </div>
        <div class="c2sum stack">${state.error ? alertBox('err', 'alert', esc(state.error)) : ''}${sum}${sessions}</div>
      </div>`;
  }

  /* ---------- 3. 신청자 정보 ---------- */
  function viewPerson() {
    const p = program();
    const cap = p.capacity ?? CREW.capacity;
    const g = (v, t) => `<button type="button" class="chip ${state.gender === v ? 'on' : ''}" data-gender="${v}" aria-pressed="${state.gender === v}">${t}</button>`;
    return `<h1>신청하시는 분을 알려 주세요</h1>
      <p class="lead">입금하실 분 이름과 같게 적어 주세요. 연락처는 안내와 확인에만 써요. 한 시간대에 최대 ${cap}명까지 받아요.</p>
      <div class="c3grid">
      <div class="card stack c3form">
        <div class="field"><label for="f-name">이름 <span class="req">필수</span></label>
          <input id="f-name" class="input" autocomplete="name" maxlength="20" placeholder="예: 김미영" value="${esc(state.name)}"></div>
        <div class="field"><label for="f-phone">연락처 <span class="req">필수</span></label>
          <input id="f-phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(state.phone)}"></div>
        <div class="field"><p class="lab">성별 <span class="req">필수</span></p><div class="chips" role="group" aria-label="성별">${g('f', '여성')}${g('m', '남성')}</div></div>
        <div class="field"><label for="f-age">나이 <span class="opt">선택</span></label>
          <input id="f-age" class="input" type="number" inputmode="numeric" min="10" max="120" placeholder="예: 55" value="${esc(state.age)}"></div>
        <div class="field"><label for="f-dong">지역(동) <span class="req">필수</span></label>
          <input id="f-dong" class="input" maxlength="20" placeholder="예: 마두동" value="${esc(state.dong)}"></div>
        <input class="hp" type="text" id="f-website" tabindex="-1" autocomplete="off" aria-hidden="true">
      </div>
      </div>`;
  }

  /* ---------- 4. 확인과 동의 ---------- */
  function viewReview() {
    const p = program();
    const sl = slotObj();
    const pr = period_(state.start);
    const on = state.agree;
    return `<h1>마지막으로 확인해 주세요</h1>
      <p class="lead">내용을 확인하고 안내에 동의해 주세요.</p>
      <div class="stack c4grid">
        <div class="card c4kv"><dl class="kv"><dt>소모임</dt><dd>${esc(p.name)}</dd>${CREW.address ? `<dt>장소</dt><dd>${esc(CREW.address)}</dd>` : ''}<dt>수강일</dt><dd>${slotLabel(sl)}</dd><dt>신청 기간</dt><dd>${esc(LONG(state.start))} ~ ${esc(LONG(pr.end))} (${pr.count}회)</dd><dt>신청자</dt><dd>${esc(state.name)} · ${esc(state.phone)}</dd><dt>비용</dt><dd><b>${won(CREW.fee)}</b> (한 달)</dd></dl></div>
        <div class="card policy-card c4policy"><p class="b row-f">${ic('info', 20)}꼭 읽어 주세요</p>${policyList()}</div>
   <label class="check c4agree ${on ? 'on' : ''}"><input type="checkbox" id="f-agree" class="sr-only" ${on ? 'checked' : ''}><span class="box ${on ? 'on' : ''}">${on ? ic('check', 20) : ''}</span><span>위 안내를 모두 읽었고 동의해요. 신청 당일 노쇼하면 환불되지 않는다는 것도 확인했어요.</span></label>
        ${state.error ? alertBox('err', 'alert', esc(state.error)) : ''}
      </div>`;
  }

  /* ---------- 5. 입금 안내 ---------- */
  const acctCard = (b) => b
    ? `<div class="acct"><div class="row-f sp-b"><span class="b muted">입금 계좌</span><span class="sm">${esc(b.name)} · 예금주 ${esc(b.holder)}</span></div><p class="no num">${esc(b.number)}</p><button type="button" class="btn primary block" data-copy="${esc(b.number)}">${ic('copy', 20)}계좌번호 복사하기</button></div>`
    : '<div class="acct"><p class="b muted">입금 계좌</p><p class="sm">계좌 정보가 없습니다. 담당자에게 문의하세요.</p></div>';

  function appRows(r) {
    const p = findProgram(r.programId);
    return `<dt>소모임</dt><dd>${esc(p?.name || r.programId)}</dd>${CREW.address ? `<dt>장소</dt><dd>${esc(CREW.address)}</dd>` : ''}<dt>수강일</dt><dd>매주 ${WEEKDAY[r.weekday]}요일 ${esc(r.time)}</dd><dt>신청 기간</dt><dd>${esc(LONG(r.periodStart))} ~ ${esc(LONG(r.periodEnd))}</dd>`;
  }

  function viewDone() {
    const r = state.done;
    return `<div class="paytop"><div class="ico-ok">${ic('check', 30)}</div><div><h1>입금해 주세요</h1><p class="muted">입금이 확인되면 신청이 확정돼요.</p></div></div>
      <div class="stack paygrid">
        <div class="stack"><div class="card amt-row"><div><p class="muted sm">입금하실 금액 (한 달)</p><p class="amount num" style="color:var(--c-brand-strong)">${won(r.amount)}</p></div><button type="button" class="btn secondary s" data-copy="${r.amount}">${ic('copy', 18)}금액 복사</button></div>
        ${acctCard(state.info.bank)}</div>
        <div class="card"><dl class="kv"><dt>신청번호</dt><dd class="num" style="font-size:20px;letter-spacing:.06em">${esc(r.id)}</dd>${appRows(r)}<dt>입금자명</dt><dd>${esc(r.name)}</dd><dt>입금 기한</dt><dd style="color:var(--c-pend-fg)">${formatKstDateTime(r.holdUntil)}까지</dd></dl>
        <div class="hr"></div>
        <ol class="notes"><li>입금 계좌 안내를 문자로 보내 드렸어요. 문자가 오지 않으면 이 화면의 계좌로 입금해 주세요.</li><li>입금자명을 신청하신 분 이름과 같게 보내 주세요.</li><li>기한(${CREW.holdHours}시간)이 지나면 신청이 자동으로 취소돼요.</li><li>신청 당일 노쇼하면 환불되지 않아요.</li><li>신청번호는 조회·취소에 필요해요. 화면을 캡처해 두세요.</li></ol></div>
      </div>`;
  }

  /* ---------- 6. 내 신청 조회 ---------- */
  function lookupBadge(r) {
    switch (r.status) {
      case 'pending': return badge('pend', '입금 대기', 'clock');
      case 'active': return r.cancelRequested ? badge('bad', '취소 요청 중', 'alert') : badge('ok', '이용 중', 'check');
      case 'expiring': return badge('pend', '곧 끝나요', 'clock');
      case 'ended': return badge('bad', '기간이 끝났어요', 'alert');
      case 'expired': return badge('off', '입금 기한 만료', 'clock');
      default: return badge('off', '취소', 'ban');
    }
  }

  function viewLookup() {
    const k = state.lk;
    const r = k.rec;
    const bad = Boolean(k.err);
    let result = '';
    if (r) {
      const pay = ['pending', 'expiring', 'ended'].includes(r.status);
      let extra = '';
      if (r.status === 'pending') extra = `${acctCard(state.info.bank)}<p class="sm">입금자명 ${esc(r.name)} · 입금 기한 <b style="color:var(--c-pend-fg)">${formatKstDateTime(r.holdUntil)}까지</b></p>`;
      else if (r.status === 'expiring' || r.status === 'ended') extra = `${alertBox('warn', 'info', r.status === 'ended' ? `이용 기간이 ${esc(LONG(r.periodEnd))}에 끝났어요. 계속 참여하시려면 ${won(CREW.fee)}을 입금해 주세요.` : `이용 기간이 ${esc(LONG(r.periodEnd))}에 끝나요. 이어서 하시려면 ${won(CREW.fee)}을 입금해 주세요.`)}${acctCard(state.info.bank)}<p class="sm">입금하시면 확인 후 한 달 연장해 드려요.</p>`;
      else if (r.status === 'expired') extra = alertBox('warn', 'info', '입금 기한이 지났어요. 다시 신청해 주세요.');
      const canCancel = r.status === 'pending' || (['active', 'expiring'].includes(r.status) && !r.cancelRequested);
      let cancel = '';
      if (canCancel) {
        cancel = k.cancelOpen
          ? `<div class="stack" style="border-top:1px solid var(--c-line);padding-top:16px"><p class="b">${r.status === 'pending' ? '바로 취소됩니다.' : '담당자가 확인한 뒤 처리해요. (취소 요청으로 접수돼요) 이미 낸 참가비는 환불되지 않을 수 있어요.'}</p><div class="field"><label for="f-reason">사유 <span class="muted" style="font-weight:400">(선택)</span></label><textarea id="f-reason" class="input" maxlength="100" placeholder="사유를 적어 주세요">${esc(k.reason)}</textarea></div><div class="cols2"><button type="button" class="btn danger" id="lkDoCancel" ${k.busy ? 'disabled' : ''}>${k.busy ? '<span class="spin"></span>처리하는 중…' : '취소하기'}</button><button type="button" class="btn secondary" id="lkCancelClose">돌아가기</button></div></div>`
          : '<button type="button" class="btn secondary block" id="lkCancelOpen">신청 취소</button>';
      }
      result = `${k.msg ? alertBox('ok', 'check', esc(k.msg)) : ''}<div class="card stack"><div class="row-f sp-b">${lookupBadge(r)}<span class="muted sm num">신청번호 ${esc(r.id)}</span></div>
        <dl class="kv">${appRows(r)}${r.status === 'active' ? '<dt>참가비</dt><dd>이번 기간 납부 완료</dd>' : pay ? `<dt>참가비</dt><dd>${won(r.amount)} (한 달)</dd>` : ''}</dl>
        ${r.cancelRequested ? '<p class="muted sm">취소 요청이 접수되었어요. 담당자가 안내해 드려요.</p>' : ''}${extra}${cancel}</div>
        <button type="button" class="btn ${k.msg ? 'primary' : 'ghost'} block" id="lkDone">확인했어요</button>`;
    }
    const form = r ? '' : `<div class="card stack">
        <div class="field"><label for="f-lkid">신청번호</label><input id="f-lkid" class="input ${bad ? 'err' : ''}" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="8자리 영문·숫자" value="${esc(k.id)}"></div>
        <div class="field"><label for="f-lkphone">휴대전화</label><input id="f-lkphone" class="input ${bad ? 'err' : ''}" type="tel" inputmode="tel" placeholder="010-0000-0000" maxlength="13" value="${esc(k.phone)}"></div>
        <button type="button" class="btn primary block" id="lkGo" ${stepProblem(6) || k.busy ? 'disabled' : ''}>${k.busy ? '<span class="spin"></span>찾는 중…' : `${ic('search', 20)}내 신청 찾기`}</button>
      </div>`;
    return `<h1>내 신청 찾기</h1>
      <p class="lead">신청번호와 휴대전화 번호를 입력해 주세요.</p>
      <div class="stack">${form}${k.err ? alertBox('err', 'alert', esc(k.err)) : ''}${result}</div>`;
  }

  async function doLookup() {
    const k = state.lk;
    if (k.busy) return;
    k.busy = true; k.err = ''; k.msg = ''; render(true);
    try { const j = await api('lookup', { id: k.id.trim(), phone: k.phone }); k.rec = j.application; k.cancelOpen = false; } catch (e) { k.rec = null; k.err = e.message; }
    k.busy = false; render(true);
  }

  async function doCancel() {
    const k = state.lk;
    k.busy = true; render(true);
    try {
      const j = await api('cancel', { id: k.rec.id, phone: k.phone, reason: k.reason });
      k.msg = j.mode === 'canceled' ? '신청을 취소했어요. 자리가 다시 열렸어요.' : '취소 요청을 접수했어요. 담당자가 확인한 뒤 안내해 드려요.';
      k.cancelOpen = false;
      k.rec = (await api('lookup', { id: k.rec.id, phone: k.phone })).application;
      try { localStorage.removeItem(CREW.storageKey); } catch { /* 무시 */ }
      loadInfo();
    } catch (e) { k.err = e.message; }
    k.busy = false; render(true);
  }

  /* ---------- 화면 그리기 ---------- */
  function render(keepScroll = false) {
    const views = { 1: viewProgram, 2: viewSchedule, 3: viewPerson, 4: viewReview, 5: viewDone, 6: viewLookup };
    const y = window.scrollY;
    const active = document.activeElement?.id;
    $('#main').innerHTML = `<section class="view c${state.step}">${views[state.step]()}</section>`;
    document.querySelectorAll('[data-track]').forEach((t) => { const i = coverIdx[t.dataset.track] || 0; if (i) t.scrollLeft = i * t.clientWidth; });
    if (keepScroll) {
      window.scrollTo(0, y);
      if (active && /^f-/.test(active)) {
        const el = document.getElementById(active);
        if (el) {
          el.focus({ preventScroll: true });
          const textLike = el.tagName === 'TEXTAREA' || ['text', 'search', 'url', 'email', 'password'].includes(el.type);
          if (textLike) { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* 지원하지 않는 칸 */ } }
        }
      }
    } else { const h = $('#main h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    chrome();
  }

  const NEXT_LABEL = { 1: '일정 고르기', 2: '신청자 정보 입력', 3: '내용 확인하기' };

  function chrome() {
    const st = state.step;
    const withSteps = st <= STEPS;
    $('#back').hidden = st === 5 || (st === 1 && !CREW.homeUrl);
    $('#myres').classList.toggle('on', st === 6);
    $('#prog').hidden = !withSteps;
    $('#stepnav').hidden = !withSteps;
    if (withSteps) {
      $('#progBar').style.width = `${st / STEPS * 100}%`;
      $('#progText').textContent = `${st}/${STEPS} · ${NAMES[st - 1]}`;
      $('#prog').setAttribute('aria-valuenow', String(st));
      $('#stepnav').innerHTML = NAMES.map((n, i) => `${i ? '<span class="sep"></span>' : ''}<span class="step ${i + 1 < st ? 'done' : i + 1 === st ? 'cur' : ''}" ${i + 1 === st ? 'aria-current="step"' : ''}><span class="n">${i + 1 < st ? ic('check', 16) : i + 1}</span>${n}</span>`).join('');
    }
    const hot = $('#hotline');
    if (state.info.contact) { hot.hidden = false; hot.innerHTML = `${ic('phone', 20)}문의 ${esc(state.info.contact)}`; hot.href = `tel:${state.info.contact.replace(/[^0-9+]/g, '')}`; }

    const dock = $('#dock');
    dock.hidden = st === 6;
    const btn = $('#next');
    const problem = state.submitting ? '' : stepProblem(st);
    btn.innerHTML = st === 4 ? (state.submitting ? '<span class="spin"></span>신청하는 중…' : `${won(CREW.fee)} 신청하기`) : st === 5 ? '확인했어요' : NEXT_LABEL[st] || '다음';
    btn.disabled = st === 5 ? false : Boolean(problem) || state.submitting;
    btn.classList.toggle('dis', btn.disabled);

    const peek = $('#peek');
    const p = state.programId ? program() : null;
    const sum = [p ? p.name : null, state.slot ? slotLabel(slotObj()) : null, state.start && st >= 2 ? `${SHORT(state.start)}부터` : null].filter(Boolean);
    if (st >= 5) peek.hidden = true;
    else if (problem) { peek.className = 'dsum hint'; peek.innerHTML = `${ic('info', 18)}${esc(problem)}`; peek.hidden = false; }
    else if (sum.length) { peek.className = 'dsum'; peek.textContent = sum.join(' · '); peek.hidden = false; }
    else peek.hidden = true;

    renderLast();
    fitVars();
  }

  function fitVars() {
    const root = document.documentElement.style;
    const wrap = document.querySelector('.wrap');
    root.setProperty('--top-h', `${Math.round(wrap.getBoundingClientRect().top + window.scrollY)}px`);
    const dock = $('#dock');
    const fixed = getComputedStyle(dock).position === 'fixed';
    root.setProperty('--dock-h', fixed && !dock.hidden ? `${Math.round(dock.getBoundingClientRect().height)}px` : '0px');
  }
  window.addEventListener('resize', () => fitVars());

  // 입금 안내 화면이 아닌데 방금 신청한 내역이 있으면 위쪽에 다시 볼 수 있게 알려 줍니다.
  function renderLast() {
    const note = $('#lastNotice');
    let last = null;
    try { last = JSON.parse(localStorage.getItem(CREW.storageKey)); } catch { /* 무시 */ }
    const show = Boolean(last && last.holdUntil > Date.now() && state.step !== 5 && state.step !== 6);
    note.hidden = !show;
    if (show) $('#lastText').textContent = `입금 대기 중인 신청이 있어요. ${formatKstDateTime(last.holdUntil)}까지 입금해 주세요.`;
  }

  function go(step, push = true) {
    state.step = step;
    state.error = '';
    if (push) history.pushState({ step }, '');
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- 이벤트 ---------- */
  function setProgram(id) {
    if (state.programId !== id) {
      state.programId = id;
      const p = program();
      state.slot = slotId(p.id, sortedSlots(p)[0]);
      state.start = null;
      state.month = null;
    }
  }

  function ensureMonth() {
    if (state.month) return;
    const t = parseYmd(addDays(todayKst(Date.now()), CREW.leadDays));
    state.month = { y: t.y, m: t.m };
  }

  $('#main').addEventListener('click', (e) => {
    const t = e.target;
    const pn = t.closest('[data-pn]');
    if (pn) {
      const tr = document.querySelector(`[data-track="${pn.dataset.for}"]`);
      if (tr) { const n = tr.children.length; const cur = Math.round(tr.scrollLeft / (tr.clientWidth || 1)); const to = (cur + Number(pn.dataset.pn) + n) % n; tr.scrollTo({ left: to * tr.clientWidth }); }
      return;
    }
    const z = t.closest('[data-zoom]');
    if (z) { const pg = findProgram(z.dataset.zoom); return openPhotos(state.info.photos[z.dataset.zoom] || [], Number(z.dataset.i), pg?.name || ''); }
    const tb = t.closest('[data-table]');
    if (tb) return openTable(tb.dataset.table);
    const pr = t.closest('[data-program]');
    if (pr) { setProgram(pr.dataset.program); return render(true); }
    const sl = t.closest('[data-slot]');
    if (sl) { state.slot = sl.dataset.slot; state.start = null; return render(true); }
    const day = t.closest('[data-day]');
    if (day && !day.disabled) { state.start = day.dataset.day; return render(true); }
    if (t.closest('#prevM')) { const { y, m } = state.month; state.month = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }; return render(true); }
    if (t.closest('#nextM')) { const { y, m } = state.month; state.month = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }; return render(true); }
    const g = t.closest('[data-gender]');
    if (g) { state.gender = g.dataset.gender; return render(true); }
    if (t.closest('#lkGo')) { if (!stepProblem(6)) doLookup(); return; }
    if (t.closest('#lkDone')) return reset();
    if (t.closest('#lkCancelOpen')) { state.lk.cancelOpen = true; return render(true); }
    if (t.closest('#lkCancelClose')) { state.lk.cancelOpen = false; return render(true); }
    if (t.closest('#lkDoCancel')) return doCancel();
    const c = t.closest('[data-copy]');
    if (c) copyText(c);
  });

  $('#main').addEventListener('keydown', (e) => {
    const tb = e.target.closest?.('[data-table]');
    if (tb && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openTable(tb.dataset.table); }
  });

  $('#main').addEventListener('change', (e) => {
    if (e.target.id === 'f-agree') { state.agree = e.target.checked; render(true); }
  });

  $('#main').addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 'f-name') { state.name = e.target.value; chrome(); }
    else if (id === 'f-phone') { e.target.value = state.phone = formatPhone(e.target.value); chrome(); }
    else if (id === 'f-search') { state.q = e.target.value; render(true); }
    else if (id === 'f-age') { state.age = e.target.value; chrome(); }
    else if (id === 'f-dong') { state.dong = e.target.value; chrome(); }
    else if (id === 'f-website') state.website = e.target.value;
    else if (id === 'f-lkid') { state.lk.id = e.target.value.toUpperCase(); e.target.value = state.lk.id; state.lk.rec = null; state.lk.err = ''; lookupButton(); }
    else if (id === 'f-lkphone') { e.target.value = state.lk.phone = formatPhone(e.target.value); state.lk.rec = null; state.lk.err = ''; lookupButton(); }
    else if (id === 'f-reason') state.lk.reason = e.target.value;
  });
  function lookupButton() {
    const b = $('#lkGo');
    if (b) b.disabled = Boolean(stepProblem(6)) || state.lk.busy;
  }

  // 사진 넘김 표시(1/3)
  document.addEventListener('scroll', (e) => {
    const tr = e.target;
    if (!tr?.dataset?.track) return;
    const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
    coverIdx[tr.dataset.track] = i;
    const c = document.querySelector(`[data-count="${tr.dataset.track}"]`);
    if (c) c.textContent = `${i + 1}/${tr.children.length}`;
  }, true);

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
    if (st === 5) return reset();
    if (stepProblem(st)) return;
    if (st === 4) return submit();
    if (st === 1) ensureMonth();
    go(st + 1);
  });
  $('#back').addEventListener('click', () => { if (state.step === 1) location.href = CREW.homeUrl || '/'; else history.back(); });
  window.addEventListener('popstate', (e) => {
    if (overlayPop()) return;
    const step = e.state?.step || 1;
    state.step = step === 6 ? 6 : state.done && step === 5 ? 5 : Math.min(step, 4);
    if (state.step >= 2 && state.step <= 4 && !state.programId) state.step = 1;
    state.error = '';
    render();
    window.scrollTo(0, 0);
  });
  $('#retryBtn').addEventListener('click', loadInfo);
  $('#back').innerHTML = ic('left', 26);
  $('#myres').innerHTML = `${ic('search', 20)}내 신청`;
  if (CREW.address && $('#whereBtn')) {
    const q = encodeURIComponent(CREW.address);
    const link = (href, t) => `<a class="btn secondary s" href="${href}" target="_blank" rel="noopener noreferrer">${t}</a>`;
    $('#whereBtn').innerHTML = `${ic('pin', 20)}오시는 길`;
    $('#where').innerHTML = `<div class="dlg-h"><h2 id="whereT">오시는 길</h2><button type="button" class="xbtn" data-close aria-label="닫기">${ic('x', 24)}</button></div>
      <p class="whereaddr"><b>${esc(CREW.brand)}</b><span>${esc(CREW.address)}</span></p>
      <div class="map"><iframe class="map-pane" title="위치 지도" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${q}&hl=ko&z=17&output=embed"></iframe></div>
      <div class="row-f wrapf" style="margin-top:14px"><button type="button" class="btn secondary s" data-copy="${esc(CREW.address)}">${ic('copy', 18)}주소 복사</button>${link(`https://map.naver.com/p/search/${q}`, '네이버 지도')}${link(`https://map.kakao.com/?q=${q}`, '카카오맵')}${link(`https://www.google.com/maps/search/?api=1&query=${q}`, '구글 지도')}</div>`;
    watchOverlay($('#whereDlg'));
    $('#whereBtn').addEventListener('click', () => openOverlay($('#whereDlg')));
    $('#whereDlg').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target.classList.contains('scrim')) return closeOverlay($('#whereDlg'));
      const c = e.target.closest('[data-copy]');
      if (c) copyText(c);
    });
  }
  $('#myres').addEventListener('click', () => go(6));
  $('#lastBtn').addEventListener('click', () => {
    try { state.done = JSON.parse(localStorage.getItem(CREW.storageKey)); go(5); } catch { /* 무시 */ }
  });

  /* ---------- 신청 ---------- */
  async function submit() {
    if (state.submitting) return;
    state.submitting = true; state.error = ''; chrome();
    const application = {
      slot: state.slot, start: state.start, name: state.name.trim(), phone: state.phone, gender: state.gender,
      age: state.age, dong: state.dong.trim(), agree: state.agree, website: state.website,
    };
    try {
      const j = await api('apply', { application });
      state.done = j.application;
      try { localStorage.setItem(CREW.storageKey, JSON.stringify(state.done)); } catch { /* 저장 불가 환경 */ }
      state.submitting = false;
      state.step = 5;
      await loadInfo();
      go(5);
    } catch (err) {
      state.submitting = false;
      if (err.code === 'FULL') {
        await loadInfo();
        state.start = null;
        state.step = 2;
        history.pushState({ step: 2 }, '');
        state.error = `${err.message}`;
        render();
        return;
      }
      state.error = err.message;
      render(true);
    }
  }

  function reset() {
    Object.assign(state, { programId: null, slot: null, start: null, month: null, agree: false, done: null, error: '', lk: emptyLk() });
    go(1);
  }

  /* ---------- 시작 ---------- */
  history.replaceState({ step: 1 }, '');
  render();
  loadInfo().then(() => render(true));
}
