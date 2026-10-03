// 요금 계산. 화면과 서버가 이 함수를 같이 씁니다. 서버는 화면이 보낸 금액을 믿지 않고 다시 계산합니다.
const fail = (code, message) => ({ ok: false, code, message });

export function quote(cfg, input) {
  const ids = Array.from(new Set(input.spaceIds || []));
  const spaces = ids.map((id) => cfg.spaces.find((s) => s.id === id));
  if (!ids.length || spaces.some((s) => !s)) return fail('SPACE', '공간을 선택하세요.');

  const { startHour, endHour } = input;
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return fail('TIME', '이용 시간을 선택하세요.');
  if (startHour < cfg.openHour || endHour > cfg.closeHour || endHour <= startHour) {
    return fail('TIME', `이용 시간은 ${cfg.openHour}:00부터 ${cfg.closeHour}:00 사이여야 합니다.`);
  }
  const hours = endHour - startHour;
  if (hours < cfg.minHours) return fail('MIN_HOURS', `최소 ${cfg.minHours}시간부터 예약할 수 있습니다.`);

  const fullDays = Math.floor(hours / cfg.dayHours);
  const rem = hours % cfg.dayHours;

  const lines = spaces.map((s) => {
    const remHourly = rem * s.hourly;
    const cost = fullDays * s.daily + Math.min(remHourly, s.daily);
    return {
      id: s.id, name: s.name, hourly: s.hourly, daily: s.daily, hours,
      fullDays, remHours: rem, cost,
      listPrice: hours * s.hourly,
      usesDayRate: fullDays > 0 || remHourly > s.daily,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.cost, 0);

  const isPackage = spaces.length === cfg.spaces.length;
  let packageDiscount = 0;
  if (isPackage) {
    const hourlySum = spaces.reduce((a, s) => a + s.hourly, 0);
    const pkgCost = fullDays * cfg.packageDayPrice + Math.min(rem * hourlySum, cfg.packageDayPrice);
    packageDiscount = Math.max(0, subtotal - pkgCost);
  }

  const people = Number.isFinite(input.people) ? Math.max(0, Math.floor(input.people)) : 0;
  const capacity = spaces.reduce((a, s) => a + s.capacity, 0);
  const extraPeople = Math.max(0, people - capacity);
  const overageFee = extraPeople * cfg.overagePerPerson;

  return {
    ok: true, hours, isPackage, lines, subtotal, packageDiscount,
    capacity, extraPeople, overageFee,
    total: subtotal - packageDiscount + overageFee,
  };
}
