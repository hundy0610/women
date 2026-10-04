---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 사업의 예약 사이트. 흰 바탕에 깊은 인디고 글자, 브랜드와 강조에는 더스티 바이올렛 하나, 짝으로 버터 옐로를 쓰는 차분한 업무용 화면.
colors:
  primary: "#2F2B4A"
  secondary: "#4C4868"
  tertiary: "#6B5CA5"
  tertiary-deep: "#53468A"
  on-tertiary: "#FFFFFF"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  sand: "#F4F2F8"
  line: "#E3DFEC"
  muted: "#626080"
  amber: "#F2C94C"
  amber-soft: "#FFF4CC"
  on-amber-soft: "#5A4600"
  taken: "#5A5480"
  on-taken: "#FFFFFF"
  blocked: "#F0EEF4"
  on-blocked: "#5A5675"
  select-soft: "#EFEBF8"
  danger: "#7A5A00"
  success: "#4B3F8A"
  success-soft: "#E9E4F7"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 1.625rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  title:
    fontFamily: Pretendard Variable
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.01em
  body:
    fontFamily: Pretendard Variable
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.005em
  label:
    fontFamily: Pretendard Variable
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
  body-sm:
    fontFamily: Pretendard Variable
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Pretendard Variable
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.45
  price:
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
    typography: "{typography.label}"
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

여성문화센터가 공간을 빌려주는 대관 사업의 예약 창구다. 입금까지 이어지는 화면이므로 믿음이 가고 읽기 쉬워야 한다. 기본은 흰 바탕에 어두운 글자이고, 브랜드와 강조에는 바이올렛 한 가지만 쓴다. 상태를 알려야 할 때만 낮은 채도의 보조색을 더한다. 소개 문구, 히어로 이미지, 그라데이션, 단계 소제목, 점과 밑줄 같은 장식은 넣지 않는다. 예약은 날짜, 공간, 시간, 인원, 예약자, 확인의 6단계이고 입금 안내가 7번째 화면이다. 모바일은 한 열, 1000px 이상 화면은 왼쪽에 작업 영역, 오른쪽에 내 예약 요약과 시간별 현황을 둔다. 주 사용자는 40대에서 70대 여성이므로 글자는 크게, 대비는 높게 잡는다.

이 파일이 디자인의 원본이다. `public/tokens.css`는 이 파일에서 자동으로 만들어지고, 색과 모서리, 글자, 주요 구성요소의 값은 여기서만 바꾼다. 바꾼 뒤 `npm run design`을 실행하고 `npm test`로 대비 기준을 확인한다.

## Colors

바탕은 흰색, 글자는 깊은 인디고, 브랜드와 강조는 더스티 바이올렛이다. 짝이 되는 색은 버터 옐로 하나뿐이다. 검정, 붉은 계열, 녹색, 바이올렛은 쓰지 않는다. 채도를 낮춰 눈이 편하다.

- **Tertiary (#6B5CA5):** 더스티 바이올렛. 브랜드 색이고 주 버튼, 선택한 날짜와 시간, 선택 칩, 현재 단계, 진행 막대에 쓴다. 흰 글자와 5.7:1이다.
- **Tertiary-deep (#53468A):** 한 단계 진한 톤. 버튼 호버, 버튼과 선택 칩의 테두리, 선택된 카드의 테두리, 입력 포커스 선에 쓴다.
- **Primary (#2F2B4A), Secondary (#4C4868), Muted (#626080):** 본문과 제목, 보조 설명. 보랏빛이 도는 깊은 인디고로, 흰 바탕에서 각각 14:1, 9:1, 6:1이다.
- **Neutral (#FFFFFF), Surface (#FFFFFF), Sand (#F4F2F8), Line (#E3DFEC):** 페이지와 패널, 패널 머리글과 계좌 박스, 구분선. 층은 선으로 만든다.
- **Select-soft (#EFEBF8):** 선택된 카드와 시간 범위의 옅은 라일락 바탕.
- **Amber (#F2C94C), Amber-soft (#FFF4CC), On-amber-soft (#5A4600):** 버터 옐로. 바이올렛과 짝을 이루는 따뜻한 색으로, 입금 대기, 안내 띠, 오늘 표시에 쓴다. 글자색으로는 쓰지 않는다.
- **Success (#4B3F8A), Success-soft (#E9E4F7):** 확정 표시. 바이올렛 계열이라 따로 녹색을 쓰지 않는다.
- **Danger (#7A5A00):** 오류와 경고 글자. 옐로 계열의 진한 황갈색으로, 안내 띠 위에서 쓴다.
- **Taken, Blocked:** 예약 현황 전용. 예약 가능은 흰 칸, 입금 대기는 연한 버터 옐로, 예약 완료는 진한 슬레이트 바이올렛(#5A5480), 휴무는 연한 회색 단색이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "휴무" 글자를 함께 쓴다.

## Typography

Pretendard Variable 한 가지 글꼴을 쓴다. 글자 크기는 7단계, 굵기는 400, 600, 700 세 가지로 제한한다. 단계가 많으면 화면이 어수선해 보이므로 새 크기를 추가하지 않는다.

| 단계 | 크기 | 굵기 | 쓰는 곳 |
| --- | --- | --- | --- |
| display | 29px | 700 | 단계 제목 |
| title | 22px | 600 | 패널 제목, 큰 이름 |
| body | 18px | 400 | 본문, 안내 문장 |
| label | 18px | 600 | 이름, 라벨, 버튼 |
| body-sm | 16px | 400 | 보조 설명, 메타 정보 |
| caption | 15px | 400 | 범례, 표의 작은 글자 |
| price | 36px | 700 | 합계 금액 |

- 제목은 글자 사이를 조금 좁히고(-0.02em), 본문은 줄 간격을 1.6으로 넉넉히 둔다. 제목은 `text-wrap: balance`로 줄바꿈을 고르게 한다.
- 굵은 글씨는 이름, 라벨, 금액에만 쓴다. 가격표나 설명 문장 전체를 굵게 하지 않는다.
- 금액, 시간, 번호는 숫자 폭이 일정한 `tnum`을 쓴다.
- 14px 미만은 쓰지 않는다. 기준 글자(1rem)는 18px이다. 한 화면에서 서로 다른 글자 크기는 4가지 이하로 유지한다.

## Layout

한 단계에 질문 하나, 입력 하나. 제목과 한 줄 설명 아래에 가는 선을 긋고 선택지를 놓는다. 머리글은 흰 바탕에 아래 선이 있고, 1000px 이상에서는 그 안에 단계 탭(날짜, 공간, 시간, 인원, 예약자, 확인)과 대관 문의 전화를 둔다. 아래 버튼 영역은 흰 바탕에 위쪽 선이 있고, 1000px 이상에서는 버튼을 오른쪽에 붙인다. 내용이 한 화면보다 길 때만 가운데가 스크롤된다. 간격은 4px 단위만 쓴다. 터치 대상은 높이 44px 이상이다.

## Elevation & Depth

그림자를 쓰지 않는다. 층은 1px 선과 옅은 면의 차이로 만든다. 선택된 카드는 2px 바이올렛 선이다. 단계가 바뀔 때는 내용이 부드럽게 나타나기만 하고, 움직임 줄이기 설정에서는 끈다.

## Shapes

작은 모서리를 쓴다. 패널 8px, 버튼과 입력칸과 칩 6px, 작은 요소 4px. 알약 모양은 상태 표시에만 쓴다.

## Components

- **Header:** 흰 띠와 아래 선. 로고는 연한 라일락 형광펜 띠 위의 "여성문화센터"(인디고 글자). 현재 단계 탭은 인디고 글자와 바이올렛 아래 선, 완료한 단계는 체크.
- **Button-primary:** 바이올렛 바탕, 흰 글자, 높이 54px. 호버는 tertiary-deep.
- **Card, Panel-header:** 흰 패널과 1px 선. 오른쪽 요약 패널의 머리글은 sand 바탕 띠로 표처럼 보이게 한다.
- **Option-selected:** select-soft 바탕, 바이올렛 2px 선, 체크.
- **Chip:** 흰 바탕 1px 선. 선택하면 바이올렛 채움에 흰 글자.
- **Slot:** 대기, 확정, 휴무, 선택을 서로 다른 단색으로 구분하고 글자를 함께 쓴다.
- **Bank-panel:** sand 바탕에 큰 숫자 계좌번호와 복사 버튼.

## Do's and Don'ts

- 바이올렛은 브랜드와 행동, 선택에만 쓴다. 바이올렛 면 위에는 흰 글자만 올린다.
- 그림자, 줄무늬, 그라데이션, 아이콘 장식, 점과 밑줄 같은 꾸밈을 넣지 않는다.
- 검정, 붉은 계열, 녹색을 쓰지 않는다. 글자는 깊은 인디고, 포인트는 바이올렛과 버터 옐로 두 가지로 한정한다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색과 글자를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다. `npm test`가 구성요소의 글자와 바탕 조합을 검사한다.
- 색, 모서리, 글자 크기를 바꿀 때는 이 파일의 토큰을 바꾸고 `npm run design`으로 `public/tokens.css`를 다시 만든다.
