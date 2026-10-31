import { publicApi } from '../lib/club-api.js';
import { HANBIT } from '../public/shared/hanbit-config.mjs';
import { createClub } from '../lib/crew.js';

export default publicApi(HANBIT, createClub(HANBIT));
