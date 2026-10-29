// Deterministic pipeline steps shared by the server route and the browser fallback.
export type ConditionKey = "heart_failure" | "type_2_diabetes" | "ckd";

export interface Card {
  id: string;
  requires: readonly string[];
  medication_trigger?: readonly string[];
  topic: string;
  guideline_says: string;
  question_for_clinician: string;
  source: string;
  label: string;
}

export interface Source {
  title: string;
  authors: string;
  journal: string;
  doi: string;
}

export interface Pack {
  cards: readonly Card[];
  sources: Record<string, Source>;
}

export interface BriefInput {
  conditions: ConditionKey[];
  hfType?: string | undefined;
  medicines: string[];
  numbers: Record<string, string>;
  worry: string;
}

export interface BriefPoint {
  card_id: string;
  point: string;
  question: string;
  rationale: string;
  standardized?: boolean;
  supporting_card_ids?: string[];
}

export interface BriefResult {
  points: BriefPoint[];
  mode: "nemotron" | "fallback";
  model?: string;
  latency_ms?: number;
  error?: string;
}

// Brand names that contain a medicine a card triggers on. Generic names are matched as written.
const BRAND_TO_GENERIC: Record<string, string> = {
  glucophage: "metformin",
  glumetza: "metformin",
  fortamet: "metformin",
  riomet: "metformin",
  janumet: "metformin",
  jentadueto: "metformin",
  synjardy: "metformin",
  xigduo: "metformin",
  invokamet: "metformin",
  kazano: "metformin",
  actoplus: "metformin",
  prandimet: "metformin",
};
const NEGATED_MEDICINE = /^\s*(no|not|never|stopped|stop|off|discontinued|ex-)\b/i;
const normalizeMedicine = (m: string) => {
  const lower = m.toLowerCase();
  const brand = Object.keys(BRAND_TO_GENERIC).find((b) => lower.includes(b));
  return brand ? `${lower} ${BRAND_TO_GENERIC[brand]}` : lower;
};

/** Heart failure cards that only fit some ejection fraction types, from each card's own text:
 *  E9 is written for reduced EF, E3 for mildly reduced or preserved EF, E10 for EF above 40%. */
const HF_TYPE_EXCLUDES: Record<string, string[]> = {
  reduced: ["E3", "E10"],
  mildly: ["E9"],
  preserved: ["E9"],
};
const hfTypeKey = (hfType?: string) => (hfType ?? "").toLowerCase().split(" ")[0] ?? "";

/** Step A: a card is eligible if all required conditions are selected, any medication trigger matches,
 *  and (when the heart failure type is known) the card fits that type. */
export function filterEligible(
  cards: readonly Card[],
  conditions: string[],
  medicines: string[],
  hfType?: string,
): Card[] {
  const meds = medicines.filter((m) => !NEGATED_MEDICINE.test(m)).map(normalizeMedicine);
  const excluded = new Set(HF_TYPE_EXCLUDES[hfTypeKey(hfType)] ?? []);
  return cards.filter((c) => {
    if (excluded.has(c.id)) return false;
    if (!c.requires.every((r) => conditions.includes(r))) return false;
    if (!c.medication_trigger || c.medication_trigger.length === 0) return true;
    return c.medication_trigger.some((t) => meds.some((m) => m.includes(t.toLowerCase())));
  });
}

/** Order by heart failure type: reduced EF puts E9 before E3; mildly reduced or preserved puts E3 before E9. */
export function orderByHfType(eligible: Card[], hfType?: string): Card[] {
  const t = (hfType ?? "").toLowerCase();
  const first = t.startsWith("reduced")
    ? "E9"
    : t.startsWith("mildly") || t.startsWith("preserved")
      ? "E3"
      : null;
  if (!first) return eligible;
  const other = first === "E9" ? "E3" : "E9";
  const a = eligible.findIndex((c) => c.id === first);
  const b = eligible.findIndex((c) => c.id === other);
  if (a < 0 || b < 0 || a < b) return eligible;
  const out = [...eligible];
  const preferred = out[a];
  const secondary = out[b];
  if (!preferred || !secondary) return eligible;
  [out[a], out[b]] = [secondary, preferred];
  return out;
}

export const MEDICINE_TERMS = [
  "metformin",
  "sglt2",
  "empagliflozin",
  "dapagliflozin",
  "canagliflozin",
  "finerenone",
  "glp-1",
  "semaglutide",
  "liraglutide",
  "dulaglutide",
  "tirzepatide",
  "pioglitazone",
  "insulin",
  "ace inhibitor",
  "arb",
  "lisinopril",
  "losartan",
  "sacubitril",
  "entresto",
  "spironolactone",
  "eplerenone",
  "beta blocker",
  "furosemide",
  "diuretic",
  "jardiance",
  "farxiga",
  "invokana",
  "kerendia",
  "ozempic",
  "wegovy",
  "rybelsus",
  "trulicity",
  "mounjaro",
  "victoza",
  "lasix",
  "zestril",
  "cozaar",
  "glucophage",
  "actos",
] as const;
const SGLT2_IDS = new Set(["E2", "E3", "E9", "E11"]);
const NSMRA_IDS = new Set(["E6", "E10"]);
const CLASS_GROUPS = [SGLT2_IDS, NSMRA_IDS];
const classOf = (id: string) => CLASS_GROUPS.find((g) => g.has(id));
const SAFETY_CLAIM = /\b(safe|safely|safer|safest|harmless|risk[-\s]free|no\s+risk|guaranteed?)\b/i;
const DOSING = /\b(dose|doses|dosing)\b/i;
const RELATIONSHIPS =
  /\b(mom|mother|dad|father|wife|husband|son|daughter|partner|spouse|mr|mrs|ms|her|hers|his|him|she|he|we|i|my|me|mine|our|us|your|yours|loved\s+one)\b/i;
// Reassurance or urgency judgments no card makes; always rejected.
const DOWNPLAY =
  /\b(not\s+urgent|no\s+need|nothing\s+to\s+worry|do\s+not\s+worry|don'?t\s+worry|safe\s+to\s+ignore|can\s+wait|emergency|dangerous(?:ly)?)\b/i;
// Benefit words are one family: a point may state a benefit only if its card states one.
// Certainty words must appear in the card itself. Phrases that only look like claims are ignored.
const BENEFIT_ROOTS = [
  "protect",
  "prevent",
  "benefit",
  "improv",
  "reduc",
  "lower",
  "slow",
  "help",
  "better",
];
// Directive and cure words are in this family too: a point may use one only if its card does.
const CERTAINTY_ROOTS = [
  "proven",
  "require",
  "must",
  "mandatory",
  "essential",
  "always",
  "never",
  "start",
  "stop",
  "discontinu",
  "switch",
  "doubl",
  "halv",
  "cut",
  "increas",
  "rais",
  "cure",
  "should",
  "too high",
  "too low",
  "above",
  "below",
  "exceed",
  "elevated",
  "abnormal",
  "out of range",
];
const NOT_CLAIMS = /\b(mildly\s+reduced|reduced\s+ejection|reduced\s+ef|lower\s+dose|slowly)\b/gi;
const rootsIn = (roots: string[], text: string) => {
  const t = text.replace(NOT_CLAIMS, " ");
  return roots.filter((root) => new RegExp(`\\b${root}`, "i").test(t));
};
const CARD_ID = /\bE\d{1,2}\b/g;
const normalize = (text: string) => text.toLowerCase().replace(/[\u2010-\u2015]/g, "-");
const numericTokens = (text: string) =>
  text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g)?.map((v) => v.replace(/,/g, "")) ?? [];
const containsTerm = (text: string, term: string) =>
  new RegExp(`\\b${term.replace(/ /g, "\\s+")}s?\\b`, "i").test(normalize(text));

export function standardPoint(card: Card): string {
  const firstSentence = card.guideline_says.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? card.guideline_says;
  return `${card.topic}: ${firstSentence}`;
}

// Allowlist: a generated sentence may only use words that appear in its own card (stem match on the first 5
// letters) plus plain function words. This is what stops new advice, new claims, other languages, and look-alike
// characters; the blocklists below only add extra context. A sentence that fails is replaced by the card's wording.
const FUNCTION_WORDS = new Set(
  "a an the and or of to in on for with by as at is are be can may it its this that these those who whom which when where than then also not no into from about between per each one up their they them there here do does has have had was were been being if so such only more most other any both either".split(
    " ",
  ),
);
const MAX_POINT_CHARS = 400;
// Points are statements. A sentence that opens as a command, or that states something about the person's own
// result, is rejected even when every word comes from the card.
const IMPERATIVE_START =
  /^\W*(start|begin|take|use|add|stop|hold|skip|quit|cease|taper|switch|swap|raise|increase|double|halve|cut|get|ask|try|avoid|continue|discontinue|reduce|lower|change|talk|tell|call|go)\b/i;
const PERSON_RESULT =
  /\b(the|this|that|their)\s+(person'?s?\s+)?(egfr|a1c|uacr|potassium|blood pressure|reading|result|level|ejection fraction|urine albumin|kidney function|numbers?)\s+(is|are|was|were|looks?|means?|shows?|seems?|should|needs?)\b/i;
const stem = (w: string) => w.slice(0, 5);
const wordsOf = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .toLowerCase()
    .match(/\p{L}+/gu) ?? [];
function outsideVocabulary(text: string, card: Card): boolean {
  if (text.length > MAX_POINT_CHARS) return true;
  if (IMPERATIVE_START.test(text.trim()) || PERSON_RESULT.test(text)) return true;
  const cleaned = text.normalize("NFKC").replace(/\p{Cf}/gu, "");
  if (/[^\t\n\r\u0020-\u007e\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00a0]/u.test(cleaned))
    return true;
  const allowed = new Set(
    wordsOf(`${card.guideline_says} ${card.topic} ${card.question_for_clinician}`).map(stem),
  );
  return wordsOf(cleaned).some(
    (w) => w.length > 2 && !FUNCTION_WORDS.has(w) && !allowed.has(stem(w)),
  );
}

/** True when text uses a word, number, medicine, dose, safety, benefit, or certainty claim its card does not support. */
export function violatesCard(text: string, card: Card, input?: BriefInput): boolean {
  // Numbers must come from the card. A generated sentence may not restate or judge the caregiver's own
  // results; the interface shows a deterministic note for those instead.
  const allowedNumbers = new Set(numericTokens(card.guideline_says));
  // Digits that are part of a medicine name (GLP-1, SGLT2) are fine when that medicine is allowed.
  for (const term of MEDICINE_TERMS)
    if (
      /\d/.test(term) &&
      containsTerm(`${card.guideline_says} ${(input?.medicines ?? []).join(" ")}`, term)
    )
      for (const n of numericTokens(term)) allowedNumbers.add(n);
  const allowedMedicines = `${card.guideline_says} ${(input?.medicines ?? []).join(" ")}`;
  const cardStatesBenefit = rootsIn(BENEFIT_ROOTS, card.guideline_says).length > 0;
  const cardCertainty = new Set(rootsIn(CERTAINTY_ROOTS, card.guideline_says));
  return (
    !text.trim() ||
    outsideVocabulary(text, card) ||
    RELATIONSHIPS.test(text) ||
    DOWNPLAY.test(text) ||
    (DOSING.test(text) && !card.guideline_says.toLowerCase().includes("dose")) ||
    (SAFETY_CLAIM.test(text) && !SAFETY_CLAIM.test(card.guideline_says)) ||
    (!cardStatesBenefit && rootsIn(BENEFIT_ROOTS, text).length > 0) ||
    rootsIn(CERTAINTY_ROOTS, text).some((root) => !cardCertainty.has(root)) ||
    numericTokens(text).some((n) => !allowedNumbers.has(n)) ||
    MEDICINE_TERMS.some((term) => containsTerm(text, term) && !containsTerm(allowedMedicines, term))
  );
}

/** Lexical guard only: it checks wording against the card, not whether the meaning is correct. */
export function checkPoint(
  point: string,
  card: Card,
  input?: BriefInput,
): { point: string; standardized: boolean } {
  return violatesCard(point, card, input)
    ? { point: standardPoint(card), standardized: true }
    : { point, standardized: false };
}

/** Rationale gets the same checks after card IDs are named generically; a failing rationale is dropped, not shown. */
export function checkRationale(rationale: string, card: Card, input?: BriefInput): string {
  const text = rationale
    .replace(/^E\d{1,2}\b/, "This card")
    .replace(CARD_ID, "this card")
    .trim();
  return text && !violatesCard(text, card, input) ? text : "";
}

/** Keep one card per medicine class (SGLT2, nonsteroidal MRA), use remaining model ranks, then fill from pack order. */
function diversePoints(ranked: BriefPoint[], eligible: Card[]): BriefPoint[] {
  const result: BriefPoint[] = [];
  const seen = new Set<string>();
  const keptClasses = new Set<Set<string>>();
  const backfill = eligible.map((c): BriefPoint => ({
    card_id: c.id,
    point: standardPoint(c),
    question: c.question_for_clinician,
    rationale: "Selected by rule to fill the next eligible discussion topic.",
    standardized: true,
  }));
  for (const point of [...ranked, ...backfill]) {
    if (seen.has(point.card_id)) continue;
    seen.add(point.card_id);
    const group = classOf(point.card_id);
    if (group && keptClasses.has(group)) continue;
    if (group) keptClasses.add(group);
    result.push({
      ...point,
      supporting_card_ids: group
        ? eligible.filter((c) => group.has(c.id) && c.id !== point.card_id).map((c) => c.id)
        : [],
    });
    if (result.length === 3) break;
  }
  return result;
}

/** Rule-based selection with diversity and verbatim evidence questions. */
export function fallbackPoints(eligible: Card[], hfType?: string): BriefPoint[] {
  return diversePoints(
    orderByHfType(eligible, hfType).map((c) => ({
      card_id: c.id,
      point: standardPoint(c),
      question: c.question_for_clinician,
      rationale:
        "Selected by rule: eligible for the selected conditions and medicines, in evidence pack order.",
      standardized: false,
    })),
    eligible,
  );
}

export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*<\/think>/i, "")
    .trim();
}

/** Step C: parse model output, keep only eligible card ids, dedupe, cap at 3. Returns null if unusable. */
export function validateModelOutput(
  raw: string,
  eligible: Card[],
  input?: BriefInput,
): BriefPoint[] | null {
  const text = stripThink(raw)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (/<think>/i.test(text) || text.startsWith("[")) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const pts = (parsed as { points?: unknown }).points;
  if (!Array.isArray(pts)) return null;
  const ids = new Map(eligible.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: BriefPoint[] = [];
  for (const p of pts) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    if (typeof (p as BriefPoint).card_id !== "string") continue;
    const id = (p as BriefPoint).card_id.trim();
    const card = ids.get(id);
    if (!card || seen.has(id)) continue;
    seen.add(id);
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    out.push({
      card_id: id,
      ...checkPoint(s((p as BriefPoint).point), card, input),
      question: card.question_for_clinician,
      rationale: checkRationale(s((p as BriefPoint).rationale), card, input),
    });
  }
  return out.length ? diversePoints(out, eligible) : null;
}

/** Lowest eGFR a card names ("eGFR is at least 30"), read from the card text, or null. */
export function egfrFloor(card: Card): number | null {
  const m = card.guideline_says.match(/eGFR\s+(?:is\s+|of\s+)?at\s+least\s+(\d+(?:\.\d+)?)/i);
  return m?.[1] ? Number(m[1]) : null;
}

/** Note shown under a card that names an eGFR level. It states what the card says and asks the care team; it does not compare the caregiver's result with that level. */
export function floorNote(card: Card): string | null {
  const floor = egfrFloor(card);
  if (floor === null) return null;
  return `This guideline names an eGFR level (${floor}). Bring the latest eGFR result and ask the care team how it applies.`;
}

/** Note for a card that mentions potassium: no value is judged. */
export function potassiumNote(card: Card): string | null {
  return /potassium/i.test(card.guideline_says)
    ? "This guideline mentions potassium. Bring the latest potassium result and ask the care team how it applies."
    : null;
}

export const HF_TYPE_OPTIONS = [
  "Reduced EF",
  "Mildly reduced EF",
  "Preserved EF",
  "Not sure",
] as const;

/** Only the four UI values may reach the prompt; anything else is dropped. */
export function sanitizeHfType(value: unknown): string | undefined {
  return typeof value === "string" && (HF_TYPE_OPTIONS as readonly string[]).includes(value)
    ? value
    : undefined;
}
