# 여성문화센터 대관 예약

날짜, 공간, 시간을 고르면 요금이 계산되고, 안내된 계좌로 입금하면 예약이 확정되는 정적 사이트입니다. 회원가입과 결제 시스템은 없습니다. 운영 방법은 [docs/manual.html](docs/manual.html)에 있습니다.

## 구성

- `public/` 화면. `index.html`이 예약 페이지, `admin.html`이 관리 페이지입니다.
- `public/shared/` 요금 계산과 운영 규칙. 브라우저와 서버가 같은 파일을 씁니다. 서버가 요금을 다시 계산하므로 화면 값을 조작해도 소용없습니다.
- `api/` Vercel 서버리스 함수 (`availability`, `reserve`, `admin`, `info`).
- `lib/` 예약 저장과 중복 방지. 슬롯 단위로 `MSETNX`를 써서 동시에 같은 시간을 잡는 요청 중 하나만 성공합니다.
- `DESIGN.md` 디자인 시스템. `npx -p @google/design.md designmd lint DESIGN.md`로 검사합니다.

## 로컬 실행

```bash
node dev-server.js
```

http://localhost:3000 에서 열립니다. 저장소는 메모리라서 서버를 끄면 예약이 사라집니다. 개발용 관리자 비밀번호는 `dev-admin`입니다.

```bash
node --test
```

## Vercel 배포

1. GitHub 저장소를 Vercel에서 Import합니다.
2. Vercel 대시보드 Storage(Marketplace)에서 Upstash Redis를 만들어 프로젝트에 연결합니다. `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`(또는 `KV_REST_API_URL`, `KV_REST_API_TOKEN`)이 자동으로 들어갑니다.
3. Environment Variables에 아래 값을 넣습니다.

| 이름 | 내용 |
| --- | --- |
| `ADMIN_PASSWORD` | 관리 페이지 초기 비밀번호. 관리 페이지 설정 탭에서 바꾸면 저장소 값이 우선합니다 |
| `BANK_NAME` | 은행 이름 |
| `BANK_NUMBER` | 계좌번호 |
| `BANK_HOLDER` | 예금주 |
| `CONTACT_PHONE` | 문의 전화번호 |

4. Redeploy합니다. 저장소가 연결되지 않으면 예약 페이지가 "예약할 수 없습니다"를 표시합니다.

요금, 운영 시간, 휴관 요일은 `public/shared/config.mjs`에서 바꿉니다.
