// 사진 확대, 오시는 길, 관리자 확인 창이 열려 있는 동안 휴대폰의 "뒤로 가기"가 페이지를 떠나지 않고 창만 닫도록 합니다.
// 창을 열 때 기록(history)을 한 칸 쌓고, 창이 닫히면(X, 바깥 누르기, Esc) 그 한 칸을 되돌립니다.
// close 이벤트가 늦게 오는 환경도 있어서, 직접 닫는 곳에서는 closeOverlay()로 바로 정리하고 이벤트는 보조로 씁니다.
let ignore = 0;

function settle(dialog) {
  if (!dialog._pushed) return;
  dialog._pushed = false;
  if (dialog._byPop) { dialog._byPop = false; return; } // 뒤로 가기로 닫힌 경우는 이미 한 칸 되돌아간 상태
  ignore++;
  history.back();
}

export function watchOverlay(dialog) {
  dialog.addEventListener('close', () => settle(dialog)); // Esc 등 브라우저가 직접 닫는 경우
}

export function openOverlay(dialog) {
  if (!dialog.open) dialog.showModal();
  if (dialog._pushed) return;
  history.pushState({ ...(history.state || {}), ov: true }, '');
  dialog._pushed = true;
}

export function closeOverlay(dialog) {
  if (dialog.open) dialog.close();
  settle(dialog);
}

// popstate에서 가장 먼저 부릅니다. true면 창 처리만 한 것이므로 화면 단계는 건드리지 않습니다.
export function overlayPop() {
  if (ignore > 0) { ignore--; return true; }
  const d = document.querySelector('dialog[open]');
  if (d) {
    d._byPop = true;
    d.close();
    settle(d);
    return true;
  }
  return false;
}
