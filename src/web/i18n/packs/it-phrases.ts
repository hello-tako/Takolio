import { itPhrasesPart1 } from './it-phrases-1';
import { itPhrasesPart2 } from './it-phrases-2';
import { itPhrasesPart3 } from './it-phrases-3';
import { itPhrasesPart4 } from './it-phrases-4';

export const itPhrases: Readonly<Record<string, string>> = {
  ...itPhrasesPart1,
  ...itPhrasesPart2,
  ...itPhrasesPart3,
  ...itPhrasesPart4,
};
