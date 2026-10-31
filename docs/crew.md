# 소모임(동아리) 신청 (/crew)

- 신청 화면: `/crew`, 관리: `/admin` 의 "예약 관리"에서 장소대관과 소모임을 함께 봅니다(위쪽 분류로 전체/장소대관/소모임). 소모임 직접 등록은 "직접 등록" 탭, 이력은 "이력" 탭, CSV는 "설정" 탭에서 합니다. `/crew-admin`은 그쪽으로 옮겨 줍니다
- 흐름: 소모임 고르기 → 요일·시간과 시작일(달력) → 신청자 정보 → 확인·동의 → 입금 안내. 내 신청 조회는 신청번호 + 휴대전화.
- 설정은 `public/shared/crew-config.mjs` 한 곳: 프로그램, 요일·시간, 참가비(10,000원), 정원(요일·시간 칸당 10명), 안내문.
- 이용 기간은 시작일 기준 한 달. 기간이 끝나면 "곧 만료/기간 끝남"으로 표시되고, 관리자가 입금을 확인해 "연장 확정"을 누르면 한 달 더 이어집니다(연장 안내 문자는 관리자가 버튼으로 보냅니다).
- 문자: 신청 직후 입금 안내, 확정/연장 확정 시 확정 문자(Solapi, 대관과 같은 설정).
- 사진: `public/photos/crew/프로그램ID-번호.png` (예: `knit-1.png`). 자세한 이름은 그 폴더의 README.txt.
- 계좌: 대관과 같은 `BANK_*` 환경변수를 씁니다.

## 연장 안내 자동 발송

- 매일 오전 9시(한국 시간)에 GitHub Actions(`.github/workflows/crew-reminders.yml`)가 `/api/crew-cron`을 불러 연장 안내 문자를 보냅니다.
- 대상: 이용 기간이 끝나기 7일 전부터(1회), 기간이 끝난 뒤(1회, 끝난 지 45일까지). 같은 안내는 반복해서 보내지 않습니다. 연장 확정을 하면 다시 처음부터 셉니다.
- 설정(처음 한 번): Render 환경변수 `CRON_SECRET`에 임의의 긴 문자열을 넣고, GitHub 저장소 Settings > Secrets and variables > Actions 에 `CRON_SECRET`(같은 값)과 `SITE_URL`(예: https://women-booking.onrender.com)을 넣습니다.
- 지금 바로 한 번 돌려 보려면 GitHub 저장소 Actions 탭에서 `crew-reminders`를 선택하고 Run workflow를 누릅니다.
