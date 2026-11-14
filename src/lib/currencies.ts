import type { CurrencyCode, CurrencyMeta } from '../types/platform.ts';

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rateFromInr: 1, decimals: 0 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rateFromInr: 0.01185, decimals: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rateFromInr: 0.01095, decimals: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rateFromInr: 0.00932, decimals: 2 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', rateFromInr: 0.04352, decimals: 2 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rateFromInr: 0.01586, decimals: 2 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rateFromInr: 1.823, decimals: 0 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rateFromInr: 0.01811, decimals: 2 },
};

export const CURRENCY_LIST: CurrencyMeta[] = Object.values(CURRENCIES);

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const inrValue = amount / CURRENCIES[from].rateFromInr;
  return inrValue * CURRENCIES[to].rateFromInr;
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const meta = CURRENCIES[currency];
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(amount);
}

export function getMidMarketRate(from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return 1;
  return CURRENCIES[to].rateFromInr / CURRENCIES[from].rateFromInr;
}
