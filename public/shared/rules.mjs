import { dowOf } from './time.mjs';

// 해당 날짜·공간·시각(시작 hour)이 막혀 있으면 사유 문구를, 아니면 null을 돌려줍니다.
export function blockLabel(cfg, date, spaceId, hour) {
  const dow = dowOf(date);
  const rules = [
    ...cfg.blockedRules.filter((r) => r.weekday === dow),
    ...cfg.blockedDates.filter((r) => r.date === date),
  ];
  for (const r of rules) {
    if (r.spaces && spaceId && !r.spaces.includes(spaceId)) continue;
    if (r.from != null && hour != null && hour < r.from) continue;
    if (r.to != null && hour != null && hour >= r.to) continue;
    return r.label;
  }
  return null;
}

export function dayFullyBlocked(cfg, date) {
  for (const sp of cfg.spaces) {
    for (let h = cfg.openHour; h < cfg.closeHour; h++) {
      if (!blockLabel(cfg, date, sp.id, h)) return false;
    }
  }
  return true;
}
