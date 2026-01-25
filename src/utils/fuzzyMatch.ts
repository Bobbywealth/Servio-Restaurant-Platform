/**
 * Fuzzy matching utilities for natural language processing
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns number of edits needed to transform s1 into s2
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-100)
 * 100 = exact match, 0 = completely different
 */
export function similarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);

  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Partial ratio - best matching substring
 */
export function partialRatio(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1.length === 0 || str2.length === 0) return 0;

  const shorter = str1.length < str2.length ? str1 : str2;
  const longer = str1.length < str2.length ? str2 : str1;

  if (longer.includes(shorter)) return 100;

  // Check all substrings of longer string
  let bestScore = 0;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    const substring = longer.substring(i, i + shorter.length);
    const score = similarity(shorter, substring);
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

/**
 * Token set ratio - compare words regardless of order
 */
export function tokenSetRatio(s1: string, s2: string): number {
  const tokens1 = s1.toLowerCase().trim().split(/\s+/).sort();
  const tokens2 = s2.toLowerCase().trim().split(/\s+/).sort();

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Best fuzzy match - combines multiple strategies
 */
export function fuzzyMatch(s1: string, s2: string): number {
  const simple = similarity(s1, s2);
  const partial = partialRatio(s1, s2);
  const tokenSet = tokenSetRatio(s1, s2);

  // Return highest score from different strategies
  return Math.max(simple, partial, tokenSet);
}

export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
  field: string;
}

/**
 * Find best matches from a list of items
 * @param query - Search query
 * @param items - Array of items to search
 * @param field - Field name to search in each item
 * @param threshold - Minimum score to include (0-100)
 * @param limit - Maximum number of results
 */
export function findBestMatches<T>(
  query: string,
  items: T[],
  field: keyof T,
  threshold: number = 60,
  limit: number = 5
): FuzzyMatchResult<T>[] {
  if (!query || query.trim().length === 0) return [];

  const results: FuzzyMatchResult<T>[] = items
    .map(item => {
      const fieldValue = String(item[field] || '');
      const score = fuzzyMatch(query, fieldValue);
      return { item, score, field: String(field) };
    })
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

/**
 * Check if a match needs confirmation
 */
export function needsConfirmation(score: number): boolean {
  return score < 85 && score >= 60;
}
