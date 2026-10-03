import { handle } from '../lib/http.js';
import { findForUser, userView } from '../lib/booking.js';

export default handle('POST', async ({ store, body, nowMs, ip }) => {
  const rec = await findForUser(store, body.id, body.phone, { nowMs, ip });
  return { reservation: userView(rec, nowMs) };
});
