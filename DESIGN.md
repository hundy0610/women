---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 사업의 예약 사이트. 웜 화이트 바탕과 흰 패널, 산뜻한 코랄 로즈 주 버튼, 부드러운 소프트 옐로 포인트. 숙박 예약 앱처럼 밝고 부드럽되 업무용으로 정돈된 화면.
colors:
  primary: "#22212A"
  secondary: "#4D4A55"
  tertiary: "#D63A58"
  tertiary-deep: "#B92D48"
  on-tertiary: "#FFFFFF"
  neutral: "#FAF7F6"
  surface: "#FFFFFF"
  sand: "#F5EFEE"
  line: "#EBE0E1"
  muted: "#6A6169"
  amber: "#FFC145"
  amber-soft: "#FFF4D9"
  on-amber-soft: "#6B4700"
  taken: "#5B5560"
  on-taken: "#FFFFFF"
  blocked: "#F1EEEE"
  on-blocked: "#5B5560"
  select-soft: "#FFEDF0"
  danger: "#B42318"
  success: "#12805C"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 1.6rem
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: -0.015em
  h2:
    fontFamily: Pretendard Variable
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 1.02rem
    fontWeight: 500
    lineHeight: 1.6
  label-md:
    fontFamily: Pretendard Variable
    fontSize: 1.05rem
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: Pretendard Variable
    fontSize: 0.9rem
    fontWeight: 500
    lineHeight: 1.45
  eyebrow:
    fontFamily: Pretendard Variable
    fontSize: 0.78rem
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0.14em
  price-lg:
    fontFamily: Pretendard Variable
    fontSize: 2.1rem
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.02em
    fontFeature: tnum
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 54px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-tertiary}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  card-muted-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  panel-header:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
  option-selected:
    backgroundColor: "{colors.select-soft}"
    textColor: "{colors.tertiary-deep}"
    rounded: "{rounded.md}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: 46px
  chip-selected:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
  slot-pending:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.on-amber-soft}"
  slot-confirmed:
    backgroundColor: "{colors.taken}"
    textColor: "{colors.on-taken}"
  slot-blocked:
    backgroundColor: "{colors.blocked}"
    textColor: "{colors.on-blocked}"
  slot-selected:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.primary}"
  time-cell-selected:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
  divider:
    backgroundColor: "{colors.line}"
    textColor: "{colors.primary}"
  notice-error:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
  notice-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
  bank-panel:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
  page-note:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.muted}"
---

## Overview

여성문화센터가 공간을 빌려주는 대관 사업의 예약 창구다. 숙박, 공간 예약 앱처럼 밝고 또렷하게 보이되, 돈을 입금하는 화면이므로 정보와 위계는 업무용 수준으로 정돈한다. 첫 화면이 곧 첫 질문이다. 소개 문구, 히어로 이미지, 그라데이션은 넣지 않는다. 예약은 날짜, 공간, 시간, 인원, 예약자, 확인의 6단계이고 입금 안내가 7번째 화면이다. 모바일은 한 열, 1000px 이상 화면은 왼쪽에 작업 영역, 오른쪽에 내 예약 요약과 시간별 현황을 둔다. 주 사용자는 40대에서 70대 여성이므로 글자는 크게, 대비는 높게 잡는다.

이 파일이 디자인의 원본이다. `public/tokens.css`는 이 파일에서 자동으로 만들어지고, 색과 모서리, 글자, 주요 구성요소의 값은 여기서만 바꾼다. 바꾼 뒤 `npm run design`을 실행하고 `npm test`로 대비 기준을 확인한다.

## Colors

바탕은 따뜻한 화이트, 작업 영역은 흰 패널, 주 행동은 코랄 로즈, 포인트는 소프트 옐로다.

- **Primary (#22212A):** 본문과 제목.
- **Secondary (#4D4A55):** 보조 설명. 흰 바탕과 따뜻한 화이트 바탕 모두에서 7:1에 가깝다.
- **Tertiary (#D63A58):** 코랄 로즈. 주 버튼, 선택한 날짜와 시간, 선택 칩, 현재 단계에 쓴다. 흰 글자와 4.5:1을 넘긴다.
- **Tertiary-deep (#B92D48):** 버튼 호버, 선택된 카드의 글자.
- **Neutral (#FAF7F6), Surface (#FFFFFF), Sand (#F5EFEE), Line (#EBE0E1):** 페이지 바탕(웜 화이트), 패널, 패널 머리글과 계좌 박스, 구분선.
- **Amber (#FFC145):** 소프트 옐로. 제목 위 소제목 점, 선택한 날짜 아래 점, 오늘 표시, 시간표 선택 표시처럼 작은 포인트에만 쓴다. 글자색으로는 쓰지 않는다.
- **Taken, Blocked:** 예약 현황 전용. 예약 가능은 흰 칸, 입금 대기는 연한 소프트 옐로, 예약 완료는 진한 회색, 휴무는 연한 회색 단색이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "휴무" 글자를 함께 쓴다.
- **Danger (#B42318):** 오류와 취소 같은 경고에만 쓴다. 주 버튼의 코랄 로즈와 겹치지 않도록 더 어둡게 잡았다.

## Typography

전부 Pretendard Variable이다. 본문은 500 굵기로 얇아 보이지 않게 하고, 제목과 금액은 800이다. 제목 위에는 작은 소제목(eyebrow, `STEP 3 / 6`)을 둔다. 금액과 시간은 숫자 폭이 일정한 `tnum`을 쓴다. 본문 18px 안팎, 보조 글자도 14px 아래로 내리지 않는다.

## Layout

한 단계에 질문 하나, 입력 하나. 제목과 한 줄 설명 아래에 가는 선을 긋고 선택지를 놓는다. 머리글은 흰 바탕에 아래 선이 있고, 1000px 이상에서는 그 안에 단계 탭(날짜, 공간, 시간, 인원, 예약자, 확인)과 대관 문의 전화를 둔다. 아래 버튼 영역은 흰 바탕에 위쪽 선이 있고, 1000px 이상에서는 버튼을 오른쪽에 붙인다. 내용이 한 화면보다 길 때만 가운데가 스크롤된다. 간격은 4px 단위만 쓴다. 터치 대상은 높이 44px 이상이다.

## Elevation & Depth

층은 선과 아주 옅은 그림자 한 단계로만 만든다. 패널은 1px 선과 옅은 그림자, 선택된 카드는 2px 코랄 로즈 선이다. 겹침이나 블러 효과는 없다. 단계가 바뀔 때 내용이 8px 올라오며 나타나고, 움직임 줄이기 설정에서는 끈다.

## Shapes

둥글고 부드러운 모서리를 쓴다. 패널 16px, 버튼과 입력칸과 칩 12px, 작은 요소 8px. 선택 표시는 둥근 체크 칸이다.

## Components

- **Header:** 흰 띠와 아래 선. 현재 단계 탭은 코랄 로즈 글자와 아래 선, 완료한 단계는 체크.
- **Button-primary:** 코랄 로즈 바탕, 흰 글자, 높이 54px. 호버는 tertiary-deep.
- **Card, Panel-header:** 흰 패널과 1px 선. 오른쪽 요약 패널의 머리글은 sand 바탕 띠로 표처럼 보이게 한다.
- **Option-selected:** select-soft 바탕, 코랄 로즈 2px 선, 체크.
- **Chip:** 흰 바탕 1px 선. 선택하면 코랄 로즈 채움과 아래 소프트 옐로 선.
- **Slot:** 대기, 확정, 휴무, 선택을 서로 다른 단색으로 구분하고 글자를 함께 쓴다.
- **Bank-panel:** sand 바탕에 큰 숫자 계좌번호와 복사 버튼.

## Do's and Don'ts

- 코랄 로즈는 행동과 선택(버튼, 선택한 날짜, 선택 칩, 현재 단계)에만, 소프트 옐로는 작은 포인트 몇 곳에만 쓴다.
- 줄무늬와 그라데이션을 쓰지 않는다. 그림자는 패널 한 단계만 쓴다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색과 글자를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다. `npm test`가 구성요소의 글자와 바탕 조합을 검사한다.
- 색, 모서리, 글자 크기를 바꿀 때는 이 파일의 토큰을 바꾸고 `npm run design`으로 `public/tokens.css`를 다시 만든다.
