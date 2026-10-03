---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 예약 사이트. 따뜻한 종이 질감의 배경, 짙은 갈색 글자, 번트 시에나 한 가지 강조색.
colors:
  primary: "#2B211B"
  secondary: "#65534A"
  tertiary: "#B4461F"
  tertiary-deep: "#8E3416"
  on-tertiary: "#FFFFFF"
  neutral: "#FAF6EF"
  surface: "#FFFFFF"
  sand: "#F2E8D8"
  line: "#E4D6C0"
  muted: "#7A6656"
  amber: "#E6A23C"
  amber-soft: "#FBEBCF"
  on-amber-soft: "#6A4410"
  taken: "#D9C6A5"
  on-taken: "#4B3B2A"
  blocked: "#EEE6DA"
  on-blocked: "#6F5E4F"
  danger: "#B3261E"
  success: "#3F7A55"
typography:
  display:
    fontFamily: Gowun Batang
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.25
  h2:
    fontFamily: Gowun Batang
    fontSize: 1.35rem
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: Pretendard Variable
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1.4
  price-lg:
    fontFamily: Pretendard Variable
    fontSize: 2.25rem
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
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-tertiary}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-muted-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  space-card-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
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

종이와 원목에서 가져온 따뜻한 톤의 예약 도구다. 첫 화면이 곧 예약 화면이다. 소개 문구, 히어로 이미지, 그라데이션은 넣지 않는다. 날짜, 공간, 시간, 요금이 순서대로 보이고 오른쪽(모바일은 아래)에 합계와 입금 계좌가 있다.

## Colors

색은 중립 톤과 강조색 한 가지로 정리한다.

- **Primary (#2B211B):** 본문과 제목의 짙은 갈색.
- **Secondary (#65534A):** 보조 설명. 흰 바탕과 아이보리 바탕 모두에서 4.5:1을 넘긴다.
- **Tertiary (#B4461F):** 번트 시에나. 선택 상태, 주 버튼, 합계 금액에만 쓴다.
- **Neutral (#FAF6EF):** 페이지 바탕.
- **Amber, Taken, Blocked:** 예약 현황 전용. 입금 대기는 앰버 줄무늬, 예약 완료는 탁한 모래색, 이용 불가는 빗금이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "불가" 글자를 함께 쓴다.

## Typography

제목은 고운바탕, 나머지는 Pretendard Variable이다. 금액과 시간은 숫자 폭이 일정한 `tnum`을 쓴다. 본문은 17px 이상, 보조 글자도 15px 아래로 내리지 않는다.

## Layout

최대 폭 1160px. 데스크톱은 본문 열과 380px 요약 열의 2단, 980px 이하는 1단이고 합계와 예약 버튼이 화면 아래에 고정된다. 간격은 4px 단위(4, 8, 16, 24, 40)만 쓴다. 터치 대상은 높이 44px 이상이다.

## Elevation & Depth

카드에만 아주 옅은 따뜻한 그림자를 쓴다. 겹침이나 블러 효과는 없다. 대화상자는 어두운 갈색 반투명 배경 위에 뜬다.

## Shapes

카드 16px, 버튼과 입력칸 12px, 작은 요소 8px, 알약형 칩 999px.

## Components

주 버튼은 tertiary 바탕에 흰 글자, 호버 시 tertiary-deep. 선택된 공간 카드는 tertiary 2px 테두리와 체크 표시. 시간 칩은 선택 시 tertiary 채움. 입금 계좌는 sand 바탕 패널에 큰 숫자와 복사 버튼.

## Do's and Don'ts

- 선택, 주 버튼, 합계에만 tertiary를 쓴다. 다른 곳에 쓰지 않는다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 굵은 글씨는 라벨과 금액에만 쓴다.
- 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색, 글자, 무늬를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다.
