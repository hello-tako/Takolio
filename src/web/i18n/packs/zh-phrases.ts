import { ZH_PHRASES_1 } from './zh-phrases-1';
import { ZH_PHRASES_2 } from './zh-phrases-2';
import { ZH_PHRASES_3 } from './zh-phrases-3';
import { ZH_PHRASES_4 } from './zh-phrases-4';

export const ZH_PHRASES: Readonly<Record<string, string>> = Object.freeze({
  ...ZH_PHRASES_1,
  ...ZH_PHRASES_2,
  ...ZH_PHRASES_3,
  ...ZH_PHRASES_4,
});
