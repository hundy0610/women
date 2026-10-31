// 사진 확대 보기(대관 공간, 소모임 공용). 큰 화면에서 사진을 보고, 화살표 버튼·키보드·밀어서 다음 사진으로 넘깁니다.
import { ic } from '/icons.js';
import { watchOverlay, openOverlay, closeOverlay } from '/overlay.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lb = { list: [], i: 0, name: '', dir: 0 };
const go = (step) => { lb.dir = step; lb.i = (lb.i + step + lb.list.length) % lb.list.length; paint(); };

export function openPhotos(list, i, name = '') {
  if (!list?.length) return;
  lb.list = list;
  lb.i = Math.min(Math.max(0, i || 0), list.length - 1);
  lb.name = name;
  lb.dir = 0;
  let d = document.getElementById('lightbox');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'lightbox';
    d.className = 'sheet dark';
    d.setAttribute('aria-label', '사진 보기');
    let swipedAt = 0;
    d.addEventListener('click', (e) => {
      if (Date.now() - swipedAt < 400) return; // 넘기는 동작 끝에 생기는 클릭은 무시
      if (e.target.closest('[data-lb=close]') || e.target === d) closeOverlay(d);
      else if (e.target.closest('[data-lb=prev]')) go(-1);
      else if (e.target.closest('[data-lb=next]')) go(1);
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });
    // 화면을 좌우로 밀어서 사진 넘기기 (터치, 마우스 드래그 모두)
    let sx = 0; let sy = 0; let track = false;
    d.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sx = e.clientX; sy = e.clientY; track = true; });
    d.addEventListener('pointercancel', () => { track = false; });
    d.addEventListener('pointerup', (e) => {
      if (!track) return;
      track = false;
      const dx = e.clientX - sx; const dy = e.clientY - sy;
      if (lb.list.length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipedAt = Date.now(); go(dx < 0 ? 1 : -1); }
    });
    document.body.append(d);
    watchOverlay(d);
  }
  paint();
  openOverlay(d);
}

function paint() {
  const many = lb.list.length > 1;
  document.getElementById('lightbox').innerHTML = `<div class="lb"><div class="lb-top"><button type="button" class="lb-b" data-lb="close" aria-label="닫기">${ic('x', 26)}</button></div>
    <div class="lb-mid">${many ? `<button type="button" class="lb-b" data-lb="prev" aria-label="이전 사진">${ic('left', 26)}</button>` : ''}<img class="${lb.dir > 0 ? 'in-next' : lb.dir < 0 ? 'in-prev' : ''}" src="${esc(lb.list[lb.i])}" alt="${esc(lb.name)} 사진 ${lb.i + 1}" draggable="false">${many ? `<button type="button" class="lb-b" data-lb="next" aria-label="다음 사진">${ic('right', 26)}</button>` : ''}</div>
    <p class="lb-cap num">${esc(lb.name)} ${lb.i + 1} / ${lb.list.length}</p></div>`;
  lb.dir = 0;
  // 다음 사진을 미리 불러 둡니다.
  for (const k of [1, -1]) { const s = lb.list[(lb.i + k + lb.list.length) % lb.list.length]; if (s) new Image().src = s; }
}
