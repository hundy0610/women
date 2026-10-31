import { publicApi } from '../lib/club-api.js';
import { CREW } from '../public/shared/crew-config.mjs';
import { createClub } from '../lib/crew.js';

export default publicApi(CREW, createClub(CREW));
