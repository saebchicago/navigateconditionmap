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

/** Step A: a card is eligible if all required conditions are selected and any medication trigger matches. */
export function filterEligible(cards: readonly Card[], conditions: string[], medicines: string[]): Card[] {
  const meds = medicines.map((m) => m.toLowerCase());
  return cards.filter((c) => {
    if (!c.requires.every((r) => conditions.includes(r))) return false;
    if (!c.medication_trigger || c.medication_trigger.length === 0) return true;
    return c.medication_trigger.some((t) => meds.some((m) => m.includes(t.toLowerCase())));
  });
}

/** Order by heart failure type: reduced EF puts E9 before E3; mildly reduced or preserved puts E3 before E9. */
export function orderByHfType(eligible: Card[], hfType?: string): Card[] {
  const t = (hfType ?? "").toLowerCase();
  const first = t.startsWith("reduced") ? "E9" : t.startsWith("mildly") || t.startsWith("preserved") ? "E3" : null;
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

export const MEDICINE_TERMS = ["metformin", "sglt2", "empagliflozin", "dapagliflozin", "canagliflozin", "finerenone", "glp-1", "semaglutide", "liraglutide", "dulaglutide", "tirzepatide", "pioglitazone", "insulin", "ace inhibitor", "arb", "lisinopril", "losartan", "sacubitril", "entresto", "spironolactone", "eplerenone", "beta blocker", "furosemide", "diuretic", "jardiance", "farxiga", "invokana", "kerendia", "ozempic", "wegovy", "rybelsus", "trulicity", "mounjaro", "victoza", "lasix", "zestril", "cozaar", "glucophage", "actos"] as const;
const SGLT2_IDS = new Set(["E2", "E3", "E9", "E11"]);
const NSMRA_IDS = new Set(["E6", "E10"]);
const CLASS_GROUPS = [SGLT2_IDS, NSMRA_IDS];
const classOf = (id: string) => CLASS_GROUPS.find((g) => g.has(id));
const SAFETY_CLAIM = /\b(safe|safely|safer|safest|harmless|risk[-\s]free|no\s+risk|guaranteed?)\b/i;
const DOSING = /\b(dose|doses|dosing)\b/i;
const RELATIONSHIPS = /\b(mom|mother|dad|father|wife|husband|son|daughter|partner|spouse|mr|mrs|ms|her|hers|his|him|she|he|we|i|my|me|mine|our|us|your|yours|loved\s+one)\b/i;
// Reassurance or urgency judgments no card makes; always rejected.
const DOWNPLAY = /\b(not\s+urgent|no\s+need|nothing\s+to\s+worry|do\s+not\s+worry|don'?t\s+worry|safe\s+to\s+ignore|can\s+wait|emergency|dangerous(?:ly)?)\b/i;
// Benefit words are one family: a point may state a benefit only if its card states one.
// Certainty words must appear in the card itself. Phrases that only look like claims are ignored.
const BENEFIT_ROOTS = ["protect", "prevent", "benefit", "improv", "reduc", "lower", "slow", "help", "better"];
// Directive and cure words are in this family too: a point may use one only if its card does.
const CERTAINTY_ROOTS = ["proven", "require", "must", "mandatory", "essential", "always", "never", "start", "stop", "discontinu", "switch", "doubl", "halv", "cut", "increas", "rais", "cure", "should", "too high", "too low", "above", "below", "exceed", "elevated", "abnormal", "out of range"];
const NOT_CLAIMS = /\b(mildly\s+reduced|reduced\s+ejection|reduced\s+ef|lower\s+dose|slowly)\b/gi;
const rootsIn = (roots: string[], text: string) => {
  const t = text.replace(NOT_CLAIMS, " ");
  return roots.filter((root) => new RegExp(`\\b${root}`, "i").test(t));
};
const CARD_ID = /\bE\d{1,2}\b/g;
const normalize = (text: string) => text.toLowerCase().replace(/[\u2010-\u2015]/g, "-");
const numericTokens = (text: string) => text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g)?.map((v) => v.replace(/,/g, "")) ?? [];
const containsTerm = (text: string, term: string) => new RegExp(`\\b${term.replace(/ /g, "\\s+")}s?\\b`, "i").test(normalize(text));

export function standardPoint(card: Card): string {
  const firstSentence = card.guideline_says.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? card.guideline_says;
  return `${card.topic}: ${firstSentence}`;
}

/** True when text uses a word, number, medicine, dose, safety, benefit, or certainty claim its card does not support. */
export function violatesCard(text: string, card: Card, input?: BriefInput): boolean {
  // Numbers must come from the card. A generated sentence may not restate or judge the caregiver's own
  // results; the interface shows a deterministic note for those instead.
  const allowedNumbers = new Set(numericTokens(card.guideline_says));
  // Digits that are part of a medicine name (GLP-1, SGLT2) are fine when that medicine is allowed.
  for (const term of MEDICINE_TERMS) if (/\d/.test(term) && containsTerm(`${card.guideline_says} ${(input?.medicines ?? []).join(" ")}`, term)) for (const n of numericTokens(term)) allowedNumbers.add(n);
  const allowedMedicines = `${card.guideline_says} ${(input?.medicines ?? []).join(" ")}`;
  const cardStatesBenefit = rootsIn(BENEFIT_ROOTS, card.guideline_says).length > 0;
  const cardCertainty = new Set(rootsIn(CERTAINTY_ROOTS, card.guideline_says));
  return !text.trim() || RELATIONSHIPS.test(text) || DOWNPLAY.test(text)
    || (DOSING.test(text) && !card.guideline_says.toLowerCase().includes("dose"))
    || (SAFETY_CLAIM.test(text) && !SAFETY_CLAIM.test(card.guideline_says))
    || (!cardStatesBenefit && rootsIn(BENEFIT_ROOTS, text).length > 0)
    || rootsIn(CERTAINTY_ROOTS, text).some((root) => !cardCertainty.has(root))
    || numericTokens(text).some((n) => !allowedNumbers.has(n))
    || MEDICINE_TERMS.some((term) => containsTerm(text, term) && !containsTerm(allowedMedicines, term));
}

/** Lexical guard only: it checks wording against the card, not whether the meaning is correct. */
export function checkPoint(point: string, card: Card, input?: BriefInput): { point: string; standardized: boolean } {
  return violatesCard(point, card, input) ? { point: standardPoint(card), standardized: true } : { point, standardized: false };
}

/** Rationale gets the same checks after card IDs are named generically; a failing rationale is dropped, not shown. */
export function checkRationale(rationale: string, card: Card, input?: BriefInput): string {
  const text = rationale.replace(/^E\d{1,2}\b/, "This card").replace(CARD_ID, "this card").trim();
  return text && !violatesCard(text, card, input) ? text : "";
}

/** Keep one card per medicine class (SGLT2, nonsteroidal MRA), use remaining model ranks, then fill from pack order. */
function diversePoints(ranked: BriefPoint[], eligible: Card[]): BriefPoint[] {
  const result: BriefPoint[] = [];
  const seen = new Set<string>();
  const keptClasses = new Set<Set<string>>();
  const backfill = eligible.map((c): BriefPoint => ({ card_id: c.id, point: standardPoint(c), question: c.question_for_clinician, rationale: "Selected by rule to fill the next eligible discussion topic.", standardized: true }));
  for (const point of [...ranked, ...backfill]) {
    if (seen.has(point.card_id)) continue;
    seen.add(point.card_id);
    const group = classOf(point.card_id);
    if (group && keptClasses.has(group)) continue;
    if (group) keptClasses.add(group);
    result.push({ ...point, supporting_card_ids: group ? eligible.filter((c) => group.has(c.id) && c.id !== point.card_id).map((c) => c.id) : [] });
    if (result.length === 3) break;
  }
  return result;
}

/** Rule-based selection with diversity and verbatim evidence questions. */
export function fallbackPoints(eligible: Card[], hfType?: string): BriefPoint[] {
  return diversePoints(orderByHfType(eligible, hfType).map((c) => ({
    card_id: c.id,
    point: standardPoint(c),
    question: c.question_for_clinician,
    rationale: "Selected by rule: eligible for the selected conditions and medicines, in evidence pack order.",
    standardized: false,
  })), eligible);
}

export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
}

/** Step C: parse model output, keep only eligible card ids, dedupe, cap at 3. Returns null if unusable. */
export function validateModelOutput(raw: string, eligible: Card[], input?: BriefInput): BriefPoint[] | null {
  const text = stripThink(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
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

/** Note shown under a card when the caregiver's eGFR is below the level the card names. */
export function egfrNote(card: Card, egfrInput: string | undefined): string | null {
  const floor = egfrFloor(card);
  const value = egfrInput && /^\s*\d+(?:\.\d+)?\s*$/.test(egfrInput) ? Number(egfrInput) : NaN;
  if (floor === null || Number.isNaN(value) || value >= floor) return null;
  return `The eGFR you entered (${value}) is below the level this guideline names (${floor}). Ask the care team whether it applies.`;
}

export const HF_TYPE_OPTIONS = ["Reduced EF", "Mildly reduced EF", "Preserved EF", "Not sure"] as const;

/** Only the four UI values may reach the prompt; anything else is dropped. */
export function sanitizeHfType(value: unknown): string | undefined {
  return typeof value === "string" && (HF_TYPE_OPTIONS as readonly string[]).includes(value) ? value : undefined;
}
