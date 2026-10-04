---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 사업의 예약 사이트. 흰 바탕에 어두운 글자, 브랜드와 강조에는 하늘색(#87CEEB) 하나만 쓰는 깔끔한 업무용 화면.
colors:
  primary: "#16222E"
  secondary: "#3B4A59"
  tertiary: "#87CEEB"
  tertiary-deep: "#4FA9D2"
  on-tertiary: "#0E2230"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  sand: "#F2F6F9"
  line: "#DAE3EA"
  muted: "#5A6876"
  amber: "#F2C94C"
  amber-soft: "#FFF4CC"
  on-amber-soft: "#5A4600"
  taken: "#3E5266"
  on-taken: "#FFFFFF"
  blocked: "#EEF2F5"
  on-blocked: "#4A5A6A"
  select-soft: "#E8F5FB"
  danger: "#8A5A0B"
  success: "#1F6B4A"
  success-soft: "#DDF3E8"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.01em
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
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: Pretendard Variable
    fontSize: 0.9rem
    fontWeight: 500
    lineHeight: 1.45
  price-lg:
    fontFamily: Pretendard Variable
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
    fontFeature: tnum
rounded:
  sm: 4px
  md: 6px
  lg: 8px
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
    textColor: "{colors.primary}"
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
    backgroundColor: "{colors.success-soft}"
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

여성문화센터가 공간을 빌려주는 대관 사업의 예약 창구다. 입금까지 이어지는 화면이므로 믿음이 가고 읽기 쉬워야 한다. 기본은 흰 바탕에 어두운 글자이고, 브랜드와 강조에는 하늘색 한 가지만 쓴다. 상태를 알려야 할 때만 낮은 채도의 보조색을 더한다. 소개 문구, 히어로 이미지, 그라데이션, 단계 소제목, 점과 밑줄 같은 장식은 넣지 않는다. 예약은 날짜, 공간, 시간, 인원, 예약자, 확인의 6단계이고 입금 안내가 7번째 화면이다. 모바일은 한 열, 1000px 이상 화면은 왼쪽에 작업 영역, 오른쪽에 내 예약 요약과 시간별 현황을 둔다. 주 사용자는 40대에서 70대 여성이므로 글자는 크게, 대비는 높게 잡는다.

이 파일이 디자인의 원본이다. `public/tokens.css`는 이 파일에서 자동으로 만들어지고, 색과 모서리, 글자, 주요 구성요소의 값은 여기서만 바꾼다. 바꾼 뒤 `npm run design`을 실행하고 `npm test`로 대비 기준을 확인한다.

## Colors

바탕은 흰색, 글자는 어두운 색, 브랜드와 강조는 하늘색이다.

- **Tertiary (#87CEEB):** 하늘색. 브랜드 색이고 주 버튼, 선택한 날짜와 시간, 선택 칩, 현재 단계, 진행 막대에 쓴다. 밝은 색이라 흰 글자가 읽히지 않으므로 그 위의 글자는 항상 `on-tertiary`(어두운 색)다. 하늘색 글씨는 흰 바탕에서 읽기 어려워 쓰지 않는다.
- **Tertiary-deep (#4FA9D2):** 하늘색보다 한 단계 진한 톤. 버튼 호버, 선택된 카드의 테두리, 입력 포커스 선에만 쓴다.
- **Primary (#16222E), Secondary (#3B4A59), Muted (#5A6876):** 본문과 제목, 보조 설명. 하늘색과 잘 어울리는 푸른 기가 도는 짙은 잉크색이고, 흰 바탕에서 각각 16:1, 9:1, 6:1이다.
- **Neutral (#FFFFFF), Surface (#FFFFFF), Sand (#F2F6F9), Line (#DAE3EA):** 페이지와 패널, 패널 머리글과 계좌 박스, 구분선. 층은 선으로 만든다.
- **Select-soft (#E8F5FB):** 선택된 카드와 시간 범위의 옅은 하늘색 바탕.
- **Amber (#F2C94C), Amber-soft (#FFF4CC):** 버터 옐로. 하늘색과 짝을 이루는 따뜻한 색으로, 입금 대기, 안내 띠, 오늘 표시에 쓴다. 글자색으로는 쓰지 않는다.
- **Success (#1F6B4A), Success-soft (#DDF3E8):** 확정 표시. 하늘색과 어울리는 맑은 민트 계열의 녹색이다.
- **Danger (#8A5A0B):** 오류와 경고. 채도를 낮춘 황갈색이다. 붉은 계열은 쓰지 않는다.
- **Taken, Blocked:** 예약 현황 전용. 예약 가능은 흰 칸, 입금 대기는 연한 버터 옐로, 예약 완료는 푸른 기가 도는 진한 슬레이트, 휴무는 연한 회색 단색이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "휴무" 글자를 함께 쓴다.

## Typography

전부 Pretendard Variable이다. 본문은 500, 제목과 금액은 700이다. 800 이상의 굵기와 글자 사이를 벌린 대문자 소제목은 쓰지 않는다. 금액과 시간은 숫자 폭이 일정한 `tnum`을 쓴다. 본문 18px 안팎, 보조 글자도 14px 아래로 내리지 않는다.

## Layout

한 단계에 질문 하나, 입력 하나. 제목과 한 줄 설명 아래에 가는 선을 긋고 선택지를 놓는다. 머리글은 흰 바탕에 아래 선이 있고, 1000px 이상에서는 그 안에 단계 탭(날짜, 공간, 시간, 인원, 예약자, 확인)과 대관 문의 전화를 둔다. 아래 버튼 영역은 흰 바탕에 위쪽 선이 있고, 1000px 이상에서는 버튼을 오른쪽에 붙인다. 내용이 한 화면보다 길 때만 가운데가 스크롤된다. 간격은 4px 단위만 쓴다. 터치 대상은 높이 44px 이상이다.

## Elevation & Depth

그림자를 쓰지 않는다. 층은 1px 선과 옅은 면의 차이로 만든다. 선택된 카드는 2px 하늘색 선이다. 단계가 바뀔 때는 내용이 부드럽게 나타나기만 하고, 움직임 줄이기 설정에서는 끈다.

## Shapes

작은 모서리를 쓴다. 패널 8px, 버튼과 입력칸과 칩 6px, 작은 요소 4px. 알약 모양은 상태 표시에만 쓴다.

## Components

- **Header:** 흰 띠와 아래 선. 로고는 하늘색 바탕 위의 "여성"과 어두운 "문화센터". 현재 단계 탭은 어두운 글자와 하늘색 아래 선, 완료한 단계는 체크.
- **Button-primary:** 하늘색 바탕, 어두운 글자, 높이 54px. 호버는 tertiary-deep.
- **Card, Panel-header:** 흰 패널과 1px 선. 오른쪽 요약 패널의 머리글은 sand 바탕 띠로 표처럼 보이게 한다.
- **Option-selected:** select-soft 바탕, 하늘색 2px 선, 체크.
- **Chip:** 흰 바탕 1px 선. 선택하면 하늘색 채움에 어두운 글자.
- **Slot:** 대기, 확정, 휴무, 선택을 서로 다른 단색으로 구분하고 글자를 함께 쓴다.
- **Bank-panel:** sand 바탕에 큰 숫자 계좌번호와 복사 버튼.

## Do's and Don'ts

- 하늘색은 브랜드와 행동, 선택에만 쓴다. 하늘색 위에는 어두운 글자만 올린다.
- 그림자, 줄무늬, 그라데이션, 아이콘 장식, 점과 밑줄 같은 꾸밈을 넣지 않는다.
- 붉은 계열 색을 쓰지 않는다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색과 글자를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다. `npm test`가 구성요소의 글자와 바탕 조합을 검사한다.
- 색, 모서리, 글자 크기를 바꿀 때는 이 파일의 토큰을 바꾸고 `npm run design`으로 `public/tokens.css`를 다시 만든다.
