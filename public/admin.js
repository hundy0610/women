import { CONFIG as C } from '/shared/config.mjs';
import { formatKoreanDate, formatKstDateTime, hh } from '/shared/time.mjs';

const $ = (s) => document.querySelector(s);
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const LABEL = { pending: '입금 대기', confirmed: '확정', canceled: '취소', expired: '기한 만료' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let pw = '';
let items = [];
let filter = 'pending';

async function call(body) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j?.error?.message || '요청에 실패했습니다.');
  return j;
}

function render() {
  const list = items.filter((r) => filter === 'all' || r.status === filter);
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.f === filter));
  $('#rows').innerHTML = list.length
    ? list.map((r) => {
      const sp = r.spaces.map((id) => C.spaces.find((s) => s.id === id)?.name || id).join(', ');
      const acts = [];
      if (r.status === 'pending' || r.status === 'expired') acts.push(`<button class="sm pri" data-act="confirm" data-id="${esc(r.id)}">입금 확인(확정)</button>`);
      if (r.status !== 'canceled') acts.push(`<button class="sm" data-act="cancel" data-id="${esc(r.id)}">취소</button>`);
      return `<tr>
        <td>${formatKoreanDate(r.date)}<br>${hh(r.start)}~${hh(r.end)}</td>
        <td>${esc(sp)}</td>
        <td>${esc(r.name)}<br>${esc(r.phone)}<br>${r.people}명${r.purpose ? `<br>${esc(r.purpose)}` : ''}</td>
        <td>${won(r.amount)}</td>
        <td><span class="st ${r.status}">${LABEL[r.status] || r.status}</span>${r.status === 'pending' ? `<br><small>${formatKstDateTime(r.holdUntil)}까지</small>` : ''}<br><small>${esc(r.id)}</small></td>
        <td><div class="acts">${acts.join('')}</div></td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6">해당하는 예약이 없습니다.</td></tr>';
}

async function load() {
  $('#msg').textContent = '';
  try {
    items = (await call({ action: 'list' })).items;
    $('#tabs').hidden = false;
    $('#tbl').hidden = false;
    try { sessionStorage.setItem('women:adm', pw); } catch { /* 무시 */ }
    render();
  } catch (e) {
    $('#msg').textContent = e.message;
  }
}

$('#login').addEventListener('submit', (e) => { e.preventDefault(); pw = $('#pw').value; load(); });
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
$('#rows').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'cancel' && !confirm('이 예약을 취소할까요? 취소하면 해당 시간이 다시 열립니다.')) return;
  try { await call({ action: b.dataset.act, id: b.dataset.id }); await load(); } catch (err) { $('#msg').textContent = err.message; }
});

try { pw = sessionStorage.getItem('women:adm') || ''; } catch { /* 무시 */ }
if (pw) { $('#pw').value = pw; load(); }
