import { AIProviderError } from './errors';
import type { AIConfig, AIJurisdiction } from './types';

const MAINLAND_CHINA_AI_HOSTS = new Set([
  'dashscope.aliyuncs.com',
  'api.deepseek.com',
  'open.bigmodel.cn',
]);

export function resolveJurisdictionFromCountry(countryCode?: string | null): AIJurisdiction {
  const upper = countryCode?.trim().toUpperCase();
  if (!upper) return 'GLOBAL';
  if (upper === 'VN') return 'VN';
  if (upper === 'JP') return 'JP';
  // EEA 30 + UK + CH
  if (
    [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
      'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
      'IS', 'LI', 'NO', 'GB', 'CH',
    ].includes(upper)
  ) {
    return 'EU';
  }
  return 'GLOBAL';
}

export function resolveRegionalQwenBaseUrl(config: AIConfig): string | undefined {
  if (config.jurisdiction === 'EU' && config.aiEuBaseUrl?.trim()) {
    return config.aiEuBaseUrl.trim();
  }
  if (config.jurisdiction === 'JP' && config.aiJpBaseUrl?.trim()) {
    return config.aiJpBaseUrl.trim();
  }
  return config.qwenBaseUrl;
}

/**
 * Enforces GDPR Chapter V (EU) & APPI Art. 28 (Japan) cross-border AI data residency:
 * Mainland China AI endpoints (`dashscope.aliyuncs.com`, `api.deepseek.com`, `open.bigmodel.cn`)
 * are strictly blocked for EU & JP user image/receipt payloads.
 */
export function assertJurisdictionEndpointAllowed(
  endpointUrl: string,
  jurisdiction: AIJurisdiction | undefined,
  providerName: string,
): void {
  if (jurisdiction !== 'EU' && jurisdiction !== 'JP') return;
  try {
    const hostname = new URL(endpointUrl).hostname.toLowerCase();
    if (MAINLAND_CHINA_AI_HOSTS.has(hostname)) {
      throw new AIProviderError(
        `AI endpoint ${hostname} is prohibited for ${jurisdiction} data residency`,
        {
          code: 'JURISDICTION_ENDPOINT_RESTRICTED',
          retryable: false,
          provider: providerName,
        },
      );
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
  }
}

/**
 * Enforces Meta Llama 3.2 Acceptable Use Policy (multimodal models prohibited for
 * individuals/entities domiciled in the European Union).
 */
export function assertEuVisionModelAllowed(
  model: string,
  jurisdiction: AIJurisdiction | undefined,
): void {
  if (jurisdiction === 'EU' && /llama-3\.2.*vision/i.test(model)) {
    throw new AIProviderError(
      'Meta Llama 3.2 Vision is prohibited in the EU under the Llama 3.2 Acceptable Use Policy',
      {
        code: 'EU_MODEL_LICENSE_RESTRICTED',
        retryable: false,
        provider: 'cloudflare',
        model,
      },
    );
  }
}
