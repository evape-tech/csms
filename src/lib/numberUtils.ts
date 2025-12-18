/**
 * Utilities for converting database Decimal/string values to JS numbers
 */
export function decimalToNumber(value: any, fractionDigits?: number): number {
  if (value === null || value === undefined) return 0;

  // Plain number
  if (typeof value === 'number') {
    return typeof fractionDigits === 'number' ? Number(value.toFixed(fractionDigits)) : value;
  }

  // String
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return 0;
    return typeof fractionDigits === 'number' ? Number(parsed.toFixed(fractionDigits)) : parsed;
  }

  // Prisma Decimal-like
  if (typeof value?.toNumber === 'function') {
    const n = value.toNumber();
    return typeof fractionDigits === 'number' ? Number(n.toFixed(fractionDigits)) : n;
  }

  // Fallback to toString
  if (typeof value?.toString === 'function') {
    const parsed = parseFloat(value.toString());
    if (Number.isNaN(parsed)) return 0;
    return typeof fractionDigits === 'number' ? Number(parsed.toFixed(fractionDigits)) : parsed;
  }

  const n = Number(value);
  return typeof fractionDigits === 'number' ? Number(n.toFixed(fractionDigits)) : (Number.isNaN(n) ? 0 : n);
}
