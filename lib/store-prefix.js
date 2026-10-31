// 같은 저장소를 여러 포털이 함께 쓸 때 키가 섞이지 않도록 모든 키 앞에 접두어를 붙여 주는 얇은 껍데기입니다.
export function withPrefix(store, p) {
  if (!p) return store;
  const k = (x) => p + x;
  return {
    get: (key) => store.get(k(key)),
    mget: (keys) => store.mget(keys.map(k)),
    set: (key, v, ttl) => store.set(k(key), v, ttl),
    del: (keys) => store.del(keys.map(k)),
    msetnx: (obj, ttl) => store.msetnx(Object.fromEntries(Object.entries(obj).map(([key, v]) => [k(key), v])), ttl),
    zadd: (key, score, member) => store.zadd(k(key), score, member),
    zrem: (key, member) => store.zrem(k(key), member),
    zrangebyscore: (key, min, max) => store.zrangebyscore(k(key), min, max),
    incr: (key, ttl) => store.incr(k(key), ttl),
  };
}
