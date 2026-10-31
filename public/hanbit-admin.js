import { HANBIT } from '/shared/hanbit-config.mjs';
import { startClubAdmin } from '/club-admin.js';

startClubAdmin(HANBIT, { api: '/api/hanbit-admin', storageKey: 'hanbit:adm' });
