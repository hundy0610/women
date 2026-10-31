import { adminApi } from '../lib/club-api.js';
import { CREW } from '../public/shared/crew-config.mjs';
import { createClub } from '../lib/crew.js';

export default adminApi(CREW, createClub(CREW));
