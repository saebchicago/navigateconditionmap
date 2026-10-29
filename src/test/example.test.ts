import { describe, it, expect } from "vitest";
import { EXAMPLE, isExampleAnswers, isPristine, type FormState } from "@/lib/example";

const base: FormState = { conditions: [], hfType: "", meds: "", numbers: {}, unknown: {}, worry: "" };
const example: FormState = { ...base, conditions: EXAMPLE.conditions, hfType: EXAMPLE.hfType, meds: EXAMPLE.meds, numbers: EXAMPLE.numbers, worry: EXAMPLE.worry };

describe("example answers", () => {
  it("an empty form is pristine and not the example", () => {
    expect(isPristine(base)).toBe(true);
    expect(isExampleAnswers(base)).toBe(false);
  });
  it("the untouched example is recognized, and is not pristine", () => {
    expect(isExampleAnswers(example)).toBe(true);
    expect(isPristine(example)).toBe(false);
  });
  it("any edit makes it no longer the example", () => {
    expect(isExampleAnswers({ ...example, worry: `${EXAMPLE.worry} Also dizzy.` })).toBe(false);
    expect(isExampleAnswers({ ...example, numbers: { ...EXAMPLE.numbers, egfr: "40" } })).toBe(false);
    expect(isExampleAnswers({ ...example, meds: "metformin" })).toBe(false);
    expect(isExampleAnswers({ ...example, unknown: { egfr: true } })).toBe(false);
    expect(isExampleAnswers({ ...example, conditions: ["heart_failure"] })).toBe(false);
  });
  it("whitespace differences in medicines and numbers do not matter", () => {
    expect(isExampleAnswers({ ...example, meds: " metformin \n\nlisinopril\nfurosemide ", numbers: { ...EXAMPLE.numbers, egfr: " 38 " } })).toBe(true);
  });
  it("typing anything stops the form being pristine", () => {
    expect(isPristine({ ...base, worry: "x" })).toBe(false);
    expect(isPristine({ ...base, hfType: "Not sure" })).toBe(false);
    expect(isPristine({ ...base, unknown: { bp: true } })).toBe(false);
  });
});
