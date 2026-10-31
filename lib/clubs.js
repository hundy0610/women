// 소모임 포털 목록. 새 포털을 더하려면 설정 파일을 만들고 여기에 한 줄을 추가합니다.
import { CREW } from '../public/shared/crew-config.mjs';
import { HANBIT } from '../public/shared/hanbit-config.mjs';
import { createClub } from './crew.js';

export const CLUBS = [CREW, HANBIT].map((cfg) => ({ cfg, club: createClub(cfg) }));
