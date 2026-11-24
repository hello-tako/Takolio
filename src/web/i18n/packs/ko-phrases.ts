import { koPhrasesPart1 } from './ko-phrases-1';
import { koPhrasesPart2 } from './ko-phrases-2';
import { koPhrasesPart3 } from './ko-phrases-3';
import { koPhrasesPart4 } from './ko-phrases-4';

/**
 * Complete Korean (`ko`) static UI phrase table — 100% coverage of all 2,246 English UI strings.
 */
export const koPhrases: Readonly<Record<string, string>> = Object.freeze({
  ...koPhrasesPart1,
  ...koPhrasesPart2,
  ...koPhrasesPart3,
  ...koPhrasesPart4,
});
