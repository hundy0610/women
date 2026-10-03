// Upstash Redis REST API 어댑터. 패키지 설치 없이 fetch만 씁니다.
export function createUpstashStore({ url, token, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function call(path, body) {
    const res = await fetchImpl(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${json?.error || 'request failed'}`);
    return json;
  }
  async function cmd(args) {
    const json = await call('', args.map(String));
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result;
  }
  async function pipeline(cmds) {
    const arr = await call('/pipeline', cmds.map((c) => c.map(String)));
    const bad = arr.find((r) => r.error);
    if (bad) throw new Error(`Upstash: ${bad.error}`);
    return arr.map((r) => r.result);
  }

  return {
    get: (k) => cmd(['GET', k]),
    mget: async (keys) => (keys.length ? cmd(['MGET', ...keys]) : []),
    async set(k, v, ttlSec) { await cmd(ttlSec ? ['SET', k, v, 'EX', Math.max(1, Math.floor(ttlSec))] : ['SET', k, v]); },
    async del(keys) { return keys.length ? cmd(['DEL', ...keys]) : 0; },
    async msetnx(obj, ttlSec) {
      const keys = Object.keys(obj);
      const ok = await cmd(['MSETNX', ...keys.flatMap((k) => [k, obj[k]])]);
      if (Number(ok) !== 1) return 0;
      if (ttlSec) await pipeline(keys.map((k) => ['EXPIRE', k, Math.max(1, Math.floor(ttlSec))]));
      return 1;
    },
    async zadd(key, score, member) { await cmd(['ZADD', key, score, member]); },
    async zrem(key, member) { await cmd(['ZREM', key, member]); },
    async zrangebyscore(key, min, max) { return (await cmd(['ZRANGEBYSCORE', key, min, max])) || []; },
    async incr(key, ttlSec) {
      const n = Number(await cmd(['INCR', key]));
      if (n === 1 && ttlSec) await cmd(['EXPIRE', key, ttlSec]);
      return n;
    },
  };
}
