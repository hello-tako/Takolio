import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Controlled Recipe Catalog Localization & Kana FTS5 Indexing Compiler (`Workstream C`).
 *
 * Guarantees:
 * 1. Never mutates canonical `recipes` or `recipe_content_versions` SHA-256 fingerprints.
 * 2. Enforces 1:1 `steps` count & contiguous `1..N` step numbering against source recipes.
 * 3. Requires Hiragana `titleReading` for `ja` entries so Kanji titles (`豚汁`, `鮭の塩焼き`)
 *    match Kana input (`ぶたじる`, `さけ`) in `recipe_search_fts`.
 * 4. Blocks accidental Vietnamese diacritic leakage inside non-`vi` step instructions.
 * 5. Validates statutory allergen tags against the canonical JP CAA (28) + EU 1169/2011 (14) set.
 */

export const SUPPORTED_CATALOG_LOCALES = new Set([
  'en', 'ja', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'sv', 'vi',
]);

export const CANONICAL_ALLERGEN_SET = new Set([
  'egg', 'milk', 'wheat', 'buckwheat', 'peanut', 'shrimp', 'crab', 'walnut', 'cashew',
  'almond', 'abalone', 'squid', 'salmon_roe', 'orange', 'kiwi', 'beef', 'sesame', 'salmon',
  'mackerel', 'soybean', 'chicken', 'banana', 'pork', 'macadamia', 'peach', 'yam', 'apple',
  'gelatin', 'crustaceans', 'fish', 'tree_nuts', 'celery', 'mustard', 'sulphites', 'lupin', 'molluscs',
]);

export const CULINARY_GLOSSARY = Object.freeze({
  ja: {
    tbsp: '大さじ',
    tsp: '小さじ',
    cup_jp: 'カップ（200ml）',
    go: '合',
    pinch: 'ひとつまみ',
    fish_sauce: 'ナンプラー（魚醤）',
  },
  de: {
    tbsp: 'EL',
    tsp: 'TL',
    pinch: 'Prise',
    bunch: 'Bund',
  },
  fr: {
    tbsp: 'c. à soupe',
    tsp: 'c. à café',
    pinch: 'pincée',
    bunch: 'botte',
  },
  en: {
    tbsp: 'tbsp',
    tsp: 'tsp',
    pinch: 'pinch',
    bunch: 'bunch',
  },
});

const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const HIRAGANA_READING_RE = /^[ぁ-んー・\s0-9a-z]+$/u;
// Vietnamese-exclusive diacritics (excludes plain â/ê/ô shared with French culinary terms like rôti, crêpe, pâtes)
const VIETNAMESE_DIACRITIC_RE = /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;

const LATIN_LIGATURE_MAP = {
  ß: 'ss',
  ẞ: 'ss',
  œ: 'oe',
  Œ: 'oe',
  æ: 'ae',
  Æ: 'ae',
  ø: 'o',
  Ø: 'o',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
};

const jaWordSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'word' })
    : null;

function katakanaToHiragana(input) {
  let out = '';
  for (const ch of String(input || '').normalize('NFKC')) {
    const code = ch.codePointAt(0);
    if ((code >= 0x30a1 && code <= 0x30f6) || (code >= 0x30fd && code <= 0x30fe)) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function normalizeSearchField(text) {
  const nfkc = katakanaToHiragana(text);
  const latinFolded = nfkc
    .replace(/\p{Script=Latin}/gu, (ch) => {
      if (LATIN_LIGATURE_MAP[ch] !== undefined) return LATIN_LIGATURE_MAP[ch];
      return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    })
    .toLowerCase();
  return latinFolded
    .replace(/[^\p{L}\p{N}\u30fc]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildSearchTokens(title, readingHiragana = '', ingredientsText = '') {
  const tokens = new Set();
  const sources = [title, readingHiragana, ingredientsText];
  const cjkRe = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30fc]/u;

  for (const raw of sources) {
    if (!raw) continue;
    const normalized = normalizeSearchField(raw);
    if (!normalized) continue;

    if (/[äöüÄÖÜ]/.test(raw)) {
      const digraph = normalizeSearchField(
        String(raw).replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue'),
      );
      for (const part of digraph.split(' ')) {
        if (part) tokens.add(part);
      }
    }

    for (const chunk of normalized.split(' ')) {
      if (!chunk) continue;
      tokens.add(chunk);
      if (!cjkRe.test(chunk)) continue;

      if (jaWordSegmenter) {
        for (const item of jaWordSegmenter.segment(chunk)) {
          if (item.isWordLike && item.segment.trim()) {
            tokens.add(item.segment.trim());
          }
        }
      }
      const chars = Array.from(chunk);
      for (let i = 0; i < chars.length; i++) {
        tokens.add(chars[i]);
        if (i + 1 < chars.length) tokens.add(chars[i] + chars[i + 1]);
        if (i + 2 < chars.length) tokens.add(chars[i] + chars[i + 1] + chars[i + 2]);
      }
    }
  }
  return [...tokens].join(' ');
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Validates a batch of localized recipe entries before SQL compilation.
 * @param {Array<Record<string, any>>} records
 * @returns {{ ok: boolean, errors: Array<{ index: number, code: string, message: string }> }}
 */
export function validateLocalizationBatch(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { ok: false, errors: [{ index: -1, code: 'EMPTY_BATCH', message: 'Localization batch must be a non-empty array' }] };
  }

  const errors = [];
  const seenKey = new Set();
  const seenLocaleSlug = new Set();

  records.forEach((rec, index) => {
    if (!rec || typeof rec !== 'object') {
      errors.push({ index, code: 'INVALID_RECORD', message: 'Record must be an object' });
      return;
    }

    if (typeof rec.recipeId !== 'string' || rec.recipeId.trim().length === 0) {
      errors.push({ index, code: 'MISSING_RECIPE_ID', message: 'recipeId is required' });
    }
    if (typeof rec.fingerprint !== 'string' || !SHA256_HEX_RE.test(rec.fingerprint)) {
      errors.push({ index, code: 'INVALID_FINGERPRINT', message: 'fingerprint must be 64-char lowercase SHA-256 hex' });
    }
    if (typeof rec.locale !== 'string' || !SUPPORTED_CATALOG_LOCALES.has(rec.locale)) {
      errors.push({ index, code: 'UNSUPPORTED_LOCALE', message: `Unsupported locale: ${rec.locale}` });
    }
    if (typeof rec.localizedSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,120}$/.test(rec.localizedSlug)) {
      errors.push({ index, code: 'INVALID_LOCALIZED_SLUG', message: 'localizedSlug must be lowercase kebab-case' });
    }
    if (typeof rec.title !== 'string' || rec.title.trim().length === 0) {
      errors.push({ index, code: 'MISSING_TITLE', message: 'title is required' });
    }

    const pairKey = `${rec.fingerprint}:${rec.locale}`;
    if (seenKey.has(pairKey)) {
      errors.push({ index, code: 'DUPLICATE_FINGERPRINT_LOCALE', message: `Duplicate (${pairKey})` });
    }
    seenKey.add(pairKey);

    const slugKey = `${rec.locale}:${rec.localizedSlug}`;
    if (seenLocaleSlug.has(slugKey)) {
      errors.push({ index, code: 'DUPLICATE_LOCALE_SLUG', message: `Duplicate (${slugKey})` });
    }
    seenLocaleSlug.add(slugKey);

    if (rec.locale === 'ja') {
      if (typeof rec.titleReading !== 'string' || !HIRAGANA_READING_RE.test(rec.titleReading.trim())) {
        errors.push({
          index,
          code: 'MISSING_JAPANESE_HIRAGANA_READING',
          message: 'Japanese localizations must include Hiragana titleReading for Kana FTS5 search',
        });
      }
    }

    if (!Array.isArray(rec.steps) || rec.steps.length === 0) {
      errors.push({ index, code: 'INVALID_STEPS', message: 'steps must be a non-empty array' });
    } else {
      if (typeof rec.expectedStepCount === 'number' && rec.steps.length !== rec.expectedStepCount) {
        errors.push({
          index,
          code: 'STEP_COUNT_MISMATCH',
          message: `Expected ${rec.expectedStepCount} steps, got ${rec.steps.length}`,
        });
      }
      rec.steps.forEach((step, sIdx) => {
        if (!step || step.stepNumber !== sIdx + 1 || typeof step.instruction !== 'string' || !step.instruction.trim()) {
          errors.push({ index, code: 'INVALID_STEP_SEQUENCE', message: `Step ${sIdx + 1} must have contiguous stepNumber and instruction` });
        } else if (rec.locale !== 'vi' && VIETNAMESE_DIACRITIC_RE.test(step.instruction)) {
          errors.push({ index, code: 'VIETNAMESE_LEAKAGE_IN_STEP', message: `Step ${sIdx + 1} contains unlocalized Vietnamese diacritics` });
        }
      });
    }

    if (rec.allergenTags !== undefined) {
      if (!Array.isArray(rec.allergenTags) || rec.allergenTags.some((tag) => !CANONICAL_ALLERGEN_SET.has(tag))) {
        errors.push({ index, code: 'INVALID_ALLERGEN_TAG', message: 'allergenTags must only use canonical JP CAA / EU 1169/2011 keys' });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

/**
 * Compiles a validated batch of localized recipes into deterministic, idempotent D1 SQL
 * populating `recipe_content_localizations` and `recipe_search_documents` (which auto-syncs `recipe_search_fts`).
 */
export function compileLocalizationSql(records) {
  const check = validateLocalizationBatch(records);
  if (!check.ok) {
    const summary = check.errors.map((e) => `[#${e.index} ${e.code}] ${e.message}`).join('; ');
    throw new Error(`Localization batch failed validation: ${summary}`);
  }

  const sorted = [...records].sort(
    (a, b) => a.locale.localeCompare(b.locale) || a.localizedSlug.localeCompare(b.localizedSlug),
  );

  const lines = [
    '-- Generated by scripts/localize-catalog.mjs (deterministic & SHA-256 fingerprint-preserving)',
  ];

  for (const rec of sorted) {
    const stepsJson = JSON.stringify(rec.steps);
    const ingredientLinesJson = rec.ingredientLines ? JSON.stringify(rec.ingredientLines) : null;
    const normalizedTitle = normalizeSearchField(rec.title);
    const readingHiragana = rec.titleReading ? normalizeSearchField(rec.titleReading) : null;
    const ingredientsText = Array.isArray(rec.ingredientLines)
      ? rec.ingredientLines.map((l) => l.name || '').join(' ')
      : '';
    const searchTokens = buildSearchTokens(rec.title, readingHiragana ?? '', ingredientsText);

    lines.push(
      `INSERT INTO recipe_content_localizations (fingerprint, locale, localized_slug, title, title_reading, description, steps_json, ingredient_lines_json) VALUES (${sqlString(rec.fingerprint)}, ${sqlString(rec.locale)}, ${sqlString(rec.localizedSlug)}, ${sqlString(rec.title)}, ${sqlString(rec.titleReading ?? null)}, ${sqlString(rec.description ?? null)}, ${sqlString(stepsJson)}, ${sqlString(ingredientLinesJson)}) ON CONFLICT(fingerprint, locale) DO UPDATE SET localized_slug = excluded.localized_slug, title = excluded.title, title_reading = excluded.title_reading, description = excluded.description, steps_json = excluded.steps_json, ingredient_lines_json = excluded.ingredient_lines_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
    );

    lines.push(
      `INSERT INTO recipe_search_documents (recipe_id, locale, normalized_title, reading_hiragana, search_tokens) VALUES (${sqlString(rec.recipeId)}, ${sqlString(rec.locale)}, ${sqlString(normalizedTitle)}, ${sqlString(readingHiragana)}, ${sqlString(searchTokens)}) ON CONFLICT(recipe_id, locale) DO UPDATE SET normalized_title = excluded.normalized_title, reading_hiragana = excluded.reading_hiragana, search_tokens = excluded.search_tokens, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i]?.startsWith('--')) {
      flags[rest[i].slice(2)] = rest[i + 1];
    }
  }
  return { command, flags };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command || !flags.input || !['validate', 'compile'].includes(command)) {
    console.error('Usage: node scripts/localize-catalog.mjs <validate|compile> --input <batch.json> [--out <seed.sql>]');
    process.exit(2);
  }

  const batch = JSON.parse(readFileSync(flags.input, 'utf8'));
  const validation = validateLocalizationBatch(batch);
  if (!validation.ok) {
    console.error(JSON.stringify({ ok: false, errors: validation.errors }, null, 2));
    process.exit(1);
  }

  if (command === 'validate') {
    console.log(JSON.stringify({ ok: true, count: batch.length }));
    process.exit(0);
  }

  const sql = compileLocalizationSql(batch);
  if (flags.out) {
    writeFileSync(flags.out, sql, 'utf8');
    console.log(JSON.stringify({ ok: true, count: batch.length, out: flags.out }));
  } else {
    process.stdout.write(sql);
  }
}
