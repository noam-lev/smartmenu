export function formatILSCurrency(amount: number): string {
  return `${Math.round(amount)} \u20aa`;
}
