import { adminApi } from '../lib/club-api.js';
import { HANBIT } from '../public/shared/hanbit-config.mjs';
import { createClub } from '../lib/crew.js';

export default adminApi(HANBIT, createClub(HANBIT));
