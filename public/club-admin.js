// 소모임 포털 관리자 화면(한빛커뮤니티). 신청 목록, 이력, 직접 등록, CSV. 장소대관은 없습니다.
// 줄 모양, 처리, 양식은 마두 소모임과 같은 도우미(crew-lib.js)를 씁니다.
import { ic } from '/icons.js';
import { watchOverlay, openOverlay, closeOverlay } from '/overlay.js';
import { createCrewAdmin, kindTag } from '/crew-lib.js';
import { todayKst, formatKstDateTime, formatKoreanDate } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const errMsg = (t) => (t ? `<p class="msg err">${ic('alert', 18)}${esc(t)}</p>` : '');
const stateBox = (ico, text) => `<div class="state"><div class="ico">${ic(ico, 36)}</div><h2>${text}</h2></div>`;

const FILTERS = [['pending', '입금 대기'], ['req', '취소 요청'], ['active', '이용 중'], ['expiring', '곧 만료·만료'], ['expired', '기한 만료'], ['canceled', '취소'], ['all', '전체']];

export function startClubAdmin(cfg, { api, storageKey = 'women:adm' }) {
  let pw = '';
  let filter = 'pending';
  let query = '';
  let openId = null;
  let view = 'list';

  /* ---------- 알림과 확인 창 ---------- */
  let toastT;
  function toast(msg, bad = false) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false; t.className = `toast ${bad ? 't-err' : 't-ok'}`;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function ask({ title, body = '', reason = null, ok = '확인', okClass = 'primary', okIcon = '', no = '돌아가기' }) {
    return new Promise((resolve) => {
      const d = $('#adlg');
      $('#adlgBox').innerHTML = `<div class="dlg-h"><h2 id="adlgT">${title}</h2><button type="button" class="xbtn" data-no aria-label="닫기">${ic('x', 24)}</button></div>${body}${reason ? `<div class="field"><label for="adlgR">${reason.label} <span class="muted" style="font-weight:400">(선택)</span></label><textarea id="adlgR" class="input" maxlength="200" placeholder="${reason.placeholder}"></textarea></div>` : ''}<div class="cols2"><button type="button" class="btn ${okClass}" data-ok>${okIcon ? ic(okIcon, 20) : ''}${ok}</button><button type="button" class="btn secondary" data-no>${no}</button></div>`;
      let done = false;
      const finish = (v) => { if (done) return; done = true; d.removeEventListener('click', onClick); d.removeEventListener('close', onClose); closeOverlay(d); resolve(v); };
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
  watchOverlay($('#adlg'));

  const crew = createCrewAdmin({ getPw: () => pw, toast, ask, cfg, api });

  /* ---------- 목록 ---------- */
  const matches = (r, f) => {
    if (f === 'all') return true;
    if (f === 'req') return Boolean(r.cancelRequest) && r.status !== 'canceled';
    if (f === 'expiring') return r.status === 'expiring' || r.status === 'ended';
    return r.status === f;
  };
  function renderStats() {
    const items = crew.items();
    const c = (f) => items.filter((r) => matches(r, f));
    const pending = c('pending');
    const reqs = c('req');
    $('#stats').innerHTML = `
      <div class="stat"><span class="b">입금 대기</span><span class="v num">${pending.length}<small>건</small></span><span class="sm muted">합계 ${won(pending.reduce((a, r) => a + r.amount, 0))}</span></div>
      <div class="stat"><span class="b">이용 중</span><span class="v num">${c('active').length + c('expiring').length}<small>건</small></span><span class="sm muted">전체 ${items.length}건</span></div>
      <div class="stat ${c('expiring').length ? 'warn' : ''}"><span class="b">곧 만료·만료</span><span class="v num">${c('expiring').length}<small>건</small></span><span class="sm muted">연장 안내가 필요해요</span></div>
      <div class="stat ${reqs.length ? 'warn' : ''}"><span class="b row-f">${reqs.length ? ic('alert', 20) : ''}취소 요청</span><span class="v num">${reqs.length}<small>건</small></span><span class="sm" style="font-weight:600">${reqs.length ? '환불 처리가 필요해요' : '없음'}</span></div>`;
    $('#seats').innerHTML = crew.seatsHtml();
    const n = pending.length + reqs.length;
    document.title = n ? `(${n}) ${cfg.brand} 관리` : `${cfg.brand} 관리`;
  }
  function renderFilters() {
    const items = crew.items();
    $('#filters').innerHTML = FILTERS.map(([id, t]) => `<button type="button" class="chip" data-f="${id}" aria-pressed="${filter === id}">${t} <span class="n">${items.filter((r) => matches(r, id)).length}</span></button>`).join('');
  }
  function renderRows() {
    const q = query.trim().toLowerCase().replace(/-/g, '');
    let list = crew.items().filter((r) => matches(r, filter)).filter((r) => !q || [r.name, r.phone, r.id, r.dong].some((v) => String(v || '').toLowerCase().replace(/-/g, '').includes(q)));
    list = filter === 'pending' ? list.sort((a, b) => (a.holdUntil || 0) - (b.holdUntil || 0)) : list.sort((a, b) => b.createdAt - a.createdAt);
    $('#rows').innerHTML = list.length ? list.map((r) => crew.rowHtml(r, openId === r.id)).join('') : stateBox('file', '해당하는 신청이 없습니다.');
  }
  function renderLog() {
    const rows = crew.eventsFlat().sort((a, b) => b.t - a.t).slice(0, 600);
    $('#logList').innerHTML = rows.length
      ? rows.map((x) => `<div><span class="muted sm b">${formatKstDateTime(x.t)}</span><div>${kindTag('crew')} <b>${x.text}</b><br><span class="muted sm">${x.title} · ${esc(x.id)} · ${esc(x.status)}</span></div></div>`).join('')
      : stateBox('hist', '아직 이력이 없습니다.');
  }
  function renderAll() { renderStats(); renderFilters(); renderRows(); renderLog(); }
  async function load() { await crew.load(); renderAll(); }

  function setView(v) {
    view = v;
    for (const k of ['list', 'log', 'new']) $(`#v-${k}`).hidden = k !== v;
    for (const b of document.querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
    window.scrollTo(0, 0);
  }

  /* ---------- 이벤트 ---------- */
  $('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderFilters(); renderRows(); } });
  $('#q').addEventListener('input', (e) => { query = e.target.value; renderRows(); });
  $('#view').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
  $('#csvBtn').addEventListener('click', () => crew.csv());
  $('#reloadBtn').addEventListener('click', async () => { try { await load(); toast('새로 불러왔어요.'); } catch (err) { toast(err.message, true); } });
  $('#rows').addEventListener('click', async (e) => {
    const head = e.target.closest('[data-open]');
    if (head) { openId = openId === head.dataset.open ? null : head.dataset.open; return renderRows(); }
    const b = e.target.closest('[data-act][data-kind="crew"]');
    if (!b) return;
    try {
      const memo = document.getElementById(`memo-${b.dataset.id}`)?.value ?? '';
      if (await crew.act(b.dataset.act, b.dataset.id, memo)) await load();
    } catch (err) { toast(err.message || '처리하지 못했어요. 다시 시도해 주세요.', true); }
  });

  $('#newBox').innerHTML = crew.formHtml();
  crew.bindForm($('#newBox'), async () => { await load(); });

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
      try { sessionStorage.setItem(storageKey, pw); } catch { /* 무시 */ }
      showApp();
    } catch (err) { $('#loginErr').innerHTML = errMsg(err.message); $('#pw').classList.add('err'); }
    btn.disabled = false; btn.textContent = '들어가기';
  });
  $('#logout').innerHTML = `${ic('out', 20)}나가기`;
  $('#logout').addEventListener('click', () => { try { sessionStorage.removeItem(storageKey); } catch { /* 무시 */ } location.reload(); });
  $('#aDate').textContent = formatKoreanDate(todayKst(Date.now()));
  $('#csvBtn').innerHTML = `${ic('down', 18)}CSV 내려받기`;
  $('#reloadBtn').innerHTML = `${ic('refresh', 18)}새로고침`;
  $('.search .si').innerHTML = ic('search', 24);
  for (const el of document.querySelectorAll('.alert > .ai')) el.outerHTML = ic('info', 24);
  for (const b of document.querySelectorAll('[data-v]')) b.insertAdjacentHTML('afterbegin', ic({ list: 'list', log: 'hist', new: 'edit' }[b.dataset.v], 18));

  (async () => {
    try { pw = sessionStorage.getItem(storageKey) || ''; } catch { /* 무시 */ }
    if (!pw) return;
    try { await load(); showApp(); } catch { pw = ''; /* 로그인 화면 유지 */ }
  })();
  setView('list');
  setInterval(() => {
    if (document.hidden || $('#appView').hidden || $('#adlg').open) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.closest('#appView')) return;
    load().catch(() => {});
  }, 60000);
}
