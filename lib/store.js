import { createMemoryStore } from './store-memory.js';
import { createUpstashStore } from './store-upstash.js';

let cached;

// Upstash 환경 변수가 있으면 Upstash, 없고 로컬이면 메모리, 배포 환경인데 설정이 없으면 null.
// 배포 환경에서 메모리 저장소를 쓰면 인스턴스마다 예약이 따로 저장되므로 쓰지 않습니다.
export function getStore() {
  if (cached !== undefined) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) cached = createUpstashStore({ url, token });
  else if (!process.env.VERCEL && !process.env.RENDER) cached = createMemoryStore();
  else cached = null;
  return cached;
}
