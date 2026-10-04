---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 사업의 예약 사이트. 흰색과 검정이 기본이고, 상태를 알려야 할 때만 눈이 편한 낮은 채도의 색을 쓴다.
colors:
  primary: "#111111"
  secondary: "#3F3F3F"
  tertiary: "#111111"
  tertiary-deep: "#3A3A3A"
  on-tertiary: "#FFFFFF"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  sand: "#F4F4F4"
  line: "#DEDEDE"
  muted: "#666666"
  amber: "#C2A25B"
  amber-soft: "#F7EFD9"
  on-amber-soft: "#5E4A12"
  taken: "#555555"
  on-taken: "#FFFFFF"
  blocked: "#EFEFEF"
  on-blocked: "#555555"
  select-soft: "#F2F2F2"
  danger: "#8A5A0B"
  success: "#3F6F55"
  success-soft: "#E6F0EA"
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

여성문화센터가 공간을 빌려주는 대관 사업의 예약 창구다. 입금까지 이어지는 화면이므로 믿음이 가고 읽기 쉬워야 한다. 기본은 흰 바탕에 검정 글자다. 색은 상태를 알려야 할 때(입금 대기, 확정, 오류)만 쓰고, 장식은 넣지 않는다. 소개 문구, 히어로 이미지, 그라데이션, 단계 소제목, 점과 밑줄이 없다. 예약은 날짜, 공간, 시간, 인원, 예약자, 확인의 6단계이고 입금 안내가 7번째 화면이다. 모바일은 한 열, 1000px 이상 화면은 왼쪽에 작업 영역, 오른쪽에 내 예약 요약과 시간별 현황을 둔다. 주 사용자는 40대에서 70대 여성이므로 글자는 크게, 대비는 높게 잡는다.

이 파일이 디자인의 원본이다. `public/tokens.css`는 이 파일에서 자동으로 만들어지고, 색과 모서리, 글자, 주요 구성요소의 값은 여기서만 바꾼다. 바꾼 뒤 `npm run design`을 실행하고 `npm test`로 대비 기준을 확인한다.

## Colors

화면의 90%는 흰색, 검정, 회색이다. 색은 정보가 있을 때만 들어간다.

- **Primary (#111111):** 본문, 제목, 금액, 주 버튼, 선택한 날짜와 시간.
- **Secondary (#3F3F3F), Muted (#666666):** 보조 설명. 흰 바탕에서 각각 10:1, 5.7:1이다.
- **Tertiary (#111111), Tertiary-deep (#3A3A3A):** 주 버튼과 호버. 별도의 강조색을 두지 않고 검정을 쓴다.
- **Neutral (#FFFFFF), Surface (#FFFFFF), Sand (#F4F4F4), Line (#DEDEDE):** 페이지와 패널, 패널 머리글과 계좌 박스, 구분선. 층은 선으로 만든다.
- **Amber (#C2A25B), Amber-soft (#F7EFD9):** 입금 대기와 안내 띠. 차분한 베이지 계열이다.
- **Success (#3F6F55), Success-soft (#E6F0EA):** 확정 표시. 채도를 낮춘 녹색이다.
- **Danger (#8A5A0B):** 오류, 취소 요청 같은 경고. 채도를 낮춘 황갈색이다. 붉은 계열은 쓰지 않는다.
- **Taken, Blocked:** 예약 현황 전용. 예약 가능은 흰 칸, 입금 대기는 연한 베이지, 예약 완료는 진한 회색, 휴무는 연한 회색 단색이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "휴무" 글자를 함께 쓴다.

## Typography

전부 Pretendard Variable이다. 본문은 500, 제목과 금액은 700이다. 800 이상의 굵기와 글자 사이를 벌린 대문자 소제목은 쓰지 않는다. 금액과 시간은 숫자 폭이 일정한 `tnum`을 쓴다. 본문 18px 안팎, 보조 글자도 14px 아래로 내리지 않는다.

## Layout

한 단계에 질문 하나, 입력 하나. 제목과 한 줄 설명 아래에 가는 선을 긋고 선택지를 놓는다. 머리글은 흰 바탕에 아래 선이 있고, 1000px 이상에서는 그 안에 단계 탭(날짜, 공간, 시간, 인원, 예약자, 확인)과 대관 문의 전화를 둔다. 아래 버튼 영역은 흰 바탕에 위쪽 선이 있고, 1000px 이상에서는 버튼을 오른쪽에 붙인다. 내용이 한 화면보다 길 때만 가운데가 스크롤된다. 간격은 4px 단위만 쓴다. 터치 대상은 높이 44px 이상이다.

## Elevation & Depth

그림자를 쓰지 않는다. 층은 1px 선과 회색 면의 차이로 만든다. 선택된 카드는 2px 검정 선이다. 단계가 바뀔 때는 내용이 부드럽게 나타나기만 하고, 움직임 줄이기 설정에서는 끈다.

## Shapes

작은 모서리를 쓴다. 패널 8px, 버튼과 입력칸과 칩 6px, 작은 요소 4px. 알약 모양은 상태 표시에만 쓴다.

## Components

- **Header:** 흰 띠와 아래 선. 현재 단계 탭은 검정 글자와 아래 선, 완료한 단계는 체크.
- **Button-primary:** 검정 바탕, 흰 글자, 높이 54px. 호버는 tertiary-deep.
- **Card, Panel-header:** 흰 패널과 1px 선. 오른쪽 요약 패널의 머리글은 sand 바탕 띠로 표처럼 보이게 한다.
- **Option-selected:** 연한 회색 바탕, 검정 2px 선, 체크.
- **Chip:** 흰 바탕 1px 선. 선택하면 검정 채움.
- **Slot:** 대기, 확정, 휴무, 선택을 서로 다른 단색으로 구분하고 글자를 함께 쓴다.
- **Bank-panel:** sand 바탕에 큰 숫자 계좌번호와 복사 버튼.

## Do's and Don'ts

- 색은 상태(대기, 확정, 오류)를 알릴 때만 쓴다. 버튼, 제목, 금액에는 쓰지 않는다.
- 그림자, 줄무늬, 그라데이션, 아이콘 장식, 점과 밑줄 같은 꾸밈을 넣지 않는다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색과 글자를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다. `npm test`가 구성요소의 글자와 바탕 조합을 검사한다.
- 색, 모서리, 글자 크기를 바꿀 때는 이 파일의 토큰을 바꾸고 `npm run design`으로 `public/tokens.css`를 다시 만든다.
