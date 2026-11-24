import { thPhrases1 } from './th-phrases-1';
import { thPhrases2 } from './th-phrases-2';
import { thPhrases3 } from './th-phrases-3';
import { thPhrases4 } from './th-phrases-4';

export const thPhrases: Readonly<Record<string, string>> = {
  ...thPhrases1,
  ...thPhrases2,
  ...thPhrases3,
  ...thPhrases4,
};
