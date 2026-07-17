export type PlaceholderField =
  | "idea"
  | "targetAudience"
  | "interests"
  | "skills"
  | "profile"
  | "generic";

export type PlaceholderDetection = {
  isPlaceholder: boolean;
  reason: string | null;
  normalizedValue: string;
  confidence: number;
};

const EXACT_PLACEHOLDERS = new Set([
  "no idea",
  "no clue",
  "idk",
  "i dunno",
  "i dont know",
  "i don't know",
  "dont know",
  "don't know",
  "not sure",
  "none",
  "nothing",
  "n a",
  "na",
  "n/a",
  "whatever",
  "anything",
  "something",
  "random",
  "surprise me",
  "you choose",
  "pick for me",
  "choose for me",
  "no preference",
  "unsure",
  "maybe",
  "skip",
  "tbd",
  "test",
  "testing",
  "placeholder",
  "asdf",
  "qwerty",
  "make money",
  "money",
  "app",
  "website",
]);

const FILLER_WORDS = new Set(["idk", "whatever", "anything", "something", "random", "none", "test", "testing", "asdf", "qwerty", "maybe", "skip"]);

export function detectPlaceholderAnswer(value: unknown, field: PlaceholderField = "generic"): PlaceholderDetection {
  const rawValue = String(value ?? "").trim();
  if (rawValue && /^[?.!,_\-\s]+$/.test(rawValue)) return result(true, "punctuation_only", "", 0.98);
  const normalizedValue = normalizeAnswer(value);
  if (!normalizedValue) return result(true, "empty", normalizedValue, 1);

  if (EXACT_PLACEHOLDERS.has(normalizedValue)) return result(true, "known_placeholder_phrase", normalizedValue, 0.98);
  if (/^\d+$/.test(normalizedValue) && expectsText(field)) return result(true, "numbers_only_for_text_field", normalizedValue, 0.9);
  if (/^(.)\1{3,}$/u.test(normalizedValue.replace(/\s/g, ""))) return result(true, "repeated_characters", normalizedValue, 0.94);
  if (/(what are you interested in|what skills do you have|who do you want to sell to|any idea you already have|preferred business type)/i.test(normalizedValue)) {
    return result(true, "copied_question_text", normalizedValue, 0.93);
  }

  const tokens = normalizedValue.split(" ").filter(Boolean);
  if (tokens.length <= 2 && tokens.every((token) => FILLER_WORDS.has(token))) return result(true, "repeated_filler", normalizedValue, 0.92);
  if (tokens.length >= 3 && new Set(tokens).size === 1 && FILLER_WORDS.has(tokens[0])) return result(true, "repeated_filler", normalizedValue, 0.95);
  if (tokens.length >= 4 && new Set(tokens).size === 1) return result(true, "same_word_repeated", normalizedValue, 0.9);
  if (normalizedValue.length <= 2 && expectsText(field)) return result(true, "too_short_to_be_meaningful", normalizedValue, 0.72);
  if (field === "targetAudience" && /^(everyone|anyone|all people|people|users|customers)$/i.test(normalizedValue)) return result(true, "audience_too_broad", normalizedValue, 0.88);

  return result(false, null, normalizedValue, 0);
}

export function isPlaceholderAnswer(value: unknown, field: PlaceholderField = "generic") {
  return detectPlaceholderAnswer(value, field).isPlaceholder;
}

export function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\p{L}\p{N}'/+$#.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expectsText(field: PlaceholderField) {
  return field !== "generic";
}

function result(isPlaceholder: boolean, reason: string | null, normalizedValue: string, confidence: number): PlaceholderDetection {
  return { isPlaceholder, reason, normalizedValue, confidence };
}
