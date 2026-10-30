import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import pack from "@/data/evidence-pack.json";
import {
  floorNote,
  potassiumNote,
  filterEligible,
  mentionsUrgentSymptoms,
  parseMedicines,
  unusualNumber,
  fallbackPoints,
  type BriefPoint,
  type Card,
  type ConditionKey,
  type Source,
} from "@/lib/navigator";
import { EXAMPLE, isExampleAnswers, isPristine } from "@/lib/example";

const SITE = "https://navigateconditionmap.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navigator by ConditionMap: questions for the next visit" },
      {
        name: "description",
        content:
          "Up to 3 guideline-backed questions for a heart failure, type 2 diabetes, or kidney disease visit. Free, no login, nothing stored. Educational only.",
      },
      { property: "og:title", content: "Navigator by ConditionMap" },
      {
        property: "og:description",
        content:
          "Up to 3 guideline-backed questions for the next visit. NVIDIA Nemotron orders them; every word comes from the guideline card.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE },
      { property: "og:image", content: `${SITE}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE}/og.png` },
    ],
  }),
  component: Index,
});

const CARDS = pack.cards as Card[];
const SOURCES = pack.sources as Record<string, Source>;
const SOURCE_NAMES: Record<string, string> = {
  ADA_KDIGO_2022: "ADA/KDIGO 2022 consensus report",
  ESC_HF_2023: "ESC 2023 heart failure guideline update",
  AHA_HF_2022: "AHA/ACC/HFSA 2022 heart failure guideline",
  ADA_CVD_2026: "ADA Standards of Care 2026, section 10",
  ADA_CKD_2026: "ADA Standards of Care 2026, section 11",
};
const CONDITIONS: { key: ConditionKey; label: string }[] = [
  { key: "heart_failure", label: "Heart failure" },
  { key: "type_2_diabetes", label: "Type 2 diabetes" },
  { key: "ckd", label: "Chronic kidney disease" },
];
const HF_TYPES = ["Reduced EF", "Mildly reduced EF", "Preserved EF", "Not sure"];
const CHIPS = [
  "metformin",
  "empagliflozin",
  "dapagliflozin",
  "lisinopril",
  "losartan",
  "finerenone",
  "semaglutide",
  "pioglitazone",
  "furosemide",
];
const NUMBERS = [
  {
    key: "egfr",
    label: "eGFR",
    field: "Kidney filtering result (eGFR)",
    hint: "Copy the eGFR number from the blood test report. Unit: mL/min/1.73m².",
    unit: "",
    unknownLabel: "I don't know the eGFR result",
  },
  {
    key: "uacr",
    label: "Urine albumin (UACR)",
    field: "Urine albumin result (UACR)",
    hint: "A urine test for a protein called albumin. Unit: mg/g.",
    unit: " mg/g",
    unknownLabel: "I don't know the UACR result",
  },
  {
    key: "a1c",
    label: "A1C",
    field: "A1C result (%)",
    hint: "A blood test that shows average blood sugar over about 3 months.",
    unit: "%",
    unknownLabel: "I don't know the A1C result",
  },
  {
    key: "bp",
    label: "Blood pressure",
    field: "Blood pressure",
    hint: "Enter both numbers with a slash, such as 130/80.",
    unit: "",
    unknownLabel: "I don't know the blood pressure",
  },
  {
    key: "potassium",
    label: "Potassium",
    field: "Potassium result",
    hint: "Copy the potassium number from the blood test report. Unit: mmol/L.",
    unit: " mmol/L",
    unknownLabel: "I don't know the potassium result",
  },
];
const STEPS = ["Conditions", "Medicines", "Numbers and worries"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : iso;
};
const sourceName = (id: string) => SOURCE_NAMES[id] ?? SOURCES[id]?.title ?? id;
// Standardized points start with "<topic>: "; the card heading already shows the topic.
const displayPoint = (point: string, topic: string) =>
  point.startsWith(`${topic}: `) ? point.slice(topic.length + 2) : point;
interface Result {
  points: BriefPoint[];
  more?: BriefPoint[];
  mode: "nemotron" | "fallback";
  model?: string;
  latency_ms?: number;
  error?: string;
}

interface Answers {
  conditions: ConditionKey[];
  hfType: string;
  medList: string[];
  numbers: Record<string, string>;
  unknown: Record<string, boolean>;
  worry: string;
}

function Index() {
  const [step, setStep] = useState(0);
  const [conditions, setConditions] = useState<ConditionKey[]>([]);
  const [hfType, setHfType] = useState("");
  const [meds, setMeds] = useState("");
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [unknown, setUnknown] = useState<Record<string, boolean>>({});
  const [worry, setWorry] = useState("");
  const [ownQuestions, setOwnQuestions] = useState("");
  const [includeGuideline, setIncludeGuideline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const busy = useRef(false);
  const requestId = useRef(0);
  const stepLabel = useRef<HTMLParagraphElement>(null);
  const firstRender = useRef(true);
  const form = { conditions, hfType, meds, numbers, unknown, worry };
  const exampleActive = isExampleAnswers(form);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step < 3) stepLabel.current?.focus();
  }, [step]);

  const medList = meds
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);

  const parsedMeds = parseMedicines(medList);

  const go = (s: number) => {
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const toggleCond = (k: ConditionKey) =>
    setConditions((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const addChip = (m: string) => {
    if (medList.some((x) => x.toLowerCase() === m)) return;
    setMeds((v) => (v.trim() ? `${v.trim()}\n${m}` : m));
  };

  const example = () => {
    setConditions(EXAMPLE.conditions);
    setHfType(EXAMPLE.hfType);
    setMeds(EXAMPLE.meds);
    setNumbers(EXAMPLE.numbers);
    setUnknown({});
    setWorry(EXAMPLE.worry);
    setResult(null);
    go(2);
  };

  const generate = async () => {
    if (busy.current) return;
    busy.current = true;
    const id = ++requestId.current;
    go(3);
    setLoading(true);
    setResult(null);
    const eligible = filterEligible(
      CARDS,
      conditions,
      medList,
      conditions.includes("heart_failure") ? hfType : undefined,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch("/api/public/navigator-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conditions,
          hfType: conditions.includes("heart_failure") ? hfType : undefined,
          medicines: medList,
          worry,
        }),
      });
      const data = (await r.json()) as Result;
      if (r.status === 429) throw new Error("rate_limited");
      if (!r.ok || !Array.isArray(data.points)) throw new Error("bad_response");
      if (id === requestId.current) setResult(data);
    } catch (e) {
      if (id === requestId.current)
        setResult({
          points: fallbackPoints(
            eligible,
            conditions.includes("heart_failure") ? hfType : undefined,
          ),
          mode: "fallback",
          error: (e as Error).message === "rate_limited" ? "rate_limited" : "service_unreachable",
        });
    } finally {
      clearTimeout(timer);
      busy.current = false;
      if (id === requestId.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div role="alert" className="no-print border-b-2 border-destructive bg-card px-4 py-3">
        <p className="mx-auto max-w-3xl rounded-md border-2 border-destructive px-3 py-2 text-center font-bold text-destructive">
          If someone has chest pain, severe shortness of breath, fainting, or confusion, call 911
          now.
        </p>
      </div>

      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" width={44} height={44} className="shrink-0" />
          <p className="font-serif text-3xl font-bold leading-none text-primary">
            Navigator{" "}
            <span className="mt-1 block font-sans text-sm font-normal text-muted-foreground sm:ml-2 sm:inline">
              by ConditionMap
            </span>
          </p>
        </div>
        {step < 3 && isPristine(form) && (
          <button
            type="button"
            onClick={example}
            className="no-print focus-ring min-h-11 shrink-0 rounded-md border-2 border-accent px-3 py-1.5 text-sm font-bold text-foreground hover:bg-accent/15"
          >
            See an example
          </button>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12">
        {step < 3 && (
          <>
            <div className="no-print mt-4 mb-6">
              <h1 className="font-serif text-2xl font-bold leading-snug sm:text-3xl">
                Walk into the next visit with good questions.
              </h1>
              <p className="mt-2 text-muted-foreground">
                Caring for someone with heart failure, type 2 diabetes, or kidney disease? Three
                short steps give you up to 3 questions for the care team, each from a published
                guideline. Print them and bring them.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Prototype: 12 guideline cards, not yet clinician-reviewed. NVIDIA Nemotron on Nebius
                Token Factory orders the questions; the cards supply every word.
              </p>
            </div>

            <div className="no-print mb-6">
              <p
                ref={stepLabel}
                tabIndex={-1}
                className="mb-2 text-sm text-muted-foreground outline-none"
              >
                Step {step + 1} of {STEPS.length}:{" "}
                <span className="font-bold text-foreground">{STEPS[step]}</span>
              </p>
              <ol aria-label="Progress" className="grid grid-cols-3 gap-2">
                {STEPS.map((s, i) => (
                  <li
                    key={s}
                    aria-current={i === step ? "step" : undefined}
                    className={`h-2 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}
                  >
                    <span className="sr-only">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {step === 0 && (
          <section className="card-surface p-5 sm:p-6">
            <fieldset aria-describedby="cond-hint">
              <legend className="mb-3 font-serif text-xl font-semibold">
                Which conditions does the person have?
              </legend>
              <div className="flex flex-col gap-2">
                {CONDITIONS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      className="focus-ring size-5 accent-primary"
                      checked={conditions.includes(c.key)}
                      onChange={() => toggleCond(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {conditions.includes("heart_failure") && (
              <fieldset className="mt-5">
                <legend className="mb-1 font-bold">Heart failure type (optional)</legend>
                <p className="mb-2 text-sm text-muted-foreground">
                  EF stands for ejection fraction. Look for it on a heart ultrasound (echo) report.
                  If you do not know the type, choose “Not sure.”
                </p>
                <div className="flex flex-wrap gap-2">
                  {HF_TYPES.map((t) => (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-secondary"
                    >
                      <input
                        type="radio"
                        name="hf"
                        className="focus-ring size-4 accent-primary"
                        checked={hfType === t}
                        onChange={() => setHfType(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {conditions.includes("ckd") && !conditions.includes("type_2_diabetes") && (
              <p
                id="kidney-note"
                role="status"
                className="mt-4 rounded-md border-2 border-accent bg-accent/10 p-3 text-sm"
              >
                {conditions.length === 1 ? (
                  <>
                    <strong>No questions for kidney disease alone yet.</strong> Kidney questions
                    require type 2 diabetes. Add any other conditions the person has.
                  </>
                ) : (
                  <>
                    <strong>No kidney questions included.</strong> They require type 2 diabetes.
                    Questions for your other choices are included.
                  </>
                )}
              </p>
            )}
            <Nav
              next={() => go(1)}
              nextDisabled={!conditions.length}
              nextLabel={
                conditions.length === 1 && conditions[0] === "ckd" ? "Continue anyway" : "Next"
              }
            />
            <p
              id="cond-hint"
              className={`mt-2 text-right text-sm text-muted-foreground ${conditions.length ? "sr-only" : ""}`}
            >
              Choose at least one condition to continue.
            </p>
          </section>
        )}

        {step === 1 && (
          <section className="card-surface p-5 sm:p-6">
            <label htmlFor="meds" className="mb-1 block font-serif text-xl font-semibold">
              Medicines the person takes
            </label>
            <p id="meds-hint" className="mb-3 text-sm text-muted-foreground">
              Optional. One medicine per line, spelled as on the label, and only medicines the
              person takes now. The names below are shortcuts, not suggestions.
            </p>
            <textarea
              id="meds"
              aria-describedby="meds-hint"
              rows={5}
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              className="focus-ring w-full rounded-md border-2 border-input bg-card p-3"
            />
            {medList.length > 0 && (
              <div
                className="mt-3 rounded-md border border-border bg-card p-3 text-sm"
                aria-live="polite"
              >
                <p>
                  <strong>Counted as medicines the person takes now:</strong>{" "}
                  {parsedMeds.current.length ? parsedMeds.current.join(", ") : "none"}
                </p>
                {parsedMeds.skipped.length > 0 && (
                  <p className="mt-1">
                    <strong>Not counted</strong> (marked as stopped, not taken, or similar):{" "}
                    {parsedMeds.skipped.join(", ")}. If that is wrong, write the medicine again on
                    its own line without extra words.
                  </p>
                )}
                <p className="mt-1 text-muted-foreground">
                  Check this list against the medicine labels or with the care team.
                </p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick add medicines">
              {CHIPS.map((m) => {
                const on = medList.some((x) => x.toLowerCase() === m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => addChip(m)}
                    className={`focus-ring min-h-11 rounded-full border px-4 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-secondary-foreground hover:border-primary"}`}
                  >
                    {on ? "✓" : "+"} {m}
                  </button>
                );
              })}
            </div>
            <Nav back={() => go(0)} next={() => go(2)} nextLabel="Next: numbers and worries" />
          </section>
        )}

        {step === 2 && (
          <section className="card-surface p-5 sm:p-6">
            <h2 className="mb-1 font-serif text-xl font-semibold">
              Latest test results and blood pressure
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Optional. Use the latest results you have.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {NUMBERS.map((n) => (
                <div key={n.key}>
                  <label htmlFor={n.key} className="block font-bold">
                    {n.field}
                  </label>
                  <p id={`${n.key}-hint`} className="text-sm text-muted-foreground">
                    {n.hint}
                  </p>
                  <input
                    id={n.key}
                    type="text"
                    inputMode={n.key === "bp" ? "text" : "decimal"}
                    autoComplete="off"
                    aria-describedby={`${n.key}-hint`}
                    disabled={unknown[n.key]}
                    value={numbers[n.key] ?? ""}
                    onChange={(e) =>
                      setNumbers({ ...numbers, [n.key]: e.target.value.slice(0, 12) })
                    }
                    className="focus-ring mt-1 min-h-12 w-full rounded-md border-2 border-input bg-card p-2 disabled:opacity-50"
                  />
                  <label className="mt-1 flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="focus-ring size-6 accent-primary"
                      aria-label={n.unknownLabel}
                      checked={!!unknown[n.key]}
                      onChange={(e) => setUnknown({ ...unknown, [n.key]: e.target.checked })}
                    />
                    Don't know
                  </label>
                </div>
              ))}
            </div>
            <label htmlFor="worry" className="mt-6 block font-serif text-lg font-semibold">
              What worries you most before this visit?
            </label>
            <p id="worry-hint" className="text-sm text-muted-foreground">
              Optional. This text goes to the AI provider, so leave out names, birth dates, test
              results, and other identifying details.
            </p>
            <textarea
              id="worry"
              aria-describedby="worry-hint"
              rows={3}
              maxLength={300}
              value={worry}
              onChange={(e) => setWorry(e.target.value)}
              className="focus-ring mt-1 w-full rounded-md border-2 border-input bg-card p-3"
            />
            <p className="text-right text-sm text-muted-foreground">
              {worry.length} of 300 characters
            </p>
            <Nav back={() => go(1)} next={generate} nextLabel="Make my questions" />
            <p className="mt-3 text-right text-sm text-muted-foreground">
              Conditions, medicines, heart failure type, and concern go to the AI provider (Nebius).
              Test results stay in your browser. This app saves nothing.
            </p>
          </section>
        )}

        {step === 3 && (
          <Brief
            loading={loading}
            result={result}
            answers={{ conditions, hfType, medList, numbers, unknown, worry }}
            isExample={exampleActive}
            ownQuestions={ownQuestions}
            setOwnQuestions={setOwnQuestions}
            includeGuideline={includeGuideline}
            setIncludeGuideline={setIncludeGuideline}
            onEdit={() => go(0)}
          />
        )}
      </main>

      <footer className="no-print border-t border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <p>
            Made by Saeb Ahsan{" · "}
            <a
              className="focus-ring font-bold text-primary underline"
              href="https://conditionmap.com"
              target="_blank"
              rel="noreferrer"
            >
              conditionmap.com
            </a>
            {" · "}
            <a
              className="focus-ring font-bold text-primary underline"
              href="https://valuesincare.com"
              target="_blank"
              rel="noreferrer"
            >
              valuesincare.com
            </a>
            {" · "}
            <a
              className="focus-ring font-bold text-primary underline"
              href="https://github.com/saebchicago/navigateconditionmap"
              target="_blank"
              rel="noreferrer"
            >
              Open source on GitHub
            </a>{" "}
            (AGPL-3.0)
          </p>
          <p>
            Uses NVIDIA Nemotron on Nebius Token Factory to order questions. Guideline cards updated{" "}
            {longDate(pack.version)}.
          </p>
          <details>
            <summary className="focus-ring cursor-pointer font-bold">
              Sources used by this app
            </summary>
            <p className="mt-1">
              ADA/KDIGO 2022 consensus report, ESC 2023 heart failure guideline update, AHA/ACC/HFSA
              2022 heart failure guideline, ADA Standards of Care 2026 (sections 10 and 11).
            </p>
          </details>
          <details>
            <summary className="focus-ring cursor-pointer font-bold">Why this exists</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                OpenAI reports, from its own ChatGPT usage data and a survey (January 2026), that
                more than 5% of all ChatGPT messages are about healthcare, that over 40 million
                people ask healthcare questions daily, and that seven in 10 health conversations
                happen outside normal clinic hours.{" "}
                <a
                  href="https://cdn.openai.com/pdf/2cb29276-68cd-4ec6-a5f4-c01c5e7a36e9/OpenAI-AI-as-a-Healthcare-Ally-Jan-2026.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring text-primary underline underline-offset-2"
                >
                  OpenAI report
                </a>
              </li>
              <li>
                The Anthropic Economic Index (May 2026 snapshot) matches 3.31% of sampled Claude
                conversations to tasks commonly done by healthcare practitioners and technical
                occupations. It does not measure health questions from patients or caregivers.{" "}
                <a
                  href="https://www.anthropic.com/economic-index"
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring text-primary underline underline-offset-2"
                >
                  Anthropic Economic Index
                </a>
              </li>
            </ul>
            <p className="mt-1">
              These figures come from the companies' own data and show demand. They do not measure
              whether Navigator helps.
            </p>
          </details>
          <p>
            This app saves nothing and adds no analytics or cookies of its own. Conditions,
            medicines, heart failure type, and concern go to the AI provider (Nebius) for each
            brief; test results stay in your browser. Nebius may keep requests by default, for
            speculative decoding, unless Zero Data Retention is enabled. The host (Lovable) runs its
            own analytics, including page views and clicks, and sets a bot-protection cookie and an
            analytics cookie. Fonts load from Google Fonts. Do not enter names or identifying
            details.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Nav({
  back,
  next,
  nextDisabled,
  nextLabel = "Next",
}: {
  back?: () => void;
  next: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-6 flex justify-between gap-3">
      {back ? (
        <button
          type="button"
          onClick={back}
          className="focus-ring min-h-12 rounded-md border-2 border-border px-5 py-2.5 font-bold hover:bg-muted"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={next}
        disabled={nextDisabled}
        className="focus-ring min-h-12 rounded-md bg-primary px-6 py-2.5 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Loading() {
  return (
    <section className="card-surface p-6" role="status">
      <p className="font-serif text-lg font-semibold text-primary">
        Putting your questions in order...
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        If the AI service is down, you still get questions from the guidelines.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
    </section>
  );
}

function YouToldUs({ a, isExample }: { a: Answers; isExample: boolean }) {
  const conds = CONDITIONS.filter((c) => a.conditions.includes(c.key)).map((c) =>
    c.key === "heart_failure" && a.hfType && a.hfType !== "Not sure"
      ? `${c.label} (${a.hfType})`
      : c.label,
  );
  const nums = NUMBERS.flatMap((n) => {
    if (a.unknown[n.key]) return [`${n.label}: don't know`];
    const v = a.numbers[n.key]?.trim();
    return v
      ? [
          `${n.label} ${v}${n.unit}${unusualNumber(n.key, v) ? " (check this number against the lab report)" : ""}`,
        ]
      : [];
  });
  return (
    <section className="print-card mb-5 rounded-md border border-border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">What you told us</h2>
      {isExample && (
        <p className="mt-1 text-sm font-bold">
          Example answers. These are not the person's answers.
        </p>
      )}
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="font-bold">Conditions</dt>
        <dd>{conds.join(", ")}</dd>
        <dt className="font-bold">Medicines</dt>
        <dd>
          {parseMedicines(a.medList).current.length
            ? parseMedicines(a.medList).current.join(", ")
            : "None listed"}
          {parseMedicines(a.medList).skipped.length > 0 && (
            <span className="block text-muted-foreground">
              Not counted as current: {parseMedicines(a.medList).skipped.join(", ")}
            </span>
          )}
        </dd>
        {nums.length > 0 && (
          <>
            <dt className="font-bold">Test results</dt>
            <dd>{nums.join(" · ")}</dd>
          </>
        )}
        {a.worry.trim() && (
          <>
            <dt className="font-bold">Main worry</dt>
            <dd className="italic">“{a.worry.trim()}”</dd>
          </>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Entered by the caregiver, not checked against the medical record. Test results are copied as
        entered, without dates or interpretation.
      </p>
    </section>
  );
}

function Brief({
  loading,
  result,
  answers,
  isExample,
  ownQuestions,
  setOwnQuestions,
  includeGuideline,
  setIncludeGuideline,
  onEdit,
}: {
  loading: boolean;
  result: Result | null;
  answers: Answers;
  isExample: boolean;
  ownQuestions: string;
  setOwnQuestions: (v: string) => void;
  includeGuideline: boolean;
  setIncludeGuideline: (v: boolean) => void;
  onEdit: () => void;
}) {
  const ready = !loading && result !== null;
  const [view, setView] = useState<{ src: Result | null; order: string[]; removed: string[] }>({
    src: null,
    order: [],
    removed: [],
  });
  useEffect(() => {
    if (ready) document.getElementById("results-heading")?.focus();
  }, [ready]);

  if (!ready || !result) return <Loading />;

  const byId = new Map(CARDS.map((c) => [c.id, c]));
  const pool = new Map([...result.points, ...(result.more ?? [])].map((p) => [p.card_id, p]));
  const cur =
    view.src === result
      ? view
      : { src: result, order: result.points.map((p) => p.card_id), removed: [] as string[] };
  const visible = cur.order.flatMap((id) => pool.get(id) ?? []);
  const nextCandidate = [...pool.keys()].find(
    (id) => !cur.order.includes(id) && !cur.removed.includes(id),
  );
  const update = (order: string[], removed: string[]) => setView({ src: result, order, removed });
  const move = (i: number) => {
    const o = [...cur.order];
    const a = o[i - 1];
    const b = o[i];
    if (a === undefined || b === undefined) return;
    o[i - 1] = b;
    o[i] = a;
    update(o, cur.removed);
  };
  const hasCkd = answers.conditions.includes("ckd");
  const hasT2d = answers.conditions.includes("type_2_diabetes");
  const kidneyNote = hasCkd && !hasT2d;
  const kidneyOnly = kidneyNote && answers.conditions.length === 1;
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="mt-4">
      <p role="status" className="sr-only">
        Your questions are ready.
      </p>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id="results-heading"
            tabIndex={-1}
            className="font-serif text-3xl font-bold text-primary outline-none"
          >
            Questions for the visit
          </h1>
          <p className="text-sm text-muted-foreground">Prepared {today}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring min-h-12 rounded-md border-2 border-border px-4 py-2 font-bold hover:bg-muted"
          >
            Edit answers
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="focus-ring min-h-12 rounded-md bg-accent px-4 py-2 font-bold text-accent-foreground hover:bg-accent/90"
          >
            Print for the visit
          </button>
        </div>
      </div>

      <label className="no-print mb-3 flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="focus-ring size-5 accent-primary"
          checked={includeGuideline}
          onChange={(e) => setIncludeGuideline(e.target.checked)}
        />
        Include the guideline text on the printout (makes it longer)
      </label>

      <p className="print-only mb-2 text-sm">
        Name of the person you care for: ____________________ Visit date: ____________
      </p>

      <YouToldUs a={answers} isExample={isExample} />

      {mentionsUrgentSymptoms(answers.worry) && (
        <p
          role="alert"
          className="mb-4 rounded-md border-2 border-destructive bg-card p-3 text-sm font-bold text-destructive"
        >
          You wrote about symptoms that may need urgent care. If this is happening now, call 911 or
          your local emergency number. This app cannot assess symptoms.
        </p>
      )}

      <p className="mb-4 rounded-md border border-border bg-card p-3 text-sm">
        For planning visit questions only. This app does not check symptoms or choose treatment.
      </p>

      {kidneyNote && result.points.length > 0 && (
        <p className="mb-4 rounded-md border border-border bg-card p-3 text-sm">
          <strong>No kidney questions included.</strong> They require type 2 diabetes.
        </p>
      )}

      {result.mode === "fallback" && result.points.length > 0 && (
        <p className="mb-4 rounded-md border-2 border-accent bg-accent/10 p-3 text-sm">
          {result.error === "rate_limited" ? (
            <>
              <strong>The AI service hit its request limit.</strong> These are the guideline cards
              in their usual order. Use them now or try again later.
            </>
          ) : (
            <>
              <strong>The AI service is unavailable.</strong> These are the guideline cards in their
              usual order, with sources.
            </>
          )}
        </p>
      )}

      {result.points.length === 0 ? (
        <p className="card-surface p-5">
          {kidneyOnly
            ? "No questions for kidney disease alone yet: kidney cards require type 2 diabetes. Use Edit answers to check the conditions."
            : "No guideline cards match these answers. Some cards depend on the medicines listed."}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            Numbers show the order of the questions, not how urgent they are.
          </p>
          {result.mode === "nemotron" &&
            answers.worry.trim() &&
            !result.points.some((p) => p.matches_concern) && (
              <p className="mb-3 rounded-md border border-accent bg-accent/10 p-3 text-sm">
                <strong>None of these cards speaks directly to the concern you wrote.</strong> Add
                it to “Your own questions” below and ask the care team.
              </p>
            )}
          <ol className="flex flex-col gap-4">
            {visible.map((p, i) => {
              const card = byId.get(p.card_id);
              if (!card) return null;
              const src = SOURCES[card.source];
              if (!src) return null;
              const supportingSources = [
                ...new Set(
                  (p.supporting_card_ids ?? []).flatMap((id) => {
                    const supporting = byId.get(id);
                    return supporting && supporting.source !== card.source
                      ? [supporting.source]
                      : [];
                  }),
                ),
              ];
              const hfUnknown =
                (card.id === "E3" || card.id === "E9") &&
                answers.conditions.includes("heart_failure") &&
                (!answers.hfType || answers.hfType === "Not sure");
              const notes = [
                floorNote(card),
                potassiumNote(card),
                hfUnknown
                  ? answers.hfType === "Not sure"
                    ? "You said you are not sure of the heart failure type. This card is written for a specific type. Ask the care team which type applies."
                    : "The heart failure type was not given. This card is written for a specific type. Ask the care team which type applies."
                  : null,
              ].filter((n): n is string => n !== null);
              return (
                <li key={p.card_id} className="card-surface print-card p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="print-exact flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif font-bold text-primary-foreground"
                    >
                      {i + 1}
                    </span>
                    <h2 className="pt-0.5 font-serif text-xl font-semibold text-primary">
                      {card.topic}
                    </h2>
                  </div>
                  <div className="mt-3 rounded-md border-l-4 border-accent bg-secondary p-4">
                    <p className="text-sm font-bold text-secondary-foreground">Ask the care team</p>
                    <p className="text-lg font-bold">“{card.question_for_clinician}”</p>
                    <div className="print-only mt-2 text-sm">
                      Care team notes:
                      <span className="print-line" />
                      <span className="print-line" />
                    </div>
                  </div>
                  {p.matches_concern && answers.worry.trim() && (
                    <p className="mt-2 inline-block rounded-full border border-primary px-3 py-0.5 text-sm font-bold text-primary">
                      Matches the concern you wrote
                    </p>
                  )}
                  <p className="mt-3">{displayPoint(p.point, card.topic)}</p>
                  {notes.map((n) => (
                    <p
                      key={n}
                      className="mt-2 rounded-md border border-accent bg-accent/10 p-2 text-sm"
                    >
                      <strong>Check this one:</strong> {n}
                    </p>
                  ))}
                  <div className="no-print mt-3 flex flex-wrap gap-2">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => move(i)}
                        className="focus-ring min-h-11 rounded-md border border-border bg-secondary px-3 text-sm font-bold"
                      >
                        Move up
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          cur.order.filter((id) => id !== p.card_id),
                          [...cur.removed, p.card_id],
                        )
                      }
                      className="focus-ring min-h-11 rounded-md border border-border bg-secondary px-3 text-sm font-bold"
                    >
                      Remove this question
                    </button>
                  </div>
                  <details className="no-print mt-3">
                    <summary className="focus-ring cursor-pointer font-bold text-primary">
                      Sources and guideline text
                    </summary>
                    <p className="mt-2 text-muted-foreground">{card.guideline_says}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Full citation: {sourceName(card.source)} (doi:{src.doi})
                      {supportingSources.map((sourceId) => {
                        const source = SOURCES[sourceId];
                        if (!source) return null;
                        return (
                          <span key={sourceId}>
                            {" · Also: "}
                            <a
                              href={`https://doi.org/${source.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="focus-ring text-primary underline underline-offset-2"
                            >
                              {sourceName(sourceId)}
                            </a>
                          </span>
                        );
                      })}
                    </p>
                  </details>
                  {includeGuideline && (
                    <p className="print-only mt-2 text-sm">
                      <strong>Guideline text:</strong> {card.guideline_says}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-muted-foreground">
                    Source:{" "}
                    <a
                      href={`https://doi.org/${src.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring font-bold text-primary underline underline-offset-2"
                    >
                      {sourceName(card.source)}
                    </a>
                  </p>
                </li>
              );
            })}
          </ol>
          <div className="no-print mt-3 flex flex-wrap items-center gap-3" aria-live="polite">
            {visible.length === 0 && (
              <p className="text-sm">You removed every question. Restore them to see the list.</p>
            )}
            {nextCandidate && cur.order.length < 5 && (
              <button
                type="button"
                onClick={() => update([...cur.order, nextCandidate], cur.removed)}
                className="focus-ring min-h-11 rounded-md border-2 border-primary px-4 font-bold text-primary"
              >
                Add another question
              </button>
            )}
            {cur.removed.length > 0 && (
              <button
                type="button"
                onClick={() => update([...cur.order, ...cur.removed], [])}
                className="focus-ring min-h-11 rounded-md border border-border bg-secondary px-4 text-sm font-bold"
              >
                Restore {cur.removed.length} removed{" "}
                {cur.removed.length === 1 ? "question" : "questions"}
              </button>
            )}
          </div>
        </>
      )}

      <section className="card-surface print-card mt-4 p-5">
        <h2 className="font-serif text-xl font-semibold text-primary">Your own questions</h2>
        <label htmlFor="own" className="no-print mt-1 block text-sm text-muted-foreground">
          Anything else to ask? It prints with your list and stays only in this tab.
        </label>
        <textarea
          id="own"
          rows={3}
          value={ownQuestions}
          onChange={(e) => setOwnQuestions(e.target.value.slice(0, 600))}
          className="no-print focus-ring mt-2 w-full rounded-md border-2 border-input bg-card p-3"
        />
        {ownQuestions.trim() && (
          <p className="print-only mt-2 whitespace-pre-wrap break-words">{ownQuestions.trim()}</p>
        )}
        <div className="print-only mt-2">
          <span className="print-line" />
          <span className="print-line" />
        </div>
      </section>

      <section className="card-surface print-card mt-4 p-5">
        <h2 className="font-serif text-xl font-semibold text-primary">Before you go</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          General visit prompts. They are not from the 12 guideline cards.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Bring every medicine bottle, including over-the-counter medicines and supplements.
          </li>
          <li>Bring the latest test results, or ask the care team where to find them.</li>
          <li>
            If cost is a worry, ask: “Is each medicine covered by the person’s plan, and who can
            tell us the expected cost? Is prior authorization needed, and who handles it? Who can
            help if a medicine is hard to afford?”
          </li>
        </ul>
        <p className="no-print mt-3 text-sm">
          Want to think about what matters most to the person first?{" "}
          <a
            href="https://valuesincare.com"
            target="_blank"
            rel="noreferrer"
            className="focus-ring font-bold text-primary underline underline-offset-2"
          >
            ValuesInCare
          </a>{" "}
          is a free, separate site by the same builder. Nothing from this page is sent to it.
        </p>
      </section>

      <section className="card-surface print-card mt-4 p-5">
        <h2 className="font-serif text-xl font-semibold text-primary">After the visit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own notes. They are not checked by the care team. Write them by hand on the printout.
        </p>
        <ul className="mt-2 space-y-3">
          {[
            "What did the care team say?",
            "Who will do what, and by when?",
            "What do we still need explained?",
            "Can we say the plan back to check that we understood?",
          ].map((q) => (
            <li key={q}>
              <span className="font-bold">{q}</span>
              <span className="print-line" />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 rounded-md border border-border bg-card p-3 text-sm font-bold">
        Educational information from published guidelines, not medical advice. Do not change
        medicines based on this page; decide care with the care team.
      </p>

      <details className="no-print mt-4 p-1 text-sm text-muted-foreground">
        <summary className="focus-ring cursor-pointer font-bold">
          Medical terms on this page
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          <li>CKD: short for chronic kidney disease.</li>
          <li>eGFR: an estimate of how well the kidneys filter blood.</li>
          <li>UACR: a urine test that compares albumin, a protein, with creatinine.</li>
          <li>A1C: a blood test that shows average blood sugar over about 3 months.</li>
          <li>EF: short for ejection fraction, a measure of how well the heart pumps.</li>
          <li>SGLT2 inhibitor: a type of medicine.</li>
        </ul>
      </details>

      <details className="no-print mt-3 p-1 text-sm text-muted-foreground">
        <summary className="focus-ring cursor-pointer font-bold">How this page was made</summary>
        <p className="mt-2">
          Rules pick the guideline cards that fit your answers. NVIDIA Nemotron, run on Nebius Token
          Factory, orders them. Every word shown is the card's own; the AI writes none of it. Test
          results are not sent to the AI. This is not a clinical review.
        </p>
        <p className="mt-1">
          AI model: {result.mode === "nemotron" ? result.model : "none (rule-based)"}
          {result.latency_ms != null &&
            `. Model response time: ${(result.latency_ms / 1000).toFixed(1)} seconds.`}
        </p>
      </details>

      <p className="print-only mt-4 text-xs">
        Made with Navigator by ConditionMap ({SITE.replace("https://", "")}). Educational only, not
        medical advice.
      </p>
    </section>
  );
}
