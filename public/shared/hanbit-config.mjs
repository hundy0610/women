// 한빛커뮤니티 소모임 신청 설정. 구조는 마두 소모임(crew-config.mjs)과 같고, 프로그램과 이름, 색만 다릅니다.
// 같은 이름의 소모임이 여러 지역에 있어도 한 장의 카드로 묶고 모든 요일·시간을 보여 줍니다(지역 이름은 화면에 나오지 않습니다).
// 요일: 0=일 1=월 2=화 3=수 4=목 5=금 6=토.
import { CREW } from './crew-config.mjs';

// 요일 목록 x 시간 목록 -> 슬롯
const at = (days, times) => days.flatMap((weekday) => times.map((time) => ({ weekday, time })));
const MON_FRI = [1, 2, 3, 4, 5];

export const HANBIT = {
  ...CREW,
  id: 'hanbit',
  ns: 'hb:',
  api: '/api/hanbit',
  storageKey: 'hanbit:last',
  photoDir: 'hanbit',
  homeUrl: '',                 // 한빛커뮤니티는 소모임 전용 포털이라 첫 화면이 곧 목록입니다
  envPrefix: 'HANBIT_',        // HANBIT_BANK_NAME / HANBIT_BANK_NUMBER / HANBIT_BANK_HOLDER / HANBIT_CONTACT_PHONE (없으면 공용 값)
  brand: '한빛커뮤니티',
  smsHead: '[한빛커뮤니티]',
  notifyLabel: '한빛',
  center: { id: 'hanbit' },
  address: '경기 고양시 덕양구 화신로 273 명지프라자 8층',   // 소모임을 하는 곳(오시는 길, 신청 확인, 문자에 나옵니다)
  searchable: true,            // 소모임이 많아서 이름 검색 칸을 보여 줍니다

  // 프로그램. flexible: true 는 정해진 요일·시간이 없어서 신청 대신 문의 안내를 보여 줍니다.
  programs: [
    { id: 'poem', name: '시 쓰기', note: '마음을 시로 적어 보는 시간', slots: at([5], ['11:00']) },
    { id: 'knot', name: '매듭', note: '전통 매듭으로 소품을 만들어요',
      slots: [...at([2, 4], ['13:00']), ...at([6], ['12:00']), ...at(MON_FRI, ['11:00', '14:00'])] },
    { id: 'harmonica', name: '하모니카', note: '쉬운 곡부터 함께 불어요', slots: at([2], ['11:00']) },
    { id: 'calli', name: '캘리그라피', note: '붓펜으로 쓰는 예쁜 글씨', slots: [...at([1, 4], ['14:30']), ...at([2, 6], ['13:00'])] },
    { id: 'doll', name: '인형공예', note: '손으로 만드는 작은 인형', slots: at([2], ['11:00', '13:00']) },
    { id: 'knit', name: '뜨개', note: '실과 바늘로 소품을 함께 떠요', slots: [...at([2, 4], ['11:00', '13:00']), ...at([6], ['11:00'])] },
    { id: 'urban', name: '어반스케치', note: '일상의 풍경을 가볍게 그려요', slots: at([2, 5], ['12:00']) },
    { id: 'ihyeol', name: '이혈', note: '귀 건강 관리법 배우기', slots: [...at([1], ['11:00']), ...at([6], ['14:00']), ...at([2], ['12:00'])] },
    { id: 'drum', name: '드럼', note: '리듬을 몸으로 익혀요', slots: at([2], ['12:00', '13:00', '14:00', '15:00']) },
    { id: 'drawing', name: '드로잉', note: '자유롭게 선으로 표현해요', slots: [...at([5], ['19:00']), ...at([6], ['14:00'])] },
    { id: 'handdrip', name: '핸드드립', note: '향긋한 커피를 직접 내려요', slots: at([6], ['15:00']) },
    { id: 'japanese', name: '일본어', note: '기초 회화부터 차근차근', slots: at([6], ['13:00']) },
    { id: 'macrame', name: '마크라메', note: '매듭으로 만드는 장식', slots: at([6], ['14:00']) },
    { id: 'embroidery', name: '프랑스자수', note: '한 땀 한 땀 수놓는 시간', slots: at([2], ['11:00']) },
    { id: 'orda', name: '오르다게임', note: '보드게임으로 두뇌 운동', slots: at([2], ['11:00']) },
    { id: 'flute', name: '플롯', note: '맑은 소리의 악기 배우기', slots: at([2], ['11:00']) },
    { id: 'guitar', name: '기타', note: '코드부터 쉽게 시작해요', slots: at([6], ['13:00']) },
    { id: 'violin', name: '바이올린', note: '일정은 문의 후 정해요', flexible: true, slots: [] },
  ],
};
