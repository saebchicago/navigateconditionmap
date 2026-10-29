// Scores saved eval responses. Independent rule checks, plus a replay of the current
// checkPoint/checkRationale on the model's own wording to show what the repo version would do.
// Usage: bun scripts/eval/score.ts scripts/eval/baseline.json
import { readFileSync } from "node:fs";
import pack from "../../src/data/evidence-pack.json";
import { checkPoint, checkRationale, filterEligible, type BriefInput, type BriefPoint, type Card } from "../../src/lib/navigator";

const cards = pack.cards as Card[];
const byId = new Map(cards.map((c) => [c.id, c]));
const file = process.argv[2] ?? "scripts/eval/baseline.json";
const { results, ran_at, base } = JSON.parse(readFileSync(file, "utf8")) as {
  ran_at: string;
  base: string;
  results: { name: string; input: BriefInput; status: number; wall_ms: number; response: { points?: BriefPoint[]; mode?: string; latency_ms?: number; error?: string } }[];
};

const SGLT2 = ["E2", "E3", "E9", "E11"];
const MRA = ["E6", "E10"];
const MG = /\d+\s*mg\b/i;
const REL = /\b(mom|mother|dad|father|wife|husband|her|his|him|she|he|we|i|my|me|mine|our|us|your|yours|loved\s+one)\b/i;
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};

let violations = 0;
let points = 0;
let modelWording = 0;
let wouldStandardize = 0;
let rationales = 0;
let rationaleDropped = 0;
const lat: number[] = [];
const modes: Record<string, number> = {};
const notes: string[] = [];

for (const r of results) {
  const res = r.response;
  const mode = r.status === 200 ? res.mode ?? "none" : `http_${r.status}`;
  modes[mode] = (modes[mode] ?? 0) + 1;
  if (res.latency_ms != null && mode === "nemotron") lat.push(res.latency_ms);
  const pts = res.points ?? [];
  const eligible = new Set(filterEligible(cards, r.input.conditions, r.input.medicines).map((c) => c.id));
  const ids = pts.map((p) => p.card_id);
  const fail = (why: string) => {
    violations++;
    notes.push(`VIOLATION ${r.name}: ${why}`);
  };
  if (pts.length > 3) fail("more than 3 points");
  if (ids.filter((id) => SGLT2.includes(id)).length > 1) fail("two SGLT2 cards");
  if (ids.filter((id) => MRA.includes(id)).length > 1) fail("two MRA cards");
  for (const p of pts) {
    points++;
    const card = byId.get(p.card_id);
    if (!card) { fail(`unknown card ${p.card_id}`); continue; }
    if (!eligible.has(p.card_id)) fail(`ineligible card ${p.card_id}`);
    if (p.question !== card.question_for_clinician) fail(`question not verbatim on ${p.card_id}`);
    if (MG.test(p.point)) fail(`mg dose in ${p.card_id}`);
    if (REL.test(p.point)) fail(`relationship word in ${p.card_id}`);
    if (!p.standardized) {
      modelWording++;
      if (checkPoint(p.point, card, r.input).standardized) {
        wouldStandardize++;
        notes.push(`new checker would standardize ${r.name} ${p.card_id}: "${p.point}"`);
      }
    }
    if (p.rationale && !p.rationale.startsWith("Selected by rule")) {
      rationales++;
      if (!checkRationale(p.rationale, card, r.input)) {
        rationaleDropped++;
        notes.push(`new checker would drop rationale ${r.name} ${p.card_id}: "${p.rationale}"`);
      }
    }
  }
}

console.log(`Eval of ${results.length} synthetic cases against ${base}, run ${ran_at}`);
console.log(`Modes: ${Object.entries(modes).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`Latency (nemotron, server-measured): median ${quantile(lat, 0.5)} ms, p90 ${quantile(lat, 0.9)} ms, max ${Math.max(...lat)} ms`);
console.log(`Points: ${points}. Model wording kept: ${modelWording} (${pct(modelWording, points)}). Guideline wording swapped in: ${points - modelWording}.`);
console.log(`Rule violations: ${violations}`);
console.log(`Replay with current checker: ${wouldStandardize} of ${modelWording} model-worded points would be swapped (${pct(wouldStandardize, modelWording)}); ${rationaleDropped} of ${rationales} rationales would be dropped (${pct(rationaleDropped, rationales)}).`);
for (const n of notes) console.log(`- ${n}`);
