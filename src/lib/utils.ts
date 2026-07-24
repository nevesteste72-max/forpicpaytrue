import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  BRL: "R$",
  ZAR: "R",
  NGN: "₦",
  MZN: "MZN",
};

/** Symbol for a currency code (falls back to the code itself). */
export function currencySymbol(currency?: string | null): string {
  if (!currency) return "";
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}

/** Format an amount with its currency symbol and 2 decimals, e.g. "€ 9,90". */
export function formatMoney(amount: number | string, currency?: string | null, locale = "pt-PT"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const value = Number.isFinite(n) ? n : 0;
  return `${currencySymbol(currency)} ${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
