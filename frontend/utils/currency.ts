const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "\u20aa",
  USD: "$",
  EUR: "\u20ac",
  GBP: "\u00a3",
  HUF: "Ft",
};

export function formatCurrency(amount: number, currencyCode = "ILS"): string {
  const code = currencyCode.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  if (symbol) return `${Math.round(amount)} ${symbol}`;
  return `${Math.round(amount)} ${code}`;
}