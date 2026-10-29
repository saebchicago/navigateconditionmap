// Rank stability: repeats each ranking-test concern and reports how often the expected card is in the top 3
// and how often the full top-3 list is identical to the most common one.
// Usage: bun scripts/eval/stability.ts [baseUrl] [repeats]
const base = process.argv[2] ?? "https://navigateconditionmap.lovable.app";
const repeats = Number(process.argv[3] ?? 5);
const T2D_CKD = { conditions: ["type_2_diabetes", "ckd"], medicines: ["metformin", "lisinopril"] };
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
];
let hits = 0,
  total = 0,
  same = 0;
for (const c of CASES) {
  const lists: string[] = [];
  for (let i = 0; i < repeats; i++) {
    const r = await fetch(`${base}/api/public/navigator-brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...c.base, worry: c.worry }),
    });
    const b = (await r.json()) as { mode: string; points: { card_id: string }[] };
    const ids = b.points.map((p) => p.card_id);
    lists.push(`${b.mode}:${ids.join(",")}`);
    total++;
    if (b.mode === "nemotron" && c.expect.some((e) => ids.includes(e))) hits++;
    await new Promise((res) => setTimeout(res, 2500));
  }
  const counts = new Map<string, number>();
  for (const l of lists) counts.set(l, (counts.get(l) ?? 0) + 1);
  const top = Math.max(...counts.values());
  same += top;
  console.log(c.name, `identical top-3 in ${top} of ${repeats}`, [...counts.keys()].join(" | "));
}
console.log(
  `Expected card in top 3: ${hits} of ${total} calls. Most common list repeated: ${same} of ${total}.`,
);
