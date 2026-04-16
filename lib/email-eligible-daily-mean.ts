/**
 * MTD "daily average" for email tables: mean of daily values, excluding days where
 * that metric is null/undefined/NaN, and (by default) zero (no activity that day for that field).
 */
export function eligibleDailyMean(
  values: (number | null | undefined)[],
  excludeZero = true
): number {
  const nums: number[] = [];
  for (const x of values) {
    if (x == null || typeof x !== 'number' || Number.isNaN(x)) continue;
    if (excludeZero && x === 0) continue;
    nums.push(x);
  }
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
}
