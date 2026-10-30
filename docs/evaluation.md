# Evaluation

Detailed results behind the summary in the [README](../README.md#results). Each result names the build (commit) it measured.

`scripts/eval` runs 30 synthetic caregiver cases (no real patient data) against the live endpoint and scores the responses (`bun scripts/eval/score.ts scripts/eval/after-9caafa7.json`). Result files: `baseline.json` (build `814a82d`), `after.json` (`507bb50`), `after-c9d432b.json`, `after-791de5e.json`, and `after-019bcea.json`, and `after-9caafa7.json` (build `9caafa7`, the latest measured). All runs were on Oct 29, 2026.

|                                       | `814a82d`                                                | `507bb50`                           | `c9d432b`                          | `791de5e`                                                         | `9caafa7`                          |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Answered by Nemotron                  | 27 of 30                                                 | 28 of 30                            | 28 of 30                           | 27 of 30                                                          | 28 of 30                           |
| Fallback                              | 3 (2 kidney-only cases with no cards, 1 Nebius HTTP 529) | 2 (the same kidney-only cases)      | 2 (the same kidney-only cases)     | 3 (2 kidney-only cases, 1 unusable model output; 0 of 6 on retry) | 2 (the kidney-only cases)          |
| Model response time (server-measured) | median 1.9 s, p90 5.4 s, max 12.2 s                      | median 1.7 s, p90 5.1 s, max 13.8 s | median 1.5 s, p90 1.9 s, max 2.1 s | median 0.9 s, p90 1.6 s, max 1.9 s                                | median 0.9 s, p90 1.1 s, max 1.3 s |
| Model-written sentences shown         | 64 of 67 (96%)                                           | 52 of 67 (78%)                      | 12 of 67 (18%)                     | 0 (not shown by design)                                           | 0 (not shown by design)            |
| Violations of 6 structural rules\*    | 0                                                        | 0                                   | 0                                  | 0                                                                 | 0                                  |
| Heart failure cards that did not fit  | see note                                                 | see note                            | 0                                  | 0                                                                 | 0                                  |

\*At most 3 points, at most one card per medicine class, only eligible cards, questions verbatim from the card, no milligram dose, no relationship words.

How the design changed: each stricter wording check replaced more of the model's sentences with the guideline's own wording (4%, 22%, then 82% replaced). An adversarial test of 171 unsafe sentences passed 159 through the earlier checker and 15 through the allowlist (13 were cards' own wording). A later audit then reproduced a reversal on the live site: a crafted concern field made the model write "Combining an ACE inhibitor with an ARB is advised for people with diabetes", which used only words from the card and passed the allowlist. A word check cannot catch negation or a swapped subject. From build `791de5e` on, the model orders cards and writes no text that is shown, and the same attack returns the card's own wording. The adversarial test script is not included in this repository. The scores cover structure and listed wording rules only. They do not establish clinical correctness, and thirty synthetic cases from one day is a small sample. The older runs sent test results to the endpoint; the server now ignores them.

## Does Nemotron's ranking beat the rule-based fallback?

`scripts/eval/ranking.ts` fixes eight situations and, for seven of them, a concern with a predefined expected card (chosen by the author before running). It then checks whether that card is in the top 3. Result (`scripts/eval/ranking.json`, re-run on the live site Oct 29, 23:15 UTC, after the E7 and E12 wording change): Nemotron 7 of 7, rule fallback 3 of 7. Nemotron's ranking changes which cards appear in response to the concern; the fallback cannot. This is seven author-chosen cases, not a general measure of ranking quality, and it does not measure clinical usefulness. The model also returns a yes or no "matches the concern" flag per card, shown only as a fixed label. `scripts/eval/stability.ts` repeats four of those concerns five times each: the expected card was in the top 3 in 20 of 20 calls, and the full top 3 was identical across repeats in 18 of 20 (the variation was in the second and third slots; one call right after a deployment returned a different list). That flag is the model's judgment and is not measured: in one case it also marked the metformin card for a heart failure concern.

## Running the evaluation yourself

```bash
bun scripts/eval/run.ts https://navigateconditionmap.lovable.app scripts/eval/mine.json
bun scripts/eval/score.ts scripts/eval/mine.json
```

The runner sends 30 live requests paced 62 seconds apart by default (about 31 minutes; `EVAL_PACE_MS` changes the pace). The endpoint limits each IP address, so do not run other traffic from the same address meanwhile.
