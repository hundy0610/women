---
version: alpha
name: Women Center Booking
description: 여성문화센터 대관 예약 사이트. 스톤 아이보리 바탕, 짙은 잉크색 글자, 딥 네이비 한 가지 강조색, 골드 보조색. 한 화면에 질문 하나씩 묻는 단계형 예약.
colors:
  primary: "#16202B"
  secondary: "#3B4856"
  tertiary: "#1E3A5F"
  tertiary-deep: "#132A47"
  on-tertiary: "#FFFFFF"
  neutral: "#EFEDE8"
  surface: "#FFFFFF"
  sand: "#E4E1D9"
  line: "#CBC7BD"
  muted: "#566370"
  amber: "#C79A3E"
  amber-soft: "#F3E5C0"
  on-amber-soft: "#5A4010"
  taken: "#66717D"
  on-taken: "#FFFFFF"
  blocked: "#E3E1DA"
  on-blocked: "#4C5762"
  select-soft: "#DCE6F2"
  danger: "#B3261E"
  success: "#2B6A4F"
typography:
  display:
    fontFamily: Pretendard Variable
    fontSize: 1.75rem
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: -0.02em
  h2:
    fontFamily: Pretendard Variable
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: Pretendard Variable
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: Pretendard Variable
    fontSize: 1rem
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
  md: 14px
  lg: 20px
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
    height: 56px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-tertiary}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 20px
  card-muted-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  option-selected:
    backgroundColor: "{colors.select-soft}"
    textColor: "{colors.tertiary-deep}"
    rounded: "{rounded.md}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: 48px
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
    padding: 20px
  page-note:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.muted}"
---

## Overview

한 화면에 질문 하나만 묻는 단계형 예약 도구다. 날짜, 공간, 시간, 인원, 예약자, 확인, 입금 안내의 7단계로 이어지고, 위쪽 진행 막대가 현재 위치를 보여 준다. 첫 화면이 곧 첫 질문이다. 소개 문구, 히어로 이미지, 그라데이션은 넣지 않는다. 모바일은 한 열 520px 이하다. 1000px 이상 화면에서는 왼쪽에 단계 화면, 오른쪽에 내 예약 요약과 5개 공간의 시간별 현황을 붙여 둔다.

## Colors

색은 중립 톤과 강조색 한 가지로 정리한다.

- **Primary (#16202B):** 본문과 제목의 짙은 잉크색.
- **Secondary (#3B4856):** 보조 설명. 흰 바탕과 스톤 아이보리 바탕 모두에서 4.5:1을 넘긴다.
- **Tertiary (#1E3A5F):** 딥 네이비. 선택 상태, 주 버튼, 진행 막대에만 쓴다.
- **Neutral (#EFEDE8):** 페이지 바탕.
- **Amber (#C79A3E):** 골드. 입금 대기 칸, 내가 고른 시간 표시, 오늘 표시에 쓴다.
- **Taken, Blocked:** 예약 현황 전용. 예약 가능은 흰 칸, 입금 대기는 골드 줄무늬, 예약 완료는 진한 초록, 휴무는 회색 빗금이다. 색만으로 구분하지 않고 칸 안에 "대기", "예약", "불가" 글자를 함께 쓴다.

## Typography

전부 Pretendard Variable이다. 제목은 28px 굵게, 본문은 18px이다. 금액과 시간은 숫자 폭이 일정한 `tnum`을 쓴다. 보조 글자도 15px 아래로 내리지 않는다.

## Layout

한 단계에 질문 하나, 입력 하나. 제목과 한 줄 설명이 위에 있고, 선택지가 아래에 크게 놓인다. 다음 버튼은 화면 아래에 붙어 있고 입력이 끝나기 전에는 비활성이다. 3단계부터는 버튼 위에 고른 날짜, 공간, 예상 요금을 한 줄로 보여 준다. 간격은 4px 단위(4, 8, 16, 24, 40)만 쓴다. 터치 대상은 높이 48px 이상이다.

## Elevation & Depth

카드에만 아주 옅은 그림자를 쓴다. 겹침이나 블러 효과는 없다. 단계가 바뀔 때 내용이 아래에서 8px 올라오며 나타나고, 움직임 줄이기 설정에서는 끈다.

## Shapes

카드 20px, 버튼과 입력칸 14px, 작은 요소 8px, 알약형 칩 999px.

## Components

주 버튼은 tertiary 바탕에 흰 글자, 호버 시 tertiary-deep. 선택된 옵션은 select-soft 바탕에 tertiary 2px 테두리와 체크 표시. 시간 칩은 선택 시 tertiary 채움. 입금 계좌는 sand 바탕 패널에 큰 숫자와 복사 버튼.

## Do's and Don'ts

- 선택, 주 버튼, 진행 막대에만 tertiary를 쓴다. 다른 곳에 쓰지 않는다.
- 화면 문구는 사실과 숫자로 쓴다. 느낌표, 이모지, "편리하게", "한눈에" 같은 말은 쓰지 않는다.
- 제목 앞에 이모지를 붙이지 않는다. 굵은 글씨는 라벨과 금액에만 쓴다.
- 긴 줄표(—)를 화면 문구에 쓰지 않는다.
- 상태는 색, 글자, 무늬를 함께 쓴다. 색 하나로만 구분하지 않는다.
- 모든 글자 조합은 WCAG AA 4.5:1 이상을 유지한다.
