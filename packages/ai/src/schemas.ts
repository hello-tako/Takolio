import { z } from 'zod';
import type { AIFailureDiagnostics } from './failure-diagnostics';

export const StandardUnitSchema = z.enum([
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'pack',
  'bunch',
  'slice'
]);

export const DetectedIngredientSchema = z.object({
  raw_name: z.string().min(1, 'Tên nguyên liệu không được để trống').max(200),
  estimated_quantity: z.number().positive('Số lượng phải lớn hơn 0'),
  unit: StandardUnitSchema,
  // T13R-B: like receipts, a fridge line whose provider reported no confidence
  // is UNKNOWN. A required field forced every provider to invent one.
  confidence: z.number().min(0).max(1).optional(),
  canonical_id: z.string().max(100).optional(),
  category: z.string().max(80).optional(),
  storage: z.enum(['fridge', 'freezer', 'pantry']).optional().default('fridge'),
});

export const VisionScanResultSchema = z.object({
  items: z.array(DetectedIngredientSchema).max(50),
});

export const ReceiptItemSchema = z.object({
  raw_name: z.string().min(1, 'Tên sản phẩm không được để trống').max(200),
  estimated_quantity: z.number().positive('Số lượng phải lớn hơn 0'),
  unit: StandardUnitSchema,
  unit_price_vnd: z.number().nonnegative().optional(),
  total_price_vnd: z.number().nonnegative().optional(),
  canonical_id: z.string().max(100).optional(),
  category: z.string().max(80).optional(),
  storage: z.enum(['fridge', 'freezer', 'pantry']).optional().default('fridge'),
  // T13: a missing confidence is unknown, not high. Defaulting to 0.9 claimed
  // certainty the model never expressed, so absence must stay absent.
  confidence: z.number().min(0).max(1).optional(),
});

export const ReceiptScanResultSchema = z.object({
  // T13: no fabricated merchant. An unread merchant name stays absent rather
  // than becoming a plausible-looking "Siêu thị".
  merchant_name: z.string().max(200).optional(),
  invoice_number: z.string().max(120).optional(),
  purchase_date: z.string().max(40).optional(),
  total_amount_vnd: z.number().nonnegative().optional(),
  items: z.array(ReceiptItemSchema).max(50),
});

export type DetectedIngredient = z.infer<typeof DetectedIngredientSchema>;
export type VisionScanResult = z.infer<typeof VisionScanResultSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type ReceiptScanResult = z.infer<typeof ReceiptScanResultSchema>;

export interface AIUsageLog extends AIFailureDiagnostics {
  userId?: string;
  task: 'fridge_scan' | 'receipt_scan' | 'ingredient_normalization' | 'recipe_rank' | 'chat'
    | 'recipe_generation' | 'recipe_ranking' | 'recipe_explanation' | 'fridge_chat' | 'receipt_ocr' | 'label_ocr'
    | 'fridge_image_analysis' | 'weekly_plan' | 'weekly_plan_repair' | 'weekly_plan_complex'
    | 'inventory_candidate_extraction' | 'offline_evaluation';
  provider: string;
  model: string;
  logicalModel?: string;
  physicalModel?: string;
  promptId?: string;
  promptVersion?: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  latencyMs: number;
  estimatedCostUsd?: number;
  pricingVersion?: string;
  estimatedCost: number;
  attempt?: number;
  escalationReason?: string;
  failureCode?: string;
  status: 'success' | 'error' | 'fallback';
  createdAt: string;
}
