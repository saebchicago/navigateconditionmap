import type { ConditionKey } from "./navigator";

/** Synthetic example answers. Not a real person. */
export const EXAMPLE = {
  conditions: ["heart_failure", "type_2_diabetes", "ckd"] as ConditionKey[],
  hfType: "Preserved EF",
  meds: "metformin\nlisinopril\nfurosemide",
  numbers: { egfr: "38", uacr: "120", a1c: "7.9", bp: "142/86", potassium: "4.6" } as Record<
    string,
    string
  >,
  worry:
    "The ankles are swelling more, and I'm not sure the diabetes pills are still right for the kidneys.",
};

export interface FormState {
  conditions: ConditionKey[];
  hfType: string;
  meds: string;
  numbers: Record<string, string>;
  unknown: Record<string, boolean>;
  worry: string;
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);

/** True while the form still holds exactly the example answers. */
export function isExampleAnswers(f: FormState): boolean {
  const sameConditions =
    f.conditions.length === EXAMPLE.conditions.length &&
    EXAMPLE.conditions.every((c) => f.conditions.includes(c));
  const sameMeds = lines(f.meds).join("\n") === lines(EXAMPLE.meds).join("\n");
  const sameNumbers = Object.keys({ ...EXAMPLE.numbers, ...f.numbers }).every(
    (k) => (f.numbers[k] ?? "").trim() === (EXAMPLE.numbers[k] ?? ""),
  );
  return (
    sameConditions &&
    f.hfType === EXAMPLE.hfType &&
    sameMeds &&
    sameNumbers &&
    !Object.values(f.unknown).some(Boolean) &&
    f.worry.trim() === EXAMPLE.worry
  );
}

/** True when nothing has been entered yet, so loading the example cannot overwrite anything. */
export function isPristine(f: FormState): boolean {
  return (
    f.conditions.length === 0 &&
    !f.hfType &&
    !f.meds.trim() &&
    !Object.values(f.numbers).some((v) => v.trim()) &&
    !Object.values(f.unknown).some(Boolean) &&
    !f.worry.trim()
  );
}
