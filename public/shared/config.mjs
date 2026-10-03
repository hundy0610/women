// 요금, 운영 시간, 휴무 요일은 이 파일 하나에서 바꿉니다. 화면과 서버가 같은 값을 씁니다.
export const CONFIG = {
  siteName: '여성문화센터 대관 예약',
  address: '고양시 일산동구 강석로 149 강촌프라자 2층',
  access: '마두역(3호선) 도보 3~5분',
  placeName: '강촌프라자',   // 네이버 지도 검색에 함께 쓰는 건물 이름

  openHour: 9,          // 09:00부터
  closeHour: 21,        // 21:00까지 (마지막 종료 시각)
  minHours: 2,          // 최소 이용 시간
  dayHours: 8,          // 이 시간 이상이면 1일 요금 기준
  minLeadHours: 24,     // 이용 시작 24시간 전까지 예약
  holdHours: 24,        // 예약 후 입금 기한
  horizonDays: 90,      // 오늘부터 90일 뒤까지 예약

  photoPlaceholders: true,   // 실제 사진이 없는 공간에 "사진 준비 중" 자리표시를 보여 줍니다. 사진을 다 넣으면 false로 바꿉니다.

  overagePerPerson: 10000,   // 최대 수용 인원을 넘는 1인당 추가 요금
  packageDayPrice: 700000,   // 5개 공간 전체 1일(8시간) 요금

  spaces: [
    { id: 'lobby', name: '로비', pyeong: 23.3, dims: '7m × 11m', capacity: 50, layout: '스탠딩',
      hourly: 30000, daily: 200000, note: '원목 테이블과 벤치, 트랙 조명, 전시 월' },
    { id: 'seminar', name: '세미나실', pyeong: 38.1, dims: '9m × 14m', capacity: 60, layout: '좌식',
      hourly: 30000, daily: 200000, note: '강연, 해설, 워크숍용 가장 넓은 공간' },
    { id: 'room1', name: '방1', pyeong: 9.7, dims: '4m × 8m', capacity: 12, layout: '',
      hourly: 20000, daily: 130000, note: '유리 파티션 독립 공간, 트랙 조명' },
    { id: 'room2', name: '방2', pyeong: 9.7, dims: '4m × 8m', capacity: 12, layout: '',
      hourly: 20000, daily: 130000, note: '유리 파티션 독립 공간, 트랙 조명' },
    { id: 'room3', name: '방3', pyeong: 9.7, dims: '4m × 8m', capacity: 12, layout: '',
      hourly: 20000, daily: 130000, note: '유리 파티션 독립 공간, 트랙 조명' },
  ],

  // 예약을 받지 않는 날. weekday: 0=일 ... 6=토. spaces, from, to를 쓰면 일부 공간·시간만 막습니다.
  blockedRules: [
    { weekday: 0, label: '휴무' },
    { weekday: 3, label: '휴무' },
  ],
  // 특정 날짜 휴관. 예: { date: '2026-12-25', label: '휴관' }
  blockedDates: [],
};
