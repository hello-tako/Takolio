import { describe, expect, it } from 'vitest';
import {
  computeReferenceUnitPrice,
  convertCulinaryQuantity,
  defaultPriceProvider,
  estimateGlobalIngredientCost,
  evaluateDietaryProfileConflicts,
  findCanonicalIngredient,
  hasKosherConflict,
  kcalToKj,
  localizeAllergenLabel,
  mapOpenFoodFactsAllergens,
  matchesAllergenHierarchy,
  normalizeToStandardUnit,
  parseLocalizedCulinaryUnit,
  parseLocalizedExpiryLabel,
  recommendedStorageZoneForIngredient,
  sodiumMgToSaltGrams,
} from '../../packages/domain/src';
import { mergeHouseholdMemberSafetyIntoContext, RankingContextSchema } from '../../packages/recipes/src/personalization';
import {
  applyReceiptScanQualityGate,
  assertEuVisionModelAllowed,
  assertJurisdictionEndpointAllowed,
  CloudflareAIProvider,
  normalizeOcrNumber,
  parseScanV3,
  toCurrencyMinorUnits,
} from '../../packages/ai/src';
import { receiptLineFacts, receiptPurchasePrice } from '../../src/worker/utils/scan-evidence';

describe('Global Phase 2 — Regulatory Allergens (JP CAA 28 & EU 1169/2011 14) & Dietary Safety', () => {
  it('enforces hierarchical tree_nuts / walnut / cashew matching and separates molluscs from crustaceans', () => {
    // Japan CAA mandatory walnut (くるみ) & cashew (カシューナッツ) match EU tree_nuts AND specific nut keys
    expect(matchesAllergenHierarchy(['walnut'], 'tree_nuts')).toBe(true);
    expect(matchesAllergenHierarchy(['くるみ'], 'walnut')).toBe(true);
    expect(matchesAllergenHierarchy(['カシューナッツ'], 'tree_nuts')).toBe(true);
    expect(matchesAllergenHierarchy(['almond'], 'walnut')).toBe(false);
    // Peanut is a legume, NOT a tree nut
    expect(matchesAllergenHierarchy(['peanut'], 'tree_nuts')).toBe(false);

    // EU Annex II #2 Crustaceans vs #14 Molluscs strict separation
    expect(matchesAllergenHierarchy(['shrimp'], 'crustaceans')).toBe(true);
    expect(matchesAllergenHierarchy(['molluscs'], 'crustaceans')).toBe(false);
    expect(matchesAllergenHierarchy(['clam'], 'molluscs')).toBe(true);
    expect(matchesAllergenHierarchy(['いか'], 'molluscs')).toBe(true);
    expect(matchesAllergenHierarchy(['いか'], 'crustaceans')).toBe(false);

    // Gluten sub-grains vs Japanese buckwheat (そば)
    expect(matchesAllergenHierarchy(['wheat'], 'gluten_cereals')).toBe(true);
    expect(matchesAllergenHierarchy(['buckwheat'], 'gluten_cereals')).toBe(false);
    expect(matchesAllergenHierarchy(['そば'], 'buckwheat')).toBe(true);
  });

  it('maps Open Food Facts multilingual allergen tags and localizes labels', () => {
    const mapped = mapOpenFoodFactsAllergens([
      'en:milk',
      'en:molluscs',
      'en:celery',
      'en:mustard',
      'en:sulphur-dioxide-and-sulphites',
      'en:lupin',
      'ja:くるみ',
      'ja:そば',
    ]);
    expect(mapped).toEqual([
      'buckwheat',
      'celery',
      'lupin',
      'milk',
      'molluscs',
      'mustard',
      'sulphites',
      'walnut',
    ]);
    expect(localizeAllergenLabel('walnut', 'ja')).toBe('くるみ');
    expect(localizeAllergenLabel('celery', 'de')).toBe('Sellerie');
    expect(localizeAllergenLabel('molluscs', 'fr')).toBe('Mollusques');
  });

  it('enforces Kosher meat+dairy separation, Halal alcohol/pork rules, and whole-household member safety union', () => {
    expect(hasKosherConflict(['BEEF_SIRLOIN', 'OLIVE_OIL'])).toEqual({
      conflict: false,
      reasons: [],
    });
    expect(hasKosherConflict(['BEEF_SIRLOIN', 'BUTTER'])).toEqual({
      conflict: true,
      reasons: ['KOSHER_MEAT_DAIRY_MIX'],
    });
    expect(hasKosherConflict(['SHRIMP'])).toEqual({
      conflict: true,
      reasons: ['KOSHER_FORBIDDEN_SPECIES'],
    });
    expect(evaluateDietaryProfileConflicts(['CHICKEN_THIGH', 'MIRIN'], ['halal'])).toEqual([
      'DIETARY_CONFLICT:halal',
    ]);
    expect(evaluateDietaryProfileConflicts(['SOBA_BUCKWHEAT', 'TOFU'], ['vegan', 'gluten_free'])).toEqual([]);

    // Whole-household member safety union: child's buckwheat/peanut allergy merges into household hard policy
    const baseContext = RankingContextSchema.parse({
      householdId: 'home-jp-1',
      userId: 'parent-1',
      preferences: [
        { householdId: 'home-jp-1', userId: 'parent-1', values: { preferredCuisines: ['japanese'] } },
      ],
      feedback: [],
    });
    const merged = mergeHouseholdMemberSafetyIntoContext(baseContext, [
      {
        preferredCuisines: [],
        avoidedCuisines: [],
        likedIngredientIds: [],
        dislikedIngredientIds: [],
        forbiddenIngredientIds: ['PEANUT'],
        neverRecommendRecipeIds: [],
        allergens: ['buckwheat', 'walnut'],
        requiredDietaryTags: ['gluten_free'],
        mealNutritionTargets: [],
      },
    ]);
    const householdPolicy = merged.preferences.find((p) => p.userId === null)?.values;
    expect(householdPolicy?.allergens).toEqual(['buckwheat', 'walnut']);
    expect(householdPolicy?.forbiddenIngredientIds).toEqual(['PEANUT']);
    expect(householdPolicy?.requiredDietaryTags).toEqual(['gluten_free']);
  });
});

describe('Global Phase 2 — Culinary Units, Retail Reference Pricing & Week Pasta Pricing Fix', () => {
  it('distinguishes Japanese cup (200ml) & go (180ml / 150g rice) from US cup (240ml) and European cl/dl', () => {
    expect(parseLocalizedCulinaryUnit('カップ', { locale: 'ja' })).toBe('cup_jp');
    expect(parseLocalizedCulinaryUnit('cup', { locale: 'en' })).toBe('cup_us');
    expect(convertCulinaryQuantity(1, 'cup_jp', 'ml')).toBe(200);
    expect(convertCulinaryQuantity(1, 'cup_us', 'ml')).toBe(240);
    expect(convertCulinaryQuantity(1, 'go', 'ml')).toBe(180);
    expect(normalizeToStandardUnit(2, 'go', 'RICE')).toEqual({ quantity: 300, unit: 'g' });
    expect(convertCulinaryQuantity(25, 'cl', 'ml')).toBe(250);
    expect(convertCulinaryQuantity(2, 'dl', 'ml')).toBe(200);
    expect(parseLocalizedCulinaryUnit('EL', { locale: 'de' })).toBe('tbsp');
    expect(parseLocalizedCulinaryUnit('大さじ', { locale: 'ja' })).toBe('tbsp');
    expect(convertCulinaryQuantity(1, 'pack', 'g', 'TOFU')).toBe(300); // 1丁 = 300g
    expect(convertCulinaryQuantity(1, 'pack', 'g', 'NATTO')).toBe(45); // 1パック = 45g
  });

  it('fixes the 180g pasta vs pack unit-mismatch bug and computes EU 98/6/EC & JP reference unit prices', () => {
    const pastaCost = defaultPriceProvider.estimateCost('SPAGHETTI_PASTA', 180, 'g');
    // 180g / 500g pack = 0.36 pack -> 12,600đ..16,200đ (NEVER 35,000 * 180 = 6,300,000đ!)
    expect(pastaCost).toEqual({ minVnd: 12600, maxVnd: 16200, isEstimated: false });

    const jpTofu = estimateGlobalIngredientCost('TOFU', 300, 'g', 'JPY');
    expect(jpTofu).toEqual({
      currency: 'JPY',
      minAmountMinor: 88,
      maxAmountMinor: 148,
      minorDigits: 0,
      isEstimated: false,
    });

    // EU Grundpreis: 250g butter at €2.49 (249 cents) -> €9.96/kg (996 cents / 1kg)
    expect(
      computeReferenceUnitPrice({
        priceAmountMinor: 249,
        currency: 'EUR',
        netQuantity: 250,
        netUnit: 'g',
      }),
    ).toEqual({
      currency: 'EUR',
      referenceAmountMinor: 996,
      minorDigits: 2,
      referenceBasis: '1kg',
    });

    // Japan supermarket unit price: 350g chicken breast at ¥343 -> ¥98 / 100g
    expect(
      computeReferenceUnitPrice({
        priceAmountMinor: 343,
        currency: 'JPY',
        netQuantity: 350,
        netUnit: 'g',
      }),
    ).toEqual({
      currency: 'JPY',
      referenceAmountMinor: 98,
      minorDigits: 0,
      referenceBasis: '100g',
    });

    expect(sodiumMgToSaltGrams(1000)).toBe(2.54);
    expect(kcalToKj(250)).toBe(1046);
    expect(recommendedStorageZoneForIngredient('SALMON_FILLET')).toBe('chilled');
    expect(recommendedStorageZoneForIngredient('SPINACH')).toBe('veg_crisper');
    expect(findCanonicalIngredient('ごま油', { includeGlobalLocales: true })?.id).toBe('SESAME_OIL');
  });
});

describe('Global Phase 2 — Dual-Expiry (Reiwa + EU), Multi-Currency OCR & Regional AI Compliance', () => {
  it('parses Japanese 消費期限/賞味期限 + Reiwa dates and European MHD / DLC / DDM dates', () => {
    expect(parseLocalizedExpiryLabel('消費期限 R8.11.25 午後11時', { locale: 'ja' })).toEqual({
      expiryDate: '2026-11-25',
      regime: 'USE_BY',
      expiryHour: 23,
    });
    expect(parseLocalizedExpiryLabel('賞味期限 令和8年12月5日', { locale: 'ja' })).toEqual({
      expiryDate: '2026-12-05',
      regime: 'BEST_BEFORE',
    });
    expect(parseLocalizedExpiryLabel('令和元年5月1日', { locale: 'ja' })).toEqual({
      expiryDate: '2019-05-01',
      regime: 'UNKNOWN',
    });
    expect(parseLocalizedExpiryLabel('Mindestens haltbar bis: 25.11.2026', { locale: 'de' })).toEqual({
      expiryDate: '2026-11-25',
      regime: 'BEST_BEFORE',
    });
    expect(parseLocalizedExpiryLabel('Zu verbrauchen bis 28.11.26', { locale: 'de' })).toEqual({
      expiryDate: '2026-11-28',
      regime: 'USE_BY',
    });
    expect(parseLocalizedExpiryLabel("DLC: à consommer jusqu'au 30/11/2026", { locale: 'fr' })).toEqual({
      expiryDate: '2026-11-30',
      regime: 'USE_BY',
    });
  });

  it('normalizes JP tax-annotated prices, EU comma decimals, multi-currency minor units, and 半額 markdowns', () => {
    // Legacy VN thousands dot preserved when no EU locale/currency is passed
    expect(normalizeOcrNumber('42.000đ')).toBe(42000);
    // Japanese full-width & reduced tax rate annotation (¥298(外8%) -> 298, NOT 2988!)
    expect(normalizeOcrNumber('￥２９８（軽8%）', { locale: 'ja', currency: 'JPY' })).toBe(298);
    expect(normalizeOcrNumber('¥298(外8%)', { locale: 'ja', currency: 'JPY' })).toBe(298);
    // European decimal comma (including 3-decimal weighed produce 1,250 kg = 1.25!)
    expect(normalizeOcrNumber('1,250', { locale: 'de', currency: 'EUR', isQuantity: true })).toBe(1.25);
    expect(normalizeOcrNumber('1,99 €', { locale: 'de', currency: 'EUR' })).toBe(1.99);
    expect(normalizeOcrNumber('-0,25 €', { locale: 'de', currency: 'EUR' })).toBe(-0.25);
    expect(toCurrencyMinorUnits('1,99 €', 'EUR')).toBe(199);
    expect(toCurrencyMinorUnits('¥298(外8%)', 'JPY')).toBe(298);

    // Japanese 半額 (50% off) receipt line passes quality gate instead of being rejected
    const gated = applyReceiptScanQualityGate({
      merchant_name: 'ライフ (Life)',
      currency: 'JPY',
      total_amount_minor: 199,
      items: [
        {
          raw_name: '国産鶏唐揚げ弁当 (半額)',
          estimated_quantity: 1,
          unit: 'piece',
          currency: 'JPY',
          unit_price_minor: 398,
          total_price_minor: 199,
          discount_amount_minor: -199,
          confidence: 0.94,
        },
      ],
    });
    expect(gated.items).toHaveLength(1);
    expect(gated.items[0].total_price_minor).toBe(199);

    // Scan-evidence multi-currency minor units (EUR & JPY)
    expect(receiptPurchasePrice(199, 'EUR')).toEqual({ currency: 'EUR', amountMinor: 199, minorDigits: 2 });
    expect(receiptPurchasePrice(298, 'JPY')).toEqual({ currency: 'JPY', amountMinor: 298, minorDigits: 0 });
    expect(
      receiptLineFacts(
        'RECEIPT',
        { purchase_date: '2026-11-22', currency: 'EUR' },
        { total_price_minor: 349, estimated_quantity: 1 },
      ),
    ).toEqual({
      purchasedAt: '2026-11-22',
      purchasePrice: { currency: 'EUR', amountMinor: 349, minorDigits: 2 },
    });

    // ScanContractV3 accepts EUR & GBP money fields
    const v3 = parseScanV3({
      schemaVersion: 3,
      task: 'receipt_ocr',
      document: { documentId: 'doc1', sourceId: 'src1' },
      merchantName: { state: 'unknown', reason: 'missing' },
      invoiceNumber: { state: 'unknown', reason: 'missing' },
      purchaseDate: { state: 'unknown', reason: 'missing' },
      totalAmount: {
        state: 'known',
        value: { amountMinor: 1299, currency: 'EUR', minorDigits: 2 },
        basis: 'source_extraction',
        evidence: [{ kind: 'source_text', documentId: 'doc1', sourcePosition: 0, text: '12,99 EUR' }],
      },
      tax: { state: 'unknown', reason: 'missing' },
      discount: { state: 'unknown', reason: 'missing' },
      items: [],
    });
    expect(v3.ok).toBe(true);
  });

  it('blocks Meta Llama-3.2 Vision in EU jurisdiction and Mainland China endpoints for EU & JP', async () => {
    expect(() =>
      assertEuVisionModelAllowed('@cf/meta/llama-3.2-11b-vision-instruct', 'EU'),
    ).toThrow(/EU_MODEL_LICENSE_RESTRICTED|prohibited in the EU/);
    expect(() =>
      assertEuVisionModelAllowed('@cf/meta/llama-3.2-11b-vision-instruct', 'JP'),
    ).not.toThrow();

    expect(() =>
      assertJurisdictionEndpointAllowed('https://dashscope.aliyuncs.com/compatible-mode/v1', 'EU', 'qwen'),
    ).toThrow(/prohibited for EU data residency/);
    expect(() =>
      assertJurisdictionEndpointAllowed('https://api.deepseek.com/v1', 'JP', 'deepseek'),
    ).toThrow(/prohibited for JP data residency/);
    // International Singapore endpoint is permitted for JP
    expect(() =>
      assertJurisdictionEndpointAllowed('https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'JP', 'qwen'),
    ).not.toThrow();

    const cfProvider = new CloudflareAIProvider({ run: async () => ({ response: '{}' }) }, 'EU');
    await expect(
      cfProvider.vision({ imageBase64OrUrl: 'AQI=' }),
    ).rejects.toMatchObject({ code: 'EU_MODEL_LICENSE_RESTRICTED', retryable: false });
  });
});
