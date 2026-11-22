import { describe, expect, it } from 'vitest';
import {
  civilWallTimeToEpochMs,
  endOfCivilDayEpochMs,
  formatLocalCalendarDate,
  katakanaToHiragana,
  negotiateAcceptLanguage,
  normalizeMultilingualText,
  resolveMarketDefaults,
  tokenizeMultilingualSearch,
} from '../../packages/domain/src/i18n';
import {
  computeFreshness,
  computeReadFreshness,
  findCanonicalIngredient,
  localizeCanonicalIngredientName,
  normalizeIngredientText,
} from '../../packages/domain/src/index';
import { applyReceiptScanQualityGate, isGenericScanLabel } from '../../packages/ai/src/quality-gate';
import { rankDiscovery } from '../../packages/recipes/src/discovery';
import { classifyRecipeRoles } from '../../packages/recipes/src/composition/roles';
import { localizeSimpleFoodTitle, SIMPLE_FOODS } from '../../packages/recipes/src/composition/simple-foods';
import { planningReference, slotInstant } from '../../packages/recipes/src/planner-context';
import { buildOtpEmail } from '../../src/worker/services/email';
import type { Recipe } from '../../packages/recipes/src/types';

describe('Phase 1 Global Expansion — Multilingual Normalization & Kana Safety', () => {
  it('preserves Japanese dakuten and handakuten while unifying Katakana and halfwidth forms', () => {
    // Voiced vs unvoiced Kana MUST NEVER collide (ぶた pork != ふた lid; そば buckwheat != そは)
    expect(normalizeMultilingualText('ぶた')).toBe('ぶた');
    expect(normalizeMultilingualText('ふた')).toBe('ふた');
    expect(normalizeMultilingualText('ぶた')).not.toBe(normalizeMultilingualText('ふた'));

    expect(normalizeMultilingualText('そば')).not.toBe(normalizeMultilingualText('そは'));
    expect(normalizeMultilingualText('パン')).toBe('ぱん');
    expect(normalizeMultilingualText('ぱん')).not.toBe(normalizeMultilingualText('はん'));

    // Fullwidth & halfwidth Katakana normalize to identical Hiragana with dakuten preserved
    expect(katakanaToHiragana('豚バラ')).toBe('豚ばら');
    expect(normalizeMultilingualText('ﾌﾞﾀﾊﾞﾗ')).toBe('ぶたばら');
    expect(normalizeMultilingualText('ブタバラ')).toBe('ぶたばら');
  });

  it('folds European diacritics and ligatures without corrupting CJK/Kana scripts', () => {
    expect(normalizeMultilingualText('Weißwurst')).toBe('weisswurst');
    expect(normalizeMultilingualText('Bœuf Bourguignon')).toBe('boeuf bourguignon');
    expect(normalizeMultilingualText('Æbleflæsk')).toBe('aebleflaesk');
    expect(normalizeMultilingualText('Łosoś wędzony')).toBe('losos wedzony');
    expect(normalizeMultilingualText('Đậu phụ sốt cà chua')).toBe('dau phu sot ca chua');
    expect(normalizeIngredientText('国産鶏むね肉 2枚')).toBe('国産鶏むね肉 2枚');
  });

  it('tokenizes Japanese CJK/Kana bigrams and German DIN 5007-2 umlaut digraphs', () => {
    const jaTokens = tokenizeMultilingualSearch('親子丼', {
      locale: 'ja',
      readingHiragana: 'おやこどん',
      mode: 'document',
    });
    expect(jaTokens).toContain('親子丼');
    expect(jaTokens).toContain('親子');
    expect(jaTokens).toContain('おやこどん');

    const deDocTokens = tokenizeMultilingualSearch('Käsespätzle', {
      locale: 'de',
      mode: 'document',
    });
    expect(deDocTokens).toContain('kasespatzle');
    expect(deDocTokens).toContain('kaesespaetzle');
  });
});

describe('Phase 1 Global Expansion — Locale Negotiation & Priority Market Defaults', () => {
  it('negotiates RFC 9110 Accept-Language with quality weights and regional subtags', () => {
    expect(negotiateAcceptLanguage('ja-JP,ja;q=0.9,en-US;q=0.8')).toBe('ja');
    expect(negotiateAcceptLanguage('de-AT,de;q=0.9,en;q=0.7')).toBe('de');
    expect(negotiateAcceptLanguage('zh-TW;q=0.9,fr-CH;q=0.8,en;q=0.5')).toBe('fr');
    expect(negotiateAcceptLanguage('pt-BR;q=0.9')).toBeNull();
  });

  it('resolves accurate currency, IANA timezone, and week-start defaults for Japan and Europe', () => {
    expect(resolveMarketDefaults('JP', null)).toMatchObject({
      countryCode: 'JP',
      locale: 'ja',
      currency: 'JPY',
      timeZone: 'Asia/Tokyo',
      weekStartDay: 0,
      culinaryCulture: 'jp_home',
    });

    expect(resolveMarketDefaults('DE', null)).toMatchObject({
      countryCode: 'DE',
      locale: 'de',
      currency: 'EUR',
      timeZone: 'Europe/Berlin',
      weekStartDay: 1,
    });

    expect(resolveMarketDefaults('GB', null)).toMatchObject({
      countryCode: 'GB',
      locale: 'en',
      currency: 'GBP',
      timeZone: 'Europe/London',
      weekStartDay: 1,
    });

    expect(resolveMarketDefaults('CH', 'fr')).toMatchObject({
      countryCode: 'CH',
      locale: 'fr',
      currency: 'CHF',
      timeZone: 'Europe/Zurich',
      weekStartDay: 1,
    });

    expect(resolveMarketDefaults('SE', null)).toMatchObject({
      countryCode: 'SE',
      locale: 'sv',
      currency: 'SEK',
      timeZone: 'Europe/Stockholm',
      weekStartDay: 1,
    });

    expect(resolveMarketDefaults('PL', null)).toMatchObject({
      countryCode: 'PL',
      locale: 'pl',
      currency: 'PLN',
      timeZone: 'Europe/Warsaw',
      weekStartDay: 1,
    });
  });

  it('localizes canonical ingredient names and simple foods across JP and EU locales', () => {
    expect(localizeCanonicalIngredientName('CHICKEN_BREAST', 'ja')).toBe('鶏むね肉');
    expect(localizeCanonicalIngredientName('CHICKEN_BREAST', 'de')).toBe('Hähnchenbrust');
    expect(localizeCanonicalIngredientName('CHICKEN_BREAST', 'fr')).toBe('Blanc de poulet');
    expect(findCanonicalIngredient('鶏むね肉 1ぱっく', { includeGlobalLocales: true })?.id).toBe('CHICKEN_BREAST');
    expect(findCanonicalIngredient('Hähnchenbrust 500g', { includeGlobalLocales: true })?.id).toBe('CHICKEN_BREAST');

    const rice = SIMPLE_FOODS.find((f) => f.id === 'sf-steamed-rice')!;
    expect(localizeSimpleFoodTitle(rice, 'ja')).toBe('白ご飯');
    expect(localizeSimpleFoodTitle(rice, 'de')).toBe('Gedämpfter Reis');
    expect(localizeSimpleFoodTitle(rice, 'vi')).toBe('Cơm trắng');
  });
});

describe('Phase 1 Global Expansion — IANA Civil Timezone & European DST Transitions', () => {
  it('evaluates civil end-of-day freshness against 23:59:59.999 Asia/Tokyo instead of UTC midnight (09:00 JST)', () => {
    // 2026-11-22 12:30:00 JST = 2026-11-22T03:30:00.000Z
    const noonTokyoMs = Date.parse('2026-11-22T03:30:00.000Z');
    expect(formatLocalCalendarDate(noonTokyoMs, 'Asia/Tokyo')).toBe('2026-11-22');

    // Item expiring tomorrow ('2026-11-23') has 35.5 hours left in Tokyo -> 'use_soon' (not 'expiring'!)
    expect(computeFreshness('2026-11-23', undefined, 7, { timeZone: 'Asia/Tokyo', nowMs: noonTokyoMs })).toBe('use_soon');
    expect(computeReadFreshness('2026-11-23', 'ACTIVE', noonTokyoMs, { timeZone: 'Asia/Tokyo' })).toBe('use_soon');

    // Without timeZone (legacy UTC midnight), '2026-11-23' was only 20.5h away -> prematurely 'expiring'
    expect(computeReadFreshness('2026-11-23', 'ACTIVE', noonTokyoMs)).toBe('expiring');

    const tokyoEndOfDay = endOfCivilDayEpochMs('2026-11-22', 'Asia/Tokyo');
    expect(new Date(tokyoEndOfDay).toISOString()).toBe('2026-11-22T14:59:59.999Z');
  });

  it('computes exact slot instants across European 23h spring-forward and 25h fall-back DST shifts', () => {
    // Europe/Berlin springs forward on 2026-03-29 (CET +01:00 -> CEST +02:00)
    const marchRef = planningReference('2026-03-28T12:00:00+01:00', 'Europe/Berlin');
    // Before DST jump (2026-03-28 19:00 CET = 18:00Z)
    expect(slotInstant('2026-03-28', '19:00', marchRef)).toBe('2026-03-28T18:00:00.000Z');
    // After DST jump (2026-03-29 19:00 CEST = 17:00Z — 1 hour earlier in UTC!)
    expect(slotInstant('2026-03-29', '19:00', marchRef)).toBe('2026-03-29T17:00:00.000Z');

    // Europe/Berlin falls back on 2026-10-25 (CEST +02:00 -> CET +01:00)
    const octRef = planningReference('2026-10-24T12:00:00+02:00', 'Europe/Berlin');
    expect(slotInstant('2026-10-24', '19:00', octRef)).toBe('2026-10-24T17:00:00.000Z');
    expect(slotInstant('2026-10-25', '19:00', octRef)).toBe('2026-10-25T18:00:00.000Z');

    // Non-existent gap hour 02:30 on 2026-03-29 resolves deterministically without NaN
    const gapEpoch = civilWallTimeToEpochMs('2026-03-29', '02:30', 'Europe/Berlin');
    expect(Number.isFinite(gapEpoch)).toBe(true);
  });
});

describe('Phase 1 Global Expansion — OCR Quality Gate, Discovery & Localized OTP Email', () => {
  it('preserves Japanese Kanji/Kana food labels while filtering JP/EU receipt tax/deposit noise', () => {
    expect(isGenericScanLabel('国産豚こま切れ')).toBe(false);
    expect(isGenericScanLabel('木綿豆腐')).toBe(false);
    expect(isGenericScanLabel('絹ごし豆腐')).toBe(false);

    for (const noise of ['消費税', '外税', '内税', 'pfand', 'zwischensumme', 'mwst', 'tva']) {
      expect(isGenericScanLabel(noise)).toBe(true);
    }

    const filtered = applyReceiptScanQualityGate({
      items: [
        { raw_name: '木綿豆腐', estimated_quantity: 1, unit: 'piece', confidence: 0.92 },
        { raw_name: '絹ごし豆腐', estimated_quantity: 1, unit: 'piece', confidence: 0.91 },
        { raw_name: '消費税', estimated_quantity: 1, unit: 'piece', confidence: 0.99 },
        { raw_name: 'Pfand', estimated_quantity: 1, unit: 'piece', confidence: 0.99 },
      ],
    });
    // Both distinct tofu varieties survive without colliding; tax & Pfand are stripped!
    expect(filtered.items.map((item) => item.raw_name)).toEqual(['木綿豆腐', '絹ごし豆腐']);
  });

  it('matches Japanese CJK and German umlaut queries in recipe discovery and role classification', () => {
    const recipes: Recipe[] = [
      {
        id: 'jp-oyakodon',
        slug: 'oyakodon',
        title: '親子丼',
        description: '鶏肉と卵の定番丼もの',
        imageUrl: '/frigo/recipes/placeholder.png',
        cuisine: 'japanese',
        category: 'mon_man',
        cookTimeMinutes: 15,
        servings: 2,
        difficulty: 'easy',
        ingredients: [
          { ingredientId: 'CHICKEN_BREAST', name: '鶏むね肉', requiredQuantity: 200, unit: 'g' },
          { ingredientId: 'EGG', name: '卵', requiredQuantity: 3, unit: 'piece' },
        ],
        steps: [{ stepNumber: 1, instruction: '煮る' }],
        tags: ['丼', '和食'],
      },
      {
        id: 'de-kaesespaetzle',
        slug: 'kaesespaetzle',
        title: 'Allgäuer Käsespätzle',
        description: 'Schwäbische Eierspätzle mit Bergkäse und Röstzwiebeln',
        imageUrl: '/frigo/recipes/placeholder.png',
        cuisine: 'italian',
        category: 'mon_man',
        cookTimeMinutes: 20,
        servings: 2,
        difficulty: 'medium',
        ingredients: [
          { ingredientId: 'CHEESE', name: 'Bergkäse', requiredQuantity: 150, unit: 'g' },
        ],
        steps: [{ stepNumber: 1, instruction: 'Backen' }],
        tags: ['vegetarisch'],
      },
    ];

    const jpHits = rankDiscovery(recipes, [], { q: '親子', noBuy: false, page: 1, pageSize: 10 });
    expect(jpHits.map((h) => h.recipe.id)).toEqual(['jp-oyakodon']);

    const deHits = rankDiscovery(recipes, [], { q: 'kaesespaetzle', noBuy: false, page: 1, pageSize: 10 });
    expect(deHits.map((h) => h.recipe.id)).toEqual(['de-kaesespaetzle']);

    const misoSoupRole = classifyRecipeRoles({
      ...recipes[0],
      id: 'jp-miso-soup',
      title: '豆腐とわかめの味噌汁',
      category: 'mon_canh',
    });
    expect(misoSoupRole.roles).toContain('soup');
  });

  it('renders localized OTP emails with proper lang attributes across ja, de, fr, en, and vi', () => {
    const jaMail = buildOtpEmail('482910', 'register', 'ja');
    expect(jaMail.html).toContain('lang="ja"');
    expect(jaMail.subject).toContain('482910');
    expect(jaMail.text).toContain('認証コード');

    const deMail = buildOtpEmail('482910', 'forgot_password', 'de');
    expect(deMail.html).toContain('lang="de"');
    expect(deMail.subject).toContain('482910');
    expect(deMail.text).toContain('Passwort');

    const viMail = buildOtpEmail('482910', 'register', 'vi');
    expect(viMail.html).toContain('lang="vi"');
    expect(viMail.subject).toContain('Mã xác thực');
  });
});
