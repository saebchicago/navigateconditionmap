import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import pack from "@/data/evidence-pack.json";
import {
  filterEligible,
  fallbackPoints,
  type BriefPoint,
  type Card,
  type ConditionKey,
  type Source,
} from "@/lib/navigator";

const SITE = "https://navigateconditionmap.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Navigator by ConditionMap: questions for the next visit" },
      {
        name: "description",
        content:
          "Up to 3 questions for a visit about heart failure, type 2 diabetes, or kidney disease, each tied to a published guideline. Free, no login, nothing stored. Educational only.",
      },
      { property: "og:title", content: "Navigator by ConditionMap" },
      {
        property: "og:description",
        content:
          "Up to 3 questions for the next visit, each tied to a published guideline. Ranked by NVIDIA Nemotron, checked in code.",
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
  { key: "egfr", label: "eGFR", hint: "mL/min/1.73m²", unit: "" },
  { key: "uacr", label: "Urine albumin (UACR)", hint: "mg/g", unit: " mg/g" },
  { key: "a1c", label: "A1C", hint: "%", unit: "%" },
  { key: "bp", label: "Blood pressure", hint: "e.g. 130/80", unit: "" },
  { key: "potassium", label: "Potassium", hint: "mmol/L", unit: " mmol/L" },
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
const displayRationale = (r?: string) => {
  if (!r || r.startsWith("Selected by rule"))
    return "Added from the guideline cards to round out the list.";
  return r.replace(/^E\d{1,2}\b/, "This card").replace(/\bE\d{1,2}\b/g, "this card");
};

interface Result {
  points: BriefPoint[];
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const medList = meds
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);

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
    setConditions(["heart_failure", "type_2_diabetes", "ckd"]);
    setHfType("Preserved EF");
    setMeds("metformin\nlisinopril\nfurosemide");
    setNumbers({ egfr: "38", uacr: "120", a1c: "7.9", bp: "142/86", potassium: "4.6" });
    setUnknown({});
    setWorry(
      "The ankles are swelling more, and I'm not sure the diabetes pills are still right for the kidneys.",
    );
    setResult(null);
    go(2);
  };

  const generate = async () => {
    go(3);
    setLoading(true);
    setResult(null);
    const nums: Record<string, string> = {};
    for (const n of NUMBERS)
      nums[n.key] = unknown[n.key] ? "don't know" : numbers[n.key]?.trim() || "not provided";
    const eligible = filterEligible(CARDS, conditions, medList);
    try {
      const r = await fetch("/api/public/navigator-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conditions,
          hfType: conditions.includes("heart_failure") ? hfType : undefined,
          medicines: medList,
          numbers: nums,
          worry,
        }),
      });
      const data = (await r.json()) as Result;
      if (!r.ok || !Array.isArray(data.points)) throw new Error("bad_response");
      setResult(data);
    } catch {
      setResult({
        points: fallbackPoints(eligible, conditions.includes("heart_failure") ? hfType : undefined),
        mode: "fallback",
        error: "service_unreachable",
      });
    } finally {
      setLoading(false);
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

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" width={44} height={44} className="shrink-0" />
          <p className="font-serif text-3xl font-bold leading-none text-primary">
            Navigator
            <span className="mt-1 block font-sans text-sm font-normal text-muted-foreground sm:ml-2 sm:inline">
              by ConditionMap
            </span>
          </p>
        </div>
        {step < 3 && (
          <button
            type="button"
            onClick={example}
            className="no-print focus-ring shrink-0 rounded-md border-2 border-accent px-3 py-1.5 text-sm font-bold text-foreground hover:bg-accent/15"
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
                For anyone helping someone live with heart failure, type 2 diabetes, or kidney
                disease. Answer three short steps. You get up to 3 questions for the care team, each
                tied to a published guideline, on one page you can print.
              </p>
            </div>

            <div className="no-print mb-6">
              <p className="mb-2 text-sm text-muted-foreground">
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
            <fieldset>
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
                  EF means ejection fraction, how well the heart pumps. It is often on an echo
                  report.
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
            <Nav next={() => go(1)} nextDisabled={!conditions.length} />
            {!conditions.length && (
              <p className="mt-2 text-right text-sm text-muted-foreground">
                Pick at least one to continue.
              </p>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="card-surface p-5 sm:p-6">
            <label htmlFor="meds" className="mb-1 block font-serif text-xl font-semibold">
              Current medicines
            </label>
            <p id="meds-hint" className="mb-3 text-sm text-muted-foreground">
              One per line. Any spelling is fine. Tap a name below to add it, or skip this step.
            </p>
            <textarea
              id="meds"
              aria-describedby="meds-hint"
              rows={5}
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              className="focus-ring w-full rounded-md border-2 border-input bg-card p-3"
            />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick add medicines">
              {CHIPS.map((m) => {
                const on = medList.some((x) => x.toLowerCase() === m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => addChip(m)}
                    className={`focus-ring rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-secondary-foreground hover:border-primary"}`}
                  >
                    {on ? "✓" : "+"} {m}
                  </button>
                );
              })}
            </div>
            <Nav back={() => go(0)} next={() => go(2)} />
          </section>
        )}

        {step === 2 && (
          <section className="card-surface p-5 sm:p-6">
            <h2 className="mb-1 font-serif text-xl font-semibold">Latest numbers</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              All optional. Use the most recent results you have, or check "Don't know."
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {NUMBERS.map((n) => (
                <div key={n.key}>
                  <label htmlFor={n.key} className="block font-bold">
                    {n.label}{" "}
                    <span className="text-sm font-normal text-muted-foreground">({n.hint})</span>
                  </label>
                  <input
                    id={n.key}
                    inputMode="decimal"
                    disabled={unknown[n.key]}
                    value={numbers[n.key] ?? ""}
                    onChange={(e) =>
                      setNumbers({ ...numbers, [n.key]: e.target.value.slice(0, 12) })
                    }
                    className="focus-ring mt-1 w-full rounded-md border-2 border-input bg-card p-2 disabled:opacity-50"
                  />
                  <label className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="focus-ring accent-primary"
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
              In your own words. Optional.
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
            <p className="text-right text-sm text-muted-foreground" aria-live="polite">
              {worry.length}/300
            </p>
            <Nav back={() => go(1)} next={generate} nextLabel="Make my questions" />
            <p className="mt-3 text-right text-sm text-muted-foreground">
              Your answers are sent once to make this page. Nothing is saved.
            </p>
          </section>
        )}

        {step === 3 && (
          <Brief
            loading={loading}
            result={result}
            answers={{ conditions, hfType, medList, numbers, unknown, worry }}
            ownQuestions={ownQuestions}
            setOwnQuestions={setOwnQuestions}
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
              href="https://github.com/saebchicago/navigateconditionmap"
              target="_blank"
              rel="noreferrer"
            >
              Open source on GitHub
            </a>{" "}
            (AGPL-3.0)
          </p>
          <p>
            Questions are ranked by NVIDIA Nemotron on Nebius Token Factory and checked in code.
            Sources: ADA/KDIGO 2022, ESC 2023 heart failure update, AHA/ACC/HFSA 2022 heart failure
            guideline, ADA Standards of Care 2026. Guideline cards updated {longDate(pack.version)}.
          </p>
          <p>No analytics, no cookies. Nothing you type is stored.</p>
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
          className="focus-ring rounded-md border-2 border-border px-5 py-2.5 font-bold hover:bg-muted"
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
        className="focus-ring rounded-md bg-primary px-6 py-2.5 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Loading() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 1400);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="card-surface p-6" aria-live="polite">
      <p className="font-serif text-lg font-semibold text-primary">
        {phase === 0
          ? "Matching your answers to the guideline cards..."
          : "Asking NVIDIA Nemotron which topics matter most for this visit..."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
    </section>
  );
}

function YouToldUs({ a }: { a: Answers }) {
  const conds = CONDITIONS.filter((c) => a.conditions.includes(c.key)).map((c) =>
    c.key === "heart_failure" && a.hfType && a.hfType !== "Not sure"
      ? `${c.label} (${a.hfType})`
      : c.label,
  );
  const nums = NUMBERS.flatMap((n) => {
    if (a.unknown[n.key]) return [`${n.label}: don't know`];
    const v = a.numbers[n.key]?.trim();
    return v ? [`${n.label} ${v}${n.unit}`] : [];
  });
  return (
    <section className="print-card mb-5 rounded-md border border-border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">What you told us</h2>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="font-bold">Conditions</dt>
        <dd>{conds.join(", ")}</dd>
        <dt className="font-bold">Medicines</dt>
        <dd>{a.medList.length ? a.medList.join(", ") : "None listed"}</dd>
        {nums.length > 0 && (
          <>
            <dt className="font-bold">Latest numbers</dt>
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
    </section>
  );
}

function Brief({
  loading,
  result,
  answers,
  ownQuestions,
  setOwnQuestions,
  onEdit,
}: {
  loading: boolean;
  result: Result | null;
  answers: Answers;
  ownQuestions: string;
  setOwnQuestions: (v: string) => void;
  onEdit: () => void;
}) {
  if (loading || !result) return <Loading />;

  const byId = new Map(CARDS.map((c) => [c.id, c]));
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section aria-live="polite" className="mt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Questions for the visit</h1>
          <p className="text-sm text-muted-foreground">Prepared {today}</p>
        </div>
        <div className="no-print flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring rounded-md border-2 border-border px-4 py-2 font-bold hover:bg-muted"
          >
            Edit answers
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="focus-ring rounded-md bg-accent px-4 py-2 font-bold text-accent-foreground hover:bg-accent/90"
          >
            Print for the visit
          </button>
        </div>
      </div>

      <YouToldUs a={answers} />

      {result.mode === "fallback" && (
        <p className="mb-4 rounded-md border-2 border-accent bg-accent/10 p-3 text-sm">
          <strong>The AI ranking wasn't available just now.</strong> These come straight from the
          guideline cards in their standard order. Every point is still sourced.
        </p>
      )}

      {result.points.length === 0 ? (
        <p className="card-surface p-5">
          None of the guideline cards match these answers yet. The cards cover heart failure, type 2
          diabetes, and kidney disease, and some depend on the medicines listed.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {result.points.map((p, i) => {
            const card = byId.get(p.card_id);
            if (!card) return null;
            const src = SOURCES[card.source];
            if (!src) return null;
            const supportingSources = [
              ...new Set(
                (p.supporting_card_ids ?? []).flatMap((id) => {
                  const supporting = byId.get(id);
                  return supporting && supporting.source !== card.source ? [supporting.source] : [];
                }),
              ),
            ];
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
                <p className="mt-2">{displayPoint(p.point, card.topic)}</p>
                <div className="mt-3 rounded-md border-l-4 border-accent bg-secondary p-4">
                  <p className="text-sm font-bold text-secondary-foreground">Ask the care team</p>
                  <p className="text-lg font-bold">“{card.question_for_clinician}”</p>
                  <div className="print-only mt-2 text-sm">
                    What they said:
                    <span className="print-line" />
                    <span className="print-line" />
                  </div>
                </div>
                <details className="no-print mt-3">
                  <summary className="focus-ring cursor-pointer font-bold text-primary">
                    What the guideline says
                  </summary>
                  <p className="mt-2 text-muted-foreground">{card.guideline_says}</p>
                </details>
                <p className="print-only mt-2 text-sm">
                  <strong>What the guideline says:</strong> {card.guideline_says}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Source:{" "}
                  <a
                    href={`https://doi.org/${src.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring font-bold text-primary underline underline-offset-2"
                  >
                    {sourceName(card.source)}
                  </a>{" "}
                  <span className="whitespace-nowrap">(doi:{src.doi})</span>
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
              </li>
            );
          })}
        </ol>
      )}

      <section className="card-surface print-card mt-4 p-5">
        <h2 className="font-serif text-xl font-semibold text-primary">Your own questions</h2>
        <label htmlFor="own" className="no-print mt-1 block text-sm text-muted-foreground">
          Anything else to ask? It stays in this tab and shows up on your printout.
        </label>
        <textarea
          id="own"
          rows={3}
          value={ownQuestions}
          onChange={(e) => setOwnQuestions(e.target.value.slice(0, 600))}
          className="no-print focus-ring mt-2 w-full rounded-md border-2 border-input bg-card p-3"
        />
        {ownQuestions.trim() && (
          <p className="print-only mt-2 whitespace-pre-line">{ownQuestions.trim()}</p>
        )}
        <div className="print-only mt-2">
          <span className="print-line" />
          <span className="print-line" />
          <span className="print-line" />
        </div>
      </section>

      <p className="mt-5 rounded-md border border-border bg-card p-3 text-sm font-bold">
        Educational information from published guidelines. Not medical advice. Decisions belong to
        you and your care team.
      </p>

      {result.points.length > 0 && (
        <details className="no-print card-surface mt-5 p-4">
          <summary className="focus-ring cursor-pointer font-bold text-primary">
            Why these questions?
          </summary>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {result.points.map((p) => (
              <li key={p.card_id}>
                <strong>{byId.get(p.card_id)?.topic}:</strong> {displayRationale(p.rationale)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="no-print mt-3 p-1 text-sm text-muted-foreground">
        <summary className="focus-ring cursor-pointer font-bold">How this page was made</summary>
        <p className="mt-2">
          Rules pick the guideline cards that fit your answers. NVIDIA Nemotron on Nebius Token
          Factory ranks them and writes a short explanation for each. Code then checks every
          explanation against its card. If the wording adds a number, medicine, dose, or safety
          claim the card doesn't make, the guideline's own wording is used instead.
        </p>
        <p className="mt-1">
          Model: {result.mode === "nemotron" ? result.model : "none (rule-based)"}
          {result.latency_ms != null && ` · ${(result.latency_ms / 1000).toFixed(1)} seconds`}
        </p>
      </details>

      <p className="print-only mt-4 text-xs">
        Made with Navigator by ConditionMap ({SITE.replace("https://", "")}). Educational only, not
        medical advice.
      </p>
    </section>
  );
}
