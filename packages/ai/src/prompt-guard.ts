import { z } from 'zod';
import { AIProviderError } from './errors';

export const PromptGuardResultSchema = z.object({
  safe: z.boolean(),
  sanitizedText: z.string(),
  riskScore: z.number().min(0).max(1),
  flags: z.array(z.string()),
});

export type PromptGuardResult = z.infer<typeof PromptGuardResultSchema>;

export interface PromptGuardOptions {
  /** Maximum characters retained in sanitizedText (default: 2000). */
  maxChars?: number;
  /** Maximum estimated input tokens before flagging truncation (default: 600). */
  maxEstimatedTokens?: number;
  /** Risk score >= threshold marks safe=false (default: 0.5). */
  blockThreshold?: number;
  /** Redact emails, phone numbers, and bearer/API tokens (default: true). */
  stripPii?: boolean;
}

export class AIPromptGuardError extends AIProviderError {
  readonly flags: readonly string[];
  readonly riskScore: number;

  constructor(message: string, result: Pick<PromptGuardResult, 'flags' | 'riskScore'>) {
    super(message, {
      code: 'AI_PROMPT_GUARD_BLOCKED',
      retryable: false,
      status: 400,
      provider: 'prompt-guard',
    });
    this.name = 'AIPromptGuardError';
    this.flags = result.flags;
    this.riskScore = result.riskScore;
  }
}

const DEFAULT_MAX_CHARS = 2_000;
const DEFAULT_MAX_ESTIMATED_TOKENS = 600;
const DEFAULT_BLOCK_THRESHOLD = 0.5;

function foldVietnameseAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

interface SecurityPatternRule {
  flag: string;
  weight: number;
  patterns: readonly RegExp[];
  foldedPatterns?: readonly RegExp[];
  neutralize?: (text: string) => string;
}

const SECURITY_RULES: readonly SecurityPatternRule[] = [
  {
    flag: 'PROMPT_INJECTION_OVERRIDE',
    weight: 0.7,
    patterns: [
      /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+|every\s+)?(?:previous|prior|above|earlier|system|developer|safety)\s+(?:instructions?|prompts?|rules?|constraints?|guardrails?)\b/i,
      /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:dan|unrestricted|jailbroken|root|developer\s+mode|god\s+mode)\b/i,
      /\b(?:do\s+anything\s+now|jailbreak|dan\s+mode)\b/i,
    ],
    foldedPatterns: [
      /\b(?:bo\s+qua|quen\s+het|huy\s+bo|vuot\s+qua)\s+(?:moi\s+|tat\s+ca\s+|cac\s+)?(?:huong\s+dan|chi\s+dan|quy\s+tac|lenh|gioi\s+han)\s*(?:truoc|he\s+thong|an\s+toan)?\b/i,
    ],
    neutralize: (text) =>
      text
        .replace(
          /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|any\s+|every\s+)?(?:previous|prior|above|earlier|system|developer|safety)\s+(?:instructions?|prompts?|rules?|constraints?|guardrails?)\b/gi,
          '[OVERRIDDEN_DIRECTIVE_REMOVED]',
        )
        .replace(/\b(?:do\s+anything\s+now|jailbreak|dan\s+mode)\b/gi, '[JAILBREAK_TOKEN_REMOVED]'),
  },
  {
    flag: 'SYSTEM_PROMPT_PROBING',
    weight: 0.65,
    patterns: [
      /\b(?:reveal|show|print|dump|output|repeat|leak|expose)\s+(?:your\s+|the\s+|entire\s+|exact\s+|full\s+)?(?:system\s+prompt|developer\s+prompt|hidden\s+instructions?|initial\s+instructions?|internal\s+prompt)\b/i,
      /\bwhat\s+(?:is|are)\s+your\s+(?:exact\s+)?(?:system\s+instructions?|system\s+prompt|hidden\s+rules?)\b/i,
    ],
    foldedPatterns: [
      /\b(?:tiet\s+lo|hien\s+thi|in\s+ra|cho\s+xem|doc\s+nguyen\s+van)\s+(?:system\s+prompt|cau\s+lenh\s+goc|huong\s+dan\s+he\s+thong|prompt\s+noi\s+bo)\b/i,
    ],
    neutralize: (text) =>
      text.replace(
        /\b(?:reveal|show|print|dump|output|repeat|leak|expose)\s+(?:your\s+|the\s+|entire\s+|exact\s+|full\s+)?(?:system\s+prompt|developer\s+prompt|hidden\s+instructions?|initial\s+instructions?|internal\s+prompt)\b/gi,
        '[PROMPT_PROBE_REMOVED]',
      ),
  },
  {
    flag: 'ROLE_DELIMITER_SPOOFING',
    weight: 0.55,
    patterns: [
      /<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/i,
      /\[\/?INST\]|<<\/?SYS>>/i,
      /(?:^|\n)\s*(?:###\s*)?(?:system|developer)\s*(?:instruction|prompt|message)?\s*:/i,
    ],
    neutralize: (text) =>
      text
        .replace(/<\|(?:im_start|im_end|system|user|assistant|endoftext)\|>/gi, ' ')
        .replace(/\[\/?INST\]|<<\/?SYS>>/gi, ' ')
        .replace(/(^|\n)\s*(?:###\s*)?(?:system|developer)\s*(?:instruction|prompt|message)?\s*:/gi, '$1'),
  },
  {
    flag: 'SCRIPT_HTML_PAYLOAD',
    weight: 0.75,
    patterns: [
      /<\s*\/?\s*(?:script|iframe|object|embed|svg|meta|link)\b[^>]*>/i,
      /\bjavascript\s*:/i,
      /\bon(?:error|load|click|mouseover|focus)\s*=/i,
    ],
    neutralize: (text) =>
      text
        .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
        .replace(/<\s*\/?\s*[a-z][a-z0-9-]*\b[^>]*>/gi, ' ')
        .replace(/\bjavascript\s*:/gi, '')
        .replace(/\bon(?:error|load|click|mouseover|focus)\s*=/gi, ''),
  },
  {
    flag: 'SQL_COMMAND_PAYLOAD',
    weight: 0.7,
    patterns: [
      /\bUNION\s+(?:ALL\s+)?SELECT\b/i,
      /\b(?:DROP|ALTER|TRUNCATE)\s+TABLE\b/i,
      /;\s*(?:DELETE\s+FROM|UPDATE\s+\w+\s+SET|INSERT\s+INTO)\b/i,
      /(?:;|\|\||&&|\$\()\s*(?:rm\s+-rf|curl\s+|wget\s+|nc\s+|bash\s+-c|sh\s+-c|cat\s+\/etc\/passwd)\b/i,
      /\/etc\/(?:passwd|shadow)\b/i,
    ],
    neutralize: (text) =>
      text
        .replace(/\bUNION\s+(?:ALL\s+)?SELECT\b/gi, '[SQL_BLOCKED]')
        .replace(/\b(?:DROP|ALTER|TRUNCATE)\s+TABLE\b/gi, '[SQL_BLOCKED]')
        .replace(/\/etc\/(?:passwd|shadow)\b/gi, '[PATH_BLOCKED]'),
  },
];

// PII patterns — stripped silently (low risk increment so normal user questions with accidental phone/email still succeed safely).
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g;
// Vietnamese mobile/landline (+84 / 84 / 0 followed by 9-10 digits) and international numbers; avoids matching short cooking numbers like "180 độ" or "300g".
const PHONE_RE = /(?:\+?84[\s.-]?|0)(?:3|5|7|8|9|2\d)(?:[\s.-]?\d){8}\b/g;
const SECRET_TOKEN_RE =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;

// Control characters (excluding standard \n and \t) + zero-width / bidi spoofing codepoints.
const CONTROL_AND_BIDI_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/**
 * Inspects outbound user input for prompt injection, role spoofing, XSS/SQL/shell
 * payloads, PII leakage, and token-budget overflows before any LLM call.
 */
export function inspectAndSanitizePrompt(rawInput: string, options: PromptGuardOptions = {}): PromptGuardResult {
  const maxChars = Math.max(64, options.maxChars ?? DEFAULT_MAX_CHARS);
  const maxEstimatedTokens = Math.max(32, options.maxEstimatedTokens ?? DEFAULT_MAX_ESTIMATED_TOKENS);
  const blockThreshold = options.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD;
  const stripPii = options.stripPii !== false;

  const flags = new Set<string>();
  let riskScore = 0;
  let working = typeof rawInput === 'string' ? rawInput : String(rawInput ?? '');

  if (CONTROL_AND_BIDI_RE.test(working)) {
    flags.add('CONTROL_CHARS_STRIPPED');
    riskScore += 0.05;
    working = working.replace(CONTROL_AND_BIDI_RE, '');
  }
  CONTROL_AND_BIDI_RE.lastIndex = 0;

  if (working.length > maxChars * 2.5) {
    flags.add('INPUT_EXCESSIVE_LENGTH');
    riskScore += 0.55;
  }

  const folded = foldVietnameseAccents(working);

  for (const rule of SECURITY_RULES) {
    const matchedRaw = rule.patterns.some((pattern) => pattern.test(working));
    const matchedFolded = rule.foldedPatterns ? rule.foldedPatterns.some((pattern) => pattern.test(folded)) : false;
    if (matchedRaw || matchedFolded) {
      flags.add(rule.flag);
      riskScore += rule.weight;
      if (rule.neutralize) {
        working = rule.neutralize(working);
      }
    }
  }

  if (stripPii) {
    if (SECRET_TOKEN_RE.test(working)) {
      flags.add('PII_SECRET_TOKEN_REDACTED');
      riskScore += 0.12;
      working = working.replace(SECRET_TOKEN_RE, '[TOKEN_REDACTED]');
    }
    SECRET_TOKEN_RE.lastIndex = 0;

    if (EMAIL_RE.test(working)) {
      flags.add('PII_EMAIL_REDACTED');
      riskScore += 0.08;
      working = working.replace(EMAIL_RE, '[EMAIL_REDACTED]');
    }
    EMAIL_RE.lastIndex = 0;

    if (PHONE_RE.test(working)) {
      flags.add('PII_PHONE_REDACTED');
      riskScore += 0.08;
      working = working.replace(PHONE_RE, '[PHONE_REDACTED]');
    }
    PHONE_RE.lastIndex = 0;
  }

  // Collapse excessive whitespace runs while preserving single line breaks.
  working = working
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n')
    .trim();

  const maxTokenCharCeiling = maxEstimatedTokens * 4;
  const effectiveCharCeiling = Math.min(maxChars, maxTokenCharCeiling);

  if (working.length > effectiveCharCeiling) {
    flags.add('INPUT_TRUNCATED');
    riskScore += 0.1;
    working = working.slice(0, effectiveCharCeiling).trim();
  }

  const boundedScore = Math.min(1, Math.round(Math.max(0, riskScore) * 100) / 100);
  return {
    safe: boundedScore < blockThreshold,
    sanitizedText: working,
    riskScore: boundedScore,
    flags: [...flags],
  };
}

/**
 * Recursively sanitizes string fields in a structured request payload before
 * building an LLM prompt, returning an aggregate guard verdict.
 */
export function guardStructuredStrings<T>(
  payload: T,
  options: PromptGuardOptions = {},
): { safe: boolean; sanitizedPayload: T; riskScore: number; flags: string[] } {
  const blockThreshold = options.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD;
  const allFlags = new Set<string>();
  let maxRiskScore = 0;

  function walk(node: unknown, depth: number): unknown {
    if (depth > 8 || node === null || node === undefined) return node;
    if (typeof node === 'string') {
      const inspected = inspectAndSanitizePrompt(node, options);
      for (const flag of inspected.flags) allFlags.add(flag);
      if (inspected.riskScore > maxRiskScore) maxRiskScore = inspected.riskScore;
      return inspected.sanitizedText;
    }
    if (Array.isArray(node)) {
      return node.slice(0, 150).map((item) => walk(item, depth + 1));
    }
    if (typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        next[key] = walk(value, depth + 1);
      }
      return next;
    }
    return node;
  }

  const sanitizedPayload = walk(payload, 0) as T;
  return {
    safe: maxRiskScore < blockThreshold,
    sanitizedPayload,
    riskScore: maxRiskScore,
    flags: [...allFlags],
  };
}
