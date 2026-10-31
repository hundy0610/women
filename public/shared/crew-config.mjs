// 소모임(동아리) 신청 설정. 화면(/crew)과 서버(api/crew*.js)가 같은 값을 씁니다.
// 요일: 0=일 ... 6=토. 프로그램이나 시간이 바뀌면 이 파일만 고치면 됩니다.
export const CREW = {
  center: { id: 'madu' },
  brand: '드림 문화센터',

  fee: 10000,            // 한 달 참가비(원)
  periodMonths: 1,       // 한 번 신청하면 이용하는 기간(개월)
  holdHours: 24,         // 신청 후 입금 기한
  leadDays: 1,           // 시작일은 오늘로부터 최소 N일 뒤
  horizonDays: 60,       // 시작일은 오늘로부터 최대 N일 뒤까지
  expiringDays: 7,       // 이용 기간이 끝나기 N일 전부터 "곧 만료"로 표시
  capacity: 10,          // 요일·시간 칸 하나당 동시에 받을 수 있는 신청 수

  // 신청 전에 보여 주고 체크로 동의받는 안내문
  policy: [
    '한 달 참가비는 10,000원이에요. 신청하신 시작일을 기준으로 한 달간 이용해요.',
    '신청하고 당일에 연락 없이 나오지 않으면(노쇼) 환불되지 않아요.',
    '한 달이 지나면 연장 입금 안내를 드려요. 입금하시면 이어서 한 달 더 이용할 수 있어요.',
  ],

  // 부녀회 안의 부서(지역) 이름은 홈페이지와 문자에 보이지 않습니다. programs의 dept는 담당자 참고용입니다.

  // 프로그램(소모임). slots의 time은 "HH:MM". capacity를 적으면 그 프로그램만 정원이 달라집니다.
  programs: [
    { id: 'knit', dept: 'jabi', name: '뜨개', icon: 'sparkle', note: '실과 바늘로 소품을 함께 떠요',
      slots: [{ weekday: 4, time: '11:00' }, { weekday: 4, time: '14:00' }, { weekday: 5, time: '11:00' }] },
    { id: 'soap', dept: 'jabi', name: '비누공예', icon: 'sparkle', note: '천연 비누를 직접 만들어요',
      slots: [{ weekday: 2, time: '11:00' }] },
    { id: 'stocking', dept: 'jabi', name: '스타킹', icon: 'sparkle', note: '스타킹으로 만드는 생활 소품',
      slots: [{ weekday: 2, time: '14:00' }] },
    { id: 'tarot', dept: 'jihye', name: '타로', icon: 'sparkle', note: '카드로 나누는 이야기',
      slots: [{ weekday: 4, time: '11:00' }] },
    { id: 'ihyeol', dept: 'jihye', name: '이혈', icon: 'sparkle', note: '귀 건강 관리법 배우기',
      slots: [{ weekday: 2, time: '12:00' }] },
    { id: 'talk', dept: 'uae', name: '소통', icon: 'sparkle', note: '저녁에 모여 이야기 나누는 모임',
      slots: [{ weekday: 4, time: '19:30' }] },
  ],
};

export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export const slotId = (programId, s) => `${programId}-${s.weekday}-${s.time.replace(':', '')}`;

// 프로그램과 요일·시간 칸을 한 목록으로 펼칩니다.
export function allSlots(cfg = CREW) {
  const out = [];
  for (const p of cfg.programs) {
    for (const s of p.slots) {
      out.push({ id: slotId(p.id, s), programId: p.id, weekday: s.weekday, time: s.time, capacity: p.capacity ?? cfg.capacity });
    }
  }
  return out;
}

export const findProgram = (id, cfg = CREW) => cfg.programs.find((p) => p.id === id) || null;
export const findSlot = (id, cfg = CREW) => allSlots(cfg).find((s) => s.id === id) || null;
