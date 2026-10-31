/**
 * CaseMemory Entity Matcher & Contradiction Resolution Engine
 * Handles:
 * 1. Case-insensitive normalization & title stripping (Dr., Insp., Mr., etc.)
 * 2. Typo-tolerant fuzzy matching (Levenshtein & token similarity)
 * 3. Substring & alias resolution (e.g., "Vikram" matching "Vikram Malhotra" or "Vicky")
 * 4. Evidentiary contradiction detection (e.g., conflicting school/place/alibi names)
 */

export interface MatchResult<T> {
  match: T | null;
  similarity: number;
  matchType: "exact" | "alias" | "token" | "fuzzy" | "none";
  matchedName?: string;
}

export interface DiscrepancyReport {
  entityType: string;
  field: string;
  existingValue: string;
  newValue: string;
  entityName: string;
  description: string;
  resolutionOptions: string[];
}

const COMMON_TITLES = new Set([
  "mr", "mrs", "ms", "dr", "doctor", "prof", "professor",
  "insp", "inspector", "si", "sub-inspector", "det", "detective",
  "officer", "constable", "guard", "head", "chief", "senior",
  "shri", "smt", "advocate", "adv"
]);

/**
 * Normalizes an entity name:
 * - lowercase & trims whitespace
 * - strips honorifics/prefixes (Dr., Insp., Mr., etc.)
 * - removes quotes, brackets, and non-alphanumeric punctuation
 */
export function normalizeEntityName(name: string): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();

  // Remove common punctuation except spaces and hyphens
  clean = clean.replace(/['"“”‘’()[\]{}]/g, "").replace(/[.,]/g, " ");

  // Tokenize and filter out honorific titles
  const tokens = clean.split(/\s+/).filter(Boolean);
  const filteredTokens = tokens.filter((t) => !COMMON_TITLES.has(t));

  return (filteredTokens.length > 0 ? filteredTokens.join(" ") : clean).trim();
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Computes a normalized similarity score between 0.0 and 1.0.
 * Combines Levenshtein ratio with token-level set intersection.
 */
export function calculateSimilarity(raw1: string, raw2: string): number {
  const s1 = normalizeEntityName(raw1);
  const s2 = normalizeEntityName(raw2);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Check substring / prefix containment
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    if (minLen >= 3 && minLen / maxLen >= 0.4) {
      return 0.92;
    }
  }

  // Token overlap check (e.g. "Vikram Malhotra" vs "Vikram")
  const tokens1 = s1.split(/\s+/);
  const tokens2 = s2.split(/\s+/);
  const common = tokens1.filter((t) => tokens2.includes(t));
  if (common.length > 0 && (tokens1.length === 1 || tokens2.length === 1)) {
    return 0.90;
  }

  // Levenshtein similarity calculation
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const editSimilarity = 1 - distance / maxLen;

  // Typo tolerance: For names >= 5 chars, edit distance <= 2 is very high similarity
  if (distance <= 2 && maxLen >= 5) {
    return Math.max(editSimilarity, 0.85);
  }

  return editSimilarity;
}

/**
 * Matches an extracted entity against existing case entities.
 * Supports:
 * - Exact normalized name matching
 * - Alias matching (case-insensitive & fuzzy)
 * - Typo tolerance (Levenshtein distance <= 2, e.g. "Vikram Malhothra" -> "Vikram Malhotra")
 * - Single-name/token matching (e.g. "Vikram" -> "Vikram Malhotra")
 */
export function matchEntity<T extends { name: string; aliases?: string[]; type?: string; [key: string]: any }>(
  extracted: { name: string; aliases?: string[]; type?: string },
  existingEntities: T[]
): MatchResult<T> {
  const normTarget = normalizeEntityName(extracted.name);
  if (!normTarget) {
    return { match: null, similarity: 0, matchType: "none" };
  }

  let bestMatch: T | null = null;
  let bestScore = 0;
  let bestMatchType: "exact" | "alias" | "token" | "fuzzy" | "none" = "none";
  let matchedName = "";

  for (const existing of existingEntities) {
    const normExisting = normalizeEntityName(existing.name);

    // 1. Exact match
    if (normExisting === normTarget) {
      return { match: existing, similarity: 1.0, matchType: "exact", matchedName: existing.name };
    }

    // 2. Alias match
    const existingAliases = (existing.aliases || []).map(normalizeEntityName);
    const extractedAliases = (extracted.aliases || []).map(normalizeEntityName);

    if (existingAliases.includes(normTarget)) {
      return { match: existing, similarity: 1.0, matchType: "alias", matchedName: normTarget };
    }

    for (const ea of extractedAliases) {
      if (normExisting === ea || existingAliases.includes(ea)) {
        return { match: existing, similarity: 1.0, matchType: "alias", matchedName: ea };
      }
    }

    // 3. Name similarity check
    const sim = calculateSimilarity(normTarget, normExisting);
    if (sim > bestScore) {
      bestScore = sim;
      bestMatch = existing;
      bestMatchType = sim >= 0.90 ? "token" : "fuzzy";
      matchedName = existing.name;
    }

    // Check aliases with fuzzy comparison
    for (const a of existingAliases) {
      const aliasSim = calculateSimilarity(normTarget, a);
      if (aliasSim > bestScore) {
        bestScore = aliasSim;
        bestMatch = existing;
        bestMatchType = "alias";
        matchedName = a;
      }
    }
  }

  // Threshold: similarity >= 0.82 is considered a confident match
  if (bestScore >= 0.82 && bestMatch) {
    return {
      match: bestMatch,
      similarity: bestScore,
      matchType: bestMatchType,
      matchedName,
    };
  }

  return { match: null, similarity: bestScore, matchType: "none" };
}

/**
 * Evidentiary Discrepancy & Contradiction Detector:
 * Identifies when new facts conflict with prior case facts (e.g. "School ABCD" vs "School PQRT",
 * or conflicting alibi statements like "at Juhu Beach" vs "at Marine Lines").
 */
export function detectContradictions(
  extractedEntities: Array<{ name: string; type?: string; alibiStatus?: string; alibiDetails?: string }>,
  existingEntities: Array<{ name: string; type?: string; alibiStatus?: string; alibiDetails?: string; aliases?: string[] }>,
  noteText: string
): DiscrepancyReport[] {
  const discrepancies: DiscrepancyReport[] = [];
  const lowerNote = noteText.toLowerCase();

  // Pattern A: Conflicting place or institution names (e.g. School ABCD vs PQRT)
  const placeKeywords = ["school", "college", "hospital", "hotel", "bank", "vault", "office", "company", "store", "warehouse"];
  
  for (const kw of placeKeywords) {
    if (lowerNote.includes(kw)) {
      // Find existing places or organizations matching this keyword
      const existingPlaces = existingEntities.filter(
        (e) => (e.type === "place" || e.type === "object" || (e.name || "").toLowerCase().includes(kw))
      );

      for (const ep of existingPlaces) {
        const epNameLower = ep.name.toLowerCase();
        // Check if extracted entities have a DIFFERENT place matching the same keyword
        for (const ne of extractedEntities) {
          const neNameLower = ne.name.toLowerCase();
          if (
            neNameLower !== epNameLower &&
            (ne.type === "place" || neNameLower.includes(kw)) &&
            calculateSimilarity(ne.name, ep.name) < 0.60 // Clearly different name
          ) {
            discrepancies.push({
              entityType: ep.type || "place",
              field: `${kw} name`,
              existingValue: ep.name,
              newValue: ne.name,
              entityName: ep.name,
              description: `Conflicting ${kw} identified: Prior case record logged "${ep.name}", but new note introduces "${ne.name}".`,
              resolutionOptions: [
                `Update & replace "${ep.name}" with "${ne.name}"`,
                `Record "${ne.name}" as an alternative alias of "${ep.name}"`,
                `Keep both as separate distinct locations`
              ],
            });
          }
        }
      }
    }
  }

  // Pattern B: Alibi status contradictions (e.g., claimed vs broken or verified vs broken)
  for (const extracted of extractedEntities) {
    if (extracted.alibiStatus && extracted.alibiStatus !== "unknown") {
      const matchRes = matchEntity(extracted, existingEntities);
      if (matchRes.match) {
        const prevStatus = matchRes.match.alibiStatus;
        const newStatus = extracted.alibiStatus;

        // Contradiction if previously verified but now reported broken, or previously broken now claimed verified
        if (
          (prevStatus === "verified" && newStatus === "broken") ||
          (prevStatus === "broken" && newStatus === "verified") ||
          (prevStatus === "claimed" && newStatus === "broken")
        ) {
          discrepancies.push({
            entityType: "person",
            field: "alibiStatus",
            existingValue: prevStatus,
            newValue: newStatus,
            entityName: matchRes.match.name,
            description: `Alibi status discrepancy for ${matchRes.match.name}: Previously recorded as "${prevStatus}", but current note reports "${newStatus}" (${extracted.alibiDetails || "evidence discrepancy"}).`,
            resolutionOptions: [
              `Update ${matchRes.match.name}'s alibi to "${newStatus}"`,
              `Keep previous "${prevStatus}" and mark as unverified lead`
            ],
          });
        }
      }
    }
  }

  return discrepancies;
}
