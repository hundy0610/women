// 로컬 개발 서버: node dev-server.js  (http://localhost:3000)
// 정적 파일은 public/, API는 api/*.js 를 그대로 불러옵니다. 저장소는 메모리라서 재시작하면 초기화됩니다.
// 개발 기본값을 채운 뒤 server.js를 실행합니다.
process.env.ALLOW_TEST_NOW ??= '1';
process.env.ADMIN_PASSWORD ??= 'dev-admin';
process.env.BANK_NAME ??= '개발용은행';
process.env.BANK_NUMBER ??= '000-0000-0000-00';
process.env.BANK_HOLDER ??= '개발용 예시';
process.env.CONTACT_PHONE ??= '010-0000-0000';
console.log(`http://localhost:${process.env.PORT || 3000}  (관리자 비밀번호: ${process.env.ADMIN_PASSWORD})`);
await import('./server.js');
