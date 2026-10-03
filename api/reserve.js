import { handle } from '../lib/http.js';
import { createReservation } from '../lib/booking.js';
import { CONFIG } from '../public/shared/config.mjs';

export default handle('POST', async ({ store, body, nowMs, ip }) => {
  const { rec, quote } = await createReservation(store, body, { nowMs, ip });
  return {
    reservation: {
      id: rec.id, date: rec.date, start: rec.start, end: rec.end, spaces: rec.spaces,
      name: rec.name, people: rec.people, amount: rec.amount, holdUntil: rec.holdUntil,
    },
    quote,
    holdHours: CONFIG.holdHours,
  };
});
