// Does Nemotron's concern-sensitive ranking beat the rule-based fallback?
// Fixed situations, predefined expected card per concern, scored on the top 3 returned.
// Usage: bun scripts/eval/ranking.ts [baseUrl] [outFile]
import { writeFileSync } from "node:fs";
import pack from "../../src/data/evidence-pack.json";
import { fallbackPoints, filterEligible, type Card } from "../../src/lib/navigator";

const cards = (pack as { cards: Card[] }).cards;
const base = process.argv[2] ?? "https://navigateconditionmap.lovable.app";
const out = process.argv[3] ?? "scripts/eval/ranking.json";

const T2D_CKD = { conditions: ["type_2_diabetes", "ckd"], medicines: ["metformin", "lisinopril"] };
const ALL3 = {
  conditions: ["heart_failure", "type_2_diabetes", "ckd"],
  hfType: "Preserved EF",
  medicines: ["metformin", "lisinopril", "furosemide", "finerenone"],
};
const CASES = [
  {
    name: "BP targets",
    base: T2D_CKD,
    worry: "What blood pressure goal should we aim for and how often to check at home?",
    expect: ["E8"],
  },
  {
    name: "GLP-1",
    base: T2D_CKD,
    worry: "Would a GLP-1 medicine like semaglutide be an option for the kidneys?",
    expect: ["E7"],
  },
  {
    name: "Kidney screening",
    base: T2D_CKD,
    worry: "When should the kidneys be checked and with which tests?",
    expect: ["E1"],
  },
  {
    name: "Metformin dose",
    base: T2D_CKD,
    worry: "Is the metformin dose still right for the kidney numbers?",
    expect: ["E4"],
  },
  {
    name: "ACE and ARB",
    base: { conditions: ["type_2_diabetes", "ckd"], medicines: ["lisinopril", "losartan"] },
    worry: "Can lisinopril and losartan be taken together?",
    expect: ["E5"],
  },
  {
    name: "Heart failure hospital stays",
    base: ALL3,
    worry: "Worried about another hospital stay for heart failure.",
    expect: ["E3", "E10"],
  },
  {
    name: "Finerenone",
    base: ALL3,
    worry: "Questions about finerenone and whether it can go with another heart medicine.",
    expect: ["E6", "E10", "E12"],
  },
  { name: "No concern given", base: T2D_CKD, worry: "", expect: [] },
];

const rows: unknown[] = [];
let modelHit = 0,
  fbHit = 0,
  scored = 0;
for (const c of CASES) {
  const eligible = filterEligible(
    cards,
    c.base.conditions,
    c.base.medicines,
    (c.base as { hfType?: string }).hfType,
  );
  const fb = fallbackPoints(eligible, (c.base as { hfType?: string }).hfType).map((p) => p.card_id);
  const r = await fetch(`${base}/api/public/navigator-brief`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...c.base, worry: c.worry }),
  });
  const body = (await r.json()) as {
    mode: string;
    points: { card_id: string; matches_concern?: boolean }[];
  };
  const ids = body.points.map((p) => p.card_id);
  const hit = (list: string[]) => c.expect.some((e) => list.includes(e));
  if (c.expect.length) {
    scored++;
    if (hit(ids)) modelHit++;
    if (hit(fb)) fbHit++;
  }
  rows.push({
    name: c.name,
    expect: c.expect,
    mode: body.mode,
    model: ids,
    fallback: fb,
    matched: body.points.filter((p) => p.matches_concern).map((p) => p.card_id),
  });
  console.log(
    c.name,
    "| expect",
    c.expect.join("/") || "-",
    "| model",
    ids.join(","),
    "| fallback",
    fb.join(","),
    "| matched",
    body.points
      .filter((p) => p.matches_concern)
      .map((p) => p.card_id)
      .join(",") || "-",
  );
  await new Promise((res) => setTimeout(res, 4000));
}
console.log(
  `Expected card in top 3: model ${modelHit} of ${scored}, rule fallback ${fbHit} of ${scored}`,
);
writeFileSync(
  out,
  JSON.stringify(
    { base, ran_at: new Date().toISOString(), modelHit, fbHit, scored, rows },
    null,
    2,
  ),
);
