# 보안 체계

OWASP(Top 10, ASVS Level 1, Secure Headers Project) 권고를 기준으로 합니다. 외부 패키지가 없어서(의존성 0개) 공급망 위험이 작고, 점검은 아래 오픈소스 도구로 자동화돼 있습니다.

## 1. 개인정보 목록과 보관 기간

| 서비스 | 받는 정보 | 저장 위치 | 보관 |
|---|---|---|---|
| 공간 대관 | 이름, 휴대전화, 인원, 이용 목적 | Upstash Redis | 이용일 + 약 33일 뒤 자동 삭제. 취소 건은 60일 |
| 소모임 | 이름, 휴대전화, 성별, 나이(선택), 지역(동) | Upstash Redis | 이용 기간 끝 + 150일 뒤 자동 삭제. 취소 건은 60일 |
| 변경 이력 | 이름, 금액(휴대전화는 넣지 않음) | Upstash Redis | 삭제 기한 없음(관리자 이력용) |
| 문자 발송 | 휴대전화, 안내 문구 | Solapi | Solapi 정책을 따름 |

- 화면과 공개 API(`/api/availability`, `/api/crew` 의 `info`)에는 개인정보가 나가지 않습니다(자리 수와 날짜만).
- 본인 조회는 "신청번호 + 휴대전화"가 둘 다 맞아야 하고, 조회는 IP당 시간당 30번으로 제한됩니다.
- 로그에는 신청번호만 남기고 이름·번호는 남기지 않습니다.
- 저장소(코드)에는 실제 계좌, 키, 비밀번호를 넣지 않습니다. 모두 Render 환경변수입니다.

## 2. 적용된 방어

| 위협 | 방어 | 위치 |
|---|---|---|
| 스크립트 삽입(XSS) | 화면에 넣는 모든 사용자 값을 이스케이프, CSP로 인라인 스크립트 차단 | `public/*.js`, `lib/security-headers.js` |
| 클릭재킹, MIME 추측, 정보 노출 | `X-Frame-Options`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS | `lib/security-headers.js`, `vercel.json` |
| 다른 사이트에서 몰래 보내는 요청(CSRF) | 관리자 인증은 쿠키가 아니라 헤더, 모든 POST는 `Origin`이 우리 주소가 아니면 403 | `lib/http.js`, `lib/security.js` |
| 무차별 대입(비밀번호, 신청번호) | 관리자 10분 10회 제한, 조회 시간당 30회, 비밀번호는 scrypt 해시 + 시간 일정 비교 | `lib/http.js`, `lib/adminpw.js` |
| 요청 폭주(DoS) | IP당 분당 120회(프로세스 안), 본문 64KB 초과 413, 신청·예약은 IP·번호별 제한 | `server.js`, `lib/http.js` |
| IP 속이기(X-Forwarded-For) | 호스팅이 채운 헤더를 우선, 없으면 가장 오른쪽 값만 사용 | `lib/security.js` |
| 문자 폭탄(남의 번호로 문자 유도, 요금 폭증) | 번호당 하루 5건, IP당 시간당 10건, 서버 전체 하루 발송 상한(`SMS_DAILY_MAX`, 기본 300) | `lib/crew.js`, `lib/sms.js` |
| 저장소 주입 | 번호는 영문 대문자·숫자 8자만 허용, Redis는 명령 배열로 호출(문자열 조립 없음) | `lib/security.js`, `lib/store-upstash.js` |
| 경로 탈출 | 정적 파일 경로 정규화 후 `public/` 안인지 확인 | `server.js` |
| 봇 | 보이지 않는 함정 칸(honeypot) | 신청·예약 화면 |
| 동시 신청으로 정원 초과 | 자리 키를 한 번에 선점(원자적) | `lib/crew.js`, `lib/booking.js` |

## 3. 자동 점검(오픈소스)

`.github/workflows/security.yml`
- **gitleaks**: 코드에 비밀번호·키가 들어갔는지 매 푸시마다 검사
- **CodeQL**: 코드 정적 분석(공개 저장소에서 무료)
- **OWASP ZAP baseline**: 매주 실제 사이트를 수동(공격 없음) 점검

`.github/dependabot.yml`: GitHub Actions와 npm 업데이트를 주 1회 알림.

## 4. 운영자가 지켜 주세요

- 관리자 비밀번호는 12자 이상, 다른 곳과 다르게. 바꾸면 "대관 관리 → 설정"에서 변경(8자 이상 강제).
- Render, GitHub, Solapi, Upstash 계정에 2단계 인증을 켭니다.
- Solapi API Key의 허용 IP는 "모든 IP"가 아니라 Render 서버의 출력 IP로 제한하는 것이 안전합니다(Render 대시보드 → 서비스 → Connect → Outbound IP).
- 키가 유출됐다고 의심되면 Solapi의 Secret 재생성, Render의 `ADMIN_PASSWORD`/`CRON_SECRET` 교체, Upstash 토큰 재발급 순서로 바꿉니다.
- 저장소는 비공개(Private)로 두는 것을 권장합니다. 공개 저장소에는 코드 구조와 과거 기록이 모두 보입니다.

## 5. 취약점 제보

개인정보 유출이나 취약점을 발견하면 공개하지 말고 담당자에게 직접 알려 주세요.
