import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '../lib/store.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'photos');

// public/photos 안의 사진을 공간별로 모읍니다. 파일 이름은 공간ID-번호.확장자 (예: room1-1.jpg)
function photos() {
  const out = {};
  try {
    for (const f of fs.readdirSync(dir).sort()) {
      const m = /^([a-z0-9]+)-(\d+)\.(jpe?g|png|webp)$/i.exec(f);
      if (m) (out[m[1].toLowerCase()] ||= []).push(`/photos/${f}`);
    }
  } catch { /* 폴더가 없으면 사진 없이 동작합니다 */ }
  return out;
}


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
    photos: photos(),
  });
}
