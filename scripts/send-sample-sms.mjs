// 실제 문자 발송 점검. 운영과 같은 lib/sms.js 코드로 "예약 안내/확정" 문자를 한 통씩 보냅니다.
// 직접 실행하지 말고 scripts/send-sample-sms.ps1로 실행하세요(키를 환경변수로만 전달).
import { smsEnabled, sendPayGuide, sendPaidNotice, payGuideText, paidText } from '../lib/sms.js';

const to = process.argv[2];
if (!smsEnabled()) { console.error('SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER 가 비어 있습니다.'); process.exit(1); }
const rec = {
  id: 'TEST', phone: to, date: '2026-11-05', start: 11, end: 15, spaces: ['seminar'], amount: 120000,
  holdUntil: Date.now() + 24 * 3600 * 1000,
};
for (const [name, text, fn] of [['송금 안내', payGuideText(rec), sendPayGuide], ['확정', paidText(rec), sendPaidNotice]]) {
  console.log(`\n[${name}] 보낼 내용:\n${text}`);
  const r = await fn(rec);
  console.log(r.ok ? '→ 접수 성공(곧 휴대폰에 도착)' : `→ 실패: ${r.error || '발송 설정 없음'}`);
}
