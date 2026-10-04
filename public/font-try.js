// 글꼴 시험용: 주소 뒤에 ?font=suit 처럼 붙이면 그 글꼴로 사이트를 볼 수 있습니다. ?font=reset 으로 되돌립니다.
// 확정된 글꼴은 DESIGN.md의 fontFamily와 index.html의 글꼴 링크로 옮기고, 이 파일은 지워도 됩니다.
(() => {
  const FONTS = {
    pretendard: { body: '"Pretendard Variable"' },
    suit: { css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css', body: '"SUIT Variable"' },
    wanted: { css: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css', body: '"Wanted Sans Variable"' },
    paperlogy: { css: 'https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy.css', body: '"Paperlogy"' },
    plex: { css: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap', body: '"IBM Plex Sans KR"' },
    serif: { css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap', body: '"Pretendard Variable"', head: '"Noto Serif KR"' },
  };
  let key = null;
  try {
    const q = new URLSearchParams(location.search).get('font');
    if (q === 'reset') localStorage.removeItem('women:font');
    else if (q && FONTS[q]) localStorage.setItem('women:font', q);
    key = localStorage.getItem('women:font');
  } catch { /* 저장소를 못 쓰는 환경 */ }
  if (!key || !FONTS[key]) return;
  const f = FONTS[key];
  if (f.css) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = f.css;
    document.head.append(l);
  }
  const root = document.documentElement.style;
  root.setProperty('--font', `${f.body}, "Pretendard Variable", system-ui, sans-serif`);
  if (f.head) root.setProperty('--font-head', `${f.head}, "Pretendard Variable", serif`);
  const st = document.createElement('style');
  st.textContent = 'h1, .cal-head strong, .price-lg, .amount, .step h1 { font-family: var(--font-head, var(--font)); }';
  document.head.append(st);
})();
