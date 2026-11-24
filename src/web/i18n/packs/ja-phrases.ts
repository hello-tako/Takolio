import { JA_PHRASES_1 } from './ja-phrases-1';
import { JA_PHRASES_2 } from './ja-phrases-2';
import { JA_PHRASES_3 } from './ja-phrases-3';
import { JA_PHRASES_4 } from './ja-phrases-4';

export const JA_PHRASES: Readonly<Record<string, string>> = Object.freeze({
  ...JA_PHRASES_1,
  ...JA_PHRASES_2,
  ...JA_PHRASES_3,
  ...JA_PHRASES_4,
});
