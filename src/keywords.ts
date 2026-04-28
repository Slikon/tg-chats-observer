export const BUILTIN_TRIGGER_KEYWORDS = [
  "курсовая",
  "реферат",
  "статья",
  "лабы",
  "лабораторная",
  "диплом",
  "помогите написать",
  "написать работу",
  "допоможіть написати",
  "курсова",
  "реферат на тему",
];

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function parseOverrideKeywords(rawJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(
      `TRIGGER_KEYWORDS_JSON must be valid JSON array of strings: ${String(error)}`
    );
  }

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("TRIGGER_KEYWORDS_JSON must be JSON array of strings");
  }

  return parsed.map((item) => normalizeKeyword(item)).filter(Boolean);
}

export function resolveTriggerKeywords(overrideJson?: string): string[] {
  const base = BUILTIN_TRIGGER_KEYWORDS.map(normalizeKeyword).filter(Boolean);
  if (!overrideJson) {
    return Array.from(new Set(base));
  }

  const override = parseOverrideKeywords(overrideJson);
  const merged = Array.from(new Set([...base, ...override]));
  if (merged.length === 0) {
    throw new Error("No trigger keywords configured");
  }
  return merged;
}

export function findMatchedKeywords(
  normalizedText: string,
  keywords: string[]
): string[] {
  return keywords.filter((keyword) => normalizedText.includes(keyword));
}

