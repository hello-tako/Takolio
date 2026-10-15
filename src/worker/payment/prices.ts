import type { PlusPlan } from '../../shared/payment';
import type { Env } from '../types';

export const PLUS_PRICES: Readonly<Record<PlusPlan, number>> = Object.freeze({
  monthly: 49000,
  annual: 499000,
});

export function effectivePlusPrices(env: Pick<Env, 'PAYOS_TEST_MONTHLY_PRICE_VND'> = {}): Readonly<Record<PlusPlan, number>> {
  const testPrice = env.PAYOS_TEST_MONTHLY_PRICE_VND;
  if (testPrice === undefined) return PLUS_PRICES;
  if (testPrice !== '2000') throw new Error('PAYMENT_PRICE_CONFIGURATION_INVALID');
  // Only the operator's temporary acceptance offer changes; issued orders keep their persisted price.
  return { ...PLUS_PRICES, monthly: 2000 };
}
