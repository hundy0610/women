import { getStore } from '../lib/store.js';

// 입금 계좌와 문의 번호는 환경 변수에서 읽습니다. 저장소 코드에는 넣지 않습니다.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const bank = process.env.BANK_NUMBER
    ? { name: process.env.BANK_NAME || '', number: process.env.BANK_NUMBER, holder: process.env.BANK_HOLDER || '' }
    : null;
  res.status(200).json({
    ok: true,
    now: Date.now(),
    storeReady: Boolean(getStore()),
    bank,
    contact: process.env.CONTACT_PHONE || null,
  });
}
