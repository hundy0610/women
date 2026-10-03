// 로컬 개발과 테스트용 메모리 저장소. 배포 환경(Vercel)에서는 쓰지 않습니다.
export function createMemoryStore() {
  const kv = new Map();
  const exp = new Map();
  const zs = new Map();

  const alive = (k) => {
    const e = exp.get(k);
    if (e && e <= Date.now()) { kv.delete(k); exp.delete(k); return false; }
    return kv.has(k);
  };
  const put = (k, v, ttlSec) => {
    kv.set(k, String(v));
    if (ttlSec) exp.set(k, Date.now() + ttlSec * 1000); else exp.delete(k);
  };

  return {
    async get(k) { return alive(k) ? kv.get(k) : null; },
    async mget(keys) { return keys.map((k) => (alive(k) ? kv.get(k) : null)); },
    async set(k, v, ttlSec) { put(k, v, ttlSec); },
    async del(keys) {
      let n = 0;
      for (const k of keys) if (alive(k)) { kv.delete(k); exp.delete(k); n++; }
      return n;
    },
    // 하나라도 이미 있으면 아무것도 쓰지 않습니다(전부 쓰거나 전부 안 씁니다).
    async msetnx(obj, ttlSec) {
      const ks = Object.keys(obj);
      if (ks.some((k) => alive(k))) return 0;
      for (const k of ks) put(k, obj[k], ttlSec);
      return 1;
    },
    async zadd(key, score, member) {
      if (!zs.has(key)) zs.set(key, new Map());
      zs.get(key).set(String(member), Number(score));
    },
    async zrem(key, member) { zs.get(key)?.delete(String(member)); },
    async zrangebyscore(key, min, max) {
      const m = zs.get(key);
      if (!m) return [];
      return [...m.entries()].filter(([, s]) => s >= min && s <= max).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    },
    async incr(key, ttlSec) {
      const n = alive(key) ? Number(kv.get(key)) + 1 : 1;
      if (n === 1) put(key, 1, ttlSec); else kv.set(key, String(n));
      return n;
    },
  };
}
