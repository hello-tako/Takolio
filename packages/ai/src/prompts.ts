import type { AITask } from './model-governance';

export interface PromptDefinition {
  id: string;
  version: string;
  task: AITask;
  system: string;
  structured: boolean;
}

const STATIC_RULES = 'Frigo AI chỉ tạo quan sát/dự đoán chưa được xác nhận. Không tự ghi inventory, không bịa số lượng, giá, hạn dùng, dinh dưỡng hoặc an toàn dị ứng.';

export const PROMPT_REGISTRY: Record<AITask, PromptDefinition> = {
  ingredient_normalization: {
    id: 'ingredient-normalization',
    version: '1',
    task: 'ingredient_normalization',
    structured: true,
    system: `${STATIC_RULES} Chuẩn hóa tên nguyên liệu vào danh mục đã cung cấp. `
      + 'Trả về JSON {"canonicalId": string|null, "confidence": number}; canonicalId phải đúng một ID trong danh mục hoặc null.',
  },
  recipe_generation: { id: 'recipe-generation', version: '1', task: 'recipe_generation', structured: true, system: `${STATIC_RULES} Đề xuất công thức có cấu trúc; không thực hiện phép tính tồn kho.` },
  recipe_ranking: { id: 'recipe-ranking', version: '1', task: 'recipe_ranking', structured: true, system: `${STATIC_RULES} Xếp hạng đúng các món được cung cấp; không thêm món mới.` },
  recipe_explanation: { id: 'recipe-explanation', version: '1', task: 'recipe_explanation', structured: true, system: `${STATIC_RULES} Chỉ sắp xếp các mã lý do được cung cấp; không thêm sự kiện mới.` },
  fridge_chat: { id: 'fridge-chat', version: '1', task: 'fridge_chat', structured: false, system: `${STATIC_RULES} Trả lời ngắn gọn, thân thiện và nêu rõ điều chưa biết.` },
  receipt_ocr: { id: 'receipt-ocr', version: '1', task: 'receipt_ocr', structured: true, system: `${STATIC_RULES} Bóc tách chữ và dòng hàng thô từ hóa đơn; giữ nguyên tên nhìn thấy.` },
  label_ocr: { id: 'label-ocr', version: '1', task: 'label_ocr', structured: true, system: `${STATIC_RULES} Trích xuất chữ in trên nhãn, không suy diễn thông tin không nhìn thấy.` },
  fridge_image_analysis: { id: 'fridge-image-analysis', version: '1', task: 'fridge_image_analysis', structured: true, system: `${STATIC_RULES} Nhận diện ứng viên thực phẩm trong ảnh; số lượng chỉ là ước tính có confidence.` },
  weekly_plan: { id: 'weekly-plan', version: '1', task: 'weekly_plan', structured: true, system: `${STATIC_RULES} Lập candidate plan từ context rút gọn; validator quyết định feasibility.` },
  weekly_plan_repair: { id: 'weekly-plan-repair', version: '1', task: 'weekly_plan_repair', structured: true, system: `${STATIC_RULES} Sửa candidate plan chỉ theo các lỗi validation được cung cấp.` },
  weekly_plan_complex: { id: 'weekly-plan-complex', version: '1', task: 'weekly_plan_complex', structured: true, system: `${STATIC_RULES} Xử lý xung đột planner khó; không thay thế deterministic validator.` },
  inventory_candidate_extraction: { id: 'inventory-candidate-extraction', version: '1', task: 'inventory_candidate_extraction', structured: true, system: `${STATIC_RULES} Tạo InventoryCandidate; kết quả phải qua normalization/reconciliation trước mutation.` },
  offline_evaluation: { id: 'offline-evaluation', version: '1', task: 'offline_evaluation', structured: true, system: 'Đánh giá output theo golden rubric. Không được sử dụng trong customer-facing routing.' },
};

export function getPromptDefinition(task: AITask): PromptDefinition {
  return PROMPT_REGISTRY[task];
}

export function buildPrompt(task: AITask, input: string, context?: string): string {
  const definition = getPromptDefinition(task);
  const contextBlock = context ? `\nDYNAMIC CONTEXT\n${context}` : '';
  return `${definition.system}\n\nSTATIC OUTPUT CONTRACT\nReturn only the requested ${definition.structured ? 'JSON' : 'text'} value.\n${contextBlock}\nDYNAMIC INPUT\n${input}`;
}

export function buildLocalizedVisionPrompt(options?: {
  locale?: string;
  countryCode?: string;
}): string | undefined {
  const locale = options?.locale?.trim().toLowerCase();
  const country = options?.countryCode?.trim().toUpperCase();
  if (!locale && !country) return undefined;
  const baseLang = locale?.split(/[-_]/)[0] ?? 'en';
  if (baseLang === 'vi' && (!country || country === 'VN')) return undefined;

  if (baseLang === 'ja' || country === 'JP') {
    return `あなたは日本の冷蔵庫・食材認識AI（Takolio）です。画像を解析し、見えている食材のみを以下の有効なJSONオブジェクト1つだけで返してください（推測・捏造禁止）：
{
  "items": [
    {
      "raw_name": "日本語の食材名（例：鶏むね肉、木綿豆腐、納豆、長ねぎ、卵）",
      "estimated_quantity": 300,
      "unit": "g" | "kg" | "ml" | "l" | "piece" | "pack" | "bunch" | "slice",
      "storage": "fridge" | "freezer" | "pantry",
      "storage_zone": "fridge" | "veg_crisper" | "chilled" | "freezer" | "pantry",
      "expiry_date": "YYYY-MM-DD（印字が見える場合のみ。令和R8=2026年に変換）",
      "expiry_regime": "USE_BY（消費期限）" | "BEST_BEFORE（賞味期限）",
      "confidence": 0.95
    }
  ]
}
JSONのみを返し、コードブロックや説明文を含めないでください。`;
  }

  return `You are Takolio's multilingual food & refrigerator vision specialist (target locale: ${baseLang}, market: ${country || 'GLOBAL'}).
Analyze the image and return ONLY a single valid JSON object with observable food items (never fabricate unseen items or dates):
{
  "items": [
    {
      "raw_name": "Localized food name in '${baseLang}' (e.g. Hähnchenbrust, Tomates, Latte intero, Chicken breast)",
      "estimated_quantity": 250,
      "unit": "g" | "kg" | "ml" | "l" | "piece" | "pack" | "bunch" | "slice",
      "storage": "fridge" | "freezer" | "pantry",
      "expiry_date": "YYYY-MM-DD (only when printed on packaging; convert DD.MM.YYYY or DD/MM/YYYY to YYYY-MM-DD)",
      "expiry_regime": "USE_BY (zu verbrauchen bis / DLC / Use by)" | "BEST_BEFORE (MHD / DDM / Best before)",
      "confidence": 0.95
    }
  ]
}
Return raw JSON only without markdown fences.`;
}

export function buildLocalizedReceiptPrompt(options?: {
  locale?: string;
  countryCode?: string;
  currency?: string;
}): string | undefined {
  const locale = options?.locale?.trim().toLowerCase();
  const country = options?.countryCode?.trim().toUpperCase();
  const currency = options?.currency?.trim().toUpperCase();
  if (!locale && !country && !currency) return undefined;
  const baseLang = locale?.split(/[-_]/)[0] ?? 'en';
  if (baseLang === 'vi' && (!country || country === 'VN') && (!currency || currency === 'VND')) {
    return undefined;
  }

  if (baseLang === 'ja' || country === 'JP' || currency === 'JPY') {
    return `あなたは日本のスーパー・コンビニレシートOCRシステム（Takolio）です。
レシート画像から店舗名・購入日・合計金額（円）および食品明細のみを抽出し、以下のJSONオブジェクト1つだけを返してください：
- 軽減税率記号（※、軽、外8%、内8%）は金額に含めないこと（例：「¥298(外8%)」→ 298）
- 半額・値引シール行がある場合は discount_amount_minor に値引き額（整数円）を記録し、total_price_minor に割引後金額を入れること
- 令和表記（例：R8年11月25日）は西暦 YYYY-MM-DD（2026-11-25）に変換すること
- レジ袋・日用品・小計・消費税・お預り・お釣り行は除外すること
{
  "merchant_name": "店舗名",
  "invoice_number": "レシート番号",
  "purchase_date": "YYYY-MM-DD",
  "currency": "JPY",
  "total_amount_minor": 1580,
  "items": [
    {
      "raw_name": "商品名",
      "estimated_quantity": 1,
      "unit": "piece" | "pack" | "g" | "kg" | "bunch" | "ml" | "l" | "slice",
      "currency": "JPY",
      "unit_price_minor": 298,
      "total_price_minor": 298,
      "discount_amount_minor": 0,
      "confidence": 0.94
    }
  ]
}`;
  }

  const targetCurrency = currency || 'EUR';
  return `You are Takolio's European & global grocery receipt OCR engine (locale: ${baseLang}, currency: ${targetCurrency}).
Extract store name, purchase date (YYYY-MM-DD), total in minor currency units (e.g. EUR cents: 1,99 EUR -> 199), and ONLY food line items:
- Parse European comma decimals accurately (e.g. "0,462 kg x 2,99 EUR/kg = 1,38 EUR" -> estimated_quantity: 462, unit: "g", total_price_minor: 138).
- Ignore non-food lines, bottle deposits (Pfand / Leergut), VAT summary lines (MwSt / TVA / IVA), and payment tenders.
- Never invent unread prices, merchants, or dates.
{
  "merchant_name": "Store name",
  "invoice_number": "Receipt ID",
  "purchase_date": "YYYY-MM-DD",
  "currency": "${targetCurrency}",
  "total_amount_minor": 1250,
  "items": [
    {
      "raw_name": "Food item name as printed",
      "estimated_quantity": 1,
      "unit": "piece" | "pack" | "g" | "kg" | "bunch" | "ml" | "l" | "slice",
      "currency": "${targetCurrency}",
      "unit_price_minor": 199,
      "total_price_minor": 199,
      "confidence": 0.93
    }
  ]
}`;
}
