const OPTIONS = [
  { key: 'pretendard', name: 'Pretendard', note: '지금 쓰는 글꼴. 중립적이고 앱 같은 느낌, 가독성이 가장 안정적입니다.', body: '"Pretendard Variable"' },
  { key: 'suit', name: 'SUIT', note: '스타트업과 브랜드 사이트에서 많이 쓰는 글꼴. 글자 모양이 단정하고 숫자가 깔끔합니다.', body: '"SUIT Variable"' },
  { key: 'wanted', name: 'Wanted Sans', note: '원티드가 만든 글꼴. 현대적이고 세련된 인상이고 제목이 또렷합니다.', body: '"Wanted Sans Variable"' },
  { key: 'paperlogy', name: 'Paperlogy', note: '최근 유행하는 기하학적인 글꼴. 둥근 획과 큰 제목이 트렌디합니다.', body: '"Paperlogy"' },
  { key: 'plex', name: 'IBM Plex Sans KR', note: '업무용 느낌이 강한 글꼴. 믿음직하고 정돈된 인상입니다.', body: '"IBM Plex Sans KR"' },
  { key: 'serif', name: 'Noto Serif KR 제목 + Pretendard 본문', note: '제목만 명조 계열로 써서 에디토리얼하고 고급스러운 인상을 줍니다.', body: '"Pretendard Variable"', head: '"Noto Serif KR"' },
];

const root = document.getElementById('fonts');
OPTIONS.forEach((o, i) => {
  const el = document.createElement('article');
  el.className = 'card';
  el.style.setProperty('--f', `${o.body}, "Pretendard Variable", sans-serif`);
  el.style.setProperty('--fh', `${o.head || o.body}, "Pretendard Variable", serif`);
  el.innerHTML = `
    <header><span class="no">${i + 1}</span><div><h3>${o.name}</h3><p>${o.note}</p></div></header>
    <div class="sample">
      <p class="mini">여성문화센터 대관 예약</p>
      <h4>날짜를 선택하세요</h4>
      <p class="sub">이용 24시간 전까지 예약할 수 있습니다.</p>
      <div class="row"><span>방1 · 12명</span><span class="tn">시간당 2만원 · 1일 13만원</span></div>
      <div class="row"><span>세미나실 · 60명</span><span class="tn">시간당 3만원 · 1일 20만원</span></div>
      <div class="total"><span>입금할 금액</span><b class="tn">200,000원</b></div>
      <button type="button">다음</button>
    </div>
    <a class="try" href="/?font=${o.key}">사이트에서 보기</a>`;
  root.append(el);
});
