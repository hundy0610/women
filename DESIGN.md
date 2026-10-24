# 드림 문화센터 대관 예약 — 디자인 시스템

디자인 시안(Claude Design)을 구현한 기준 문서입니다. 값의 원본은 [public/tokens.css](public/tokens.css)이고, 컴포넌트는 [public/styles.css](public/styles.css)에 있습니다.
색이나 크기를 바꿀 때는 `tokens.css`만 고치고 `npm test`로 접근성 기준(대비 4.5:1 등)을 확인하세요.

## 분위기

맑은 파랑과 따뜻한 크림 바탕, 호박색 포인트. 믿음이 가고 읽기 쉬운 공공·커뮤니티 서비스.
예약자는 40~70대 여성이 많아서 글자는 크게, 대비는 높게, 터치 대상은 넉넉하게 잡습니다. 상태는 색만으로 전달하지 않고 글자와 아이콘을 함께 씁니다.

## 색

| 이름 | 변수 | 값 | 쓰는 곳 |
| --- | --- | --- | --- |
| 브랜드 파랑 | `--c-brand` | `#2B5FD9` | 주 버튼, 선택됨 (흰 글자 5.3:1) |
| 브랜드 진함 | `--c-brand-strong` | `#1A3F9E` | 링크, 눌림, 강조 글자 |
| 브랜드 연함 | `--c-brand-soft` | `#E6EEFC` | 선택 배경, 현재 단계 |
| 포인트 | `--c-accent` | `#FFB547` | 로고 점 |
| 바탕 | `--c-bg` | `#FBF7F0` | 페이지 바탕(크림) |
| 본문 글자 | `--c-ink` | `#1B2236` | 흰 바탕 16:1 |
| 보조 글자 | `--c-ink-2` | `#475066` | 흰 바탕 8.6:1 |
| 선 | `--c-line` | `#DCE0EA` | 장식 선 |
| 입력 테두리 | `--c-line-strong` | `#778099` | 입력칸, 칩 (3:1 이상) |

### 상태 색 (글자 + 아이콘 + 색을 함께 씁니다)

| 상태 | 바탕 / 글자 |
| --- | --- |
| 입금 대기 | `--c-pend-bg` / `--c-pend-fg` (테두리 `--c-pend-line`) |
| 확정, 성공 | `--c-ok-bg` / `--c-ok-fg` |
| 취소 요청, 오류 | `--c-bad-bg` / `--c-bad-fg` |
| 취소, 기한 만료, 휴무 | `--c-off-bg` / `--c-off-fg` |
| 현황표 "예약" 칸 | `--c-booked` (흰 글자 11:1) |

## 글꼴과 크기

Pretendard Variable. 한국어 가변 글꼴이며 `/fonts/pretendard`에서 직접 제공합니다(SIL OFL, 필요한 글자 조각만 내려받는 서브셋).

| 이름 | 크기 / 굵기 | 변수 |
| --- | --- | --- |
| 표시 제목 | 34px / 800 (모바일 30px) | `--fs-display`, `--fs-display-m` |
| 부제목 | 22px / 700 | `--fs-h2` |
| 본문, 라벨 | 18px / 400, 600 | `--fs-body`, `--fs-label` |
| 작은 글자 | 16px | `--fs-small` |
| 캡션 | 15px | `--fs-caption` |
| 금액 | 40px / 800 | `--fs-amount` |

## 간격, 모서리, 그림자, 크기

- 간격은 4px 단위: `--sp-1`(4) … `--sp-9`(64)
- 모서리: `--r-sm` 10, `--r-md` 14, `--r-lg` 20, `--r-xl` 28, `--r-pill` 999
- 그림자: `--sh-1`(카드), `--sh-2`(대화상자), `--sh-dock`(하단 영역), `--sh-btn`(주 버튼)
- 터치 대상 `--tap` 48px, 버튼 높이 `--btn-h` 56px, 입력칸 높이 `--input-h` 56px
- 포커스 표시 `--focus`(흰 링 + 브랜드 링)
- 화면 폭: 모바일 375px부터, 태블릿 768px, 데스크톱 1000px 이상 (2열)

## 컴포넌트 (styles.css)

버튼 `.btn` (`.primary` `.secondary` `.ghost` `.danger` `.ok-btn` `.s` `.block`), 카드 `.card`, 입력 `.input`, 칩 `.chip`, 체크 `.check`/`.box`, 배지 `.badge` (`.b-pend` `.b-ok` `.b-bad` `.b-off`), 알림 띠 `.alert`, 빈 화면 `.state`, 달력 `.cal`/`.day`, 공간 카드 `.sp`, 시간표 `.hgrid`/`.hc`, 대화상자 `.dlg`, 사진 확대 `.lb`, 토스트 `.toast`, 관리자 `.ad` `.side` `.stat` `.ritem` `.trow` `.cal2` 등.

## 접근성 기준

- 본문 18px 이상, 글자와 바탕 대비 4.5:1 이상, 입력 테두리 3:1 이상
- 터치 대상 48px 이상, 상태는 색만으로 구분하지 않기
- `prefers-reduced-motion`을 지킴
