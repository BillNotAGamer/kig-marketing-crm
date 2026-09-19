/**
 * Normalizes a brand name for duplicate comparison:
 * trim, collapse repeated whitespace, and lowercase.
 */
export function normalizeBrandName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Checks whether a candidate brand name matches any existing brand name
 * after normalization.
 */
export function isDuplicateBrand(
  candidate: string,
  existingBrands: readonly string[],
): boolean {
  const normalizedCandidate = normalizeBrandName(candidate);
  return existingBrands.some(
    (existing) => normalizeBrandName(existing) === normalizedCandidate,
  );
}
