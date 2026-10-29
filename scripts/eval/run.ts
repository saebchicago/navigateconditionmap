// Live evaluation: sends each synthetic case to the public endpoint and saves raw responses.
// Usage: bun scripts/eval/run.ts [baseUrl] [outFile]
// The endpoint allows 10 requests per 10 minutes per IP, so requests are paced.
import { writeFileSync } from "node:fs";
import { CASES } from "./cases";

const base = process.argv[2] ?? "https://navigateconditionmap.lovable.app";
const out = process.argv[3] ?? `scripts/eval/results-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
const paceMs = Number(process.env["EVAL_PACE_MS"] ?? 62000);
const results: unknown[] = [];

for (const [i, c] of CASES.entries()) {
  const { name, ...input } = c;
  const t0 = Date.now();
  let status = 0;
  let body: unknown = null;
  try {
    const r = await fetch(`${base}/api/public/navigator-brief`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    status = r.status;
    body = await r.json();
  } catch (e) {
    body = { error: (e as Error).message };
  }
  results.push({ name, input, status, wall_ms: Date.now() - t0, response: body });
  writeFileSync(out, JSON.stringify({ base, ran_at: new Date().toISOString(), results }, null, 1));
  console.log(`${i + 1}/${CASES.length} ${status} ${name}`);
  if (i < CASES.length - 1) await new Promise((r) => setTimeout(r, paceMs));
}
console.log(`saved ${out}`);
