import { createFileRoute } from "@tanstack/react-router";
import { EVIDENCE_PACK } from "@/server/evidence-pack";
import { MAX_WORRY_CHARS, RATE_LIMIT_MESSAGE, clientIp, createRateLimiter, readJsonBody } from "@/server/request-guards";
import { filterEligible, fallbackPoints, validateModelOutput, sanitizeHfType, type BriefInput, type Card } from "@/lib/navigator";

// Public endpoint: no auth, stores nothing, returns only evidence-pack derived content.
const BASE = "https://api.tokenfactory.nebius.com/v1";
let cachedModel: string | null = null;
let cachedList: string[] = [];
const rateLimit = createRateLimiter();

const NUMBER_KEYS = ["egfr", "uacr", "a1c", "bp", "potassium"] as const;
/** Keep only the known lab fields, as short strings, so the prompt cannot be padded through this object. */
function sanitizeNumbers(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of NUMBER_KEYS) if (typeof src[k] === "string" || typeof src[k] === "number") out[k] = String(src[k]).slice(0, 20);
  return out;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

async function selectModel(key: string): Promise<string> {
  if (process.env["NEBIUS_MODEL"]) return process.env["NEBIUS_MODEL"];
  if (cachedModel) return cachedModel;
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`models_list_failed_${r.status}`);
  const data = (await r.json()) as { data?: { id: string }[] };
  cachedList = (data.data ?? []).map((m) => m.id).filter((id) => /nemotron/i.test(id));
  const pick = cachedList.find((id) => /super/i.test(id)) ?? cachedList.find((id) => /nano/i.test(id)) ?? cachedList[0];
  if (!pick) throw new Error("no_nemotron_model");
  cachedModel = pick;
  return pick;
}

function buildPrompt(input: BriefInput, eligible: Card[]) {
  const cards = eligible.map(({ id, topic, guideline_says }) => ({ id, topic, guideline_says }));
  const system = `You help family caregivers prepare questions for a clinician visit. You only use the evidence cards given. Rules:
- Rank all eligible card IDs in relevance order, each once. The brief will use up to 3 distinct discussion topics. E2, E3, E9, and E11 are one medicine class (SGLT2 inhibitors); E6 and E10 are another (nonsteroidal MRA). Keep at most one card from each class in the first 3 and rank other topics next.
- Heart failure type selected by the caregiver: ${input.hfType || "not given"}. If it is reduced EF, prefer E9 over E3; if mildly reduced or preserved EF, prefer E3 over E9.
- For each: "point" must be a short plain-language STATEMENT explaining why this topic matters for this situation, never a question (the question is shown separately). Use a 6th-8th grade reading level. "rationale" = one sentence on why it ranks here. Do not return a question field; the app uses the evidence card's question verbatim.
- Each point may use facts ONLY from that selected card's guideline_says. Do not restate, compare, or judge the caregiver's own numbers or medicines (no "above target", "too high"); the app shows those separately. Never borrow facts from another card. Do not infer the presence OR absence of unselected conditions. Do not invent numbers or medicine/class terms.
- Never assume relationships or gender. No mom, mother, dad, father, wife, husband, her, his, him, she, he, we, i, my, me, mine, our, us, your, or yours. Say "the person you care for" or "they". Use a neutral, calm tone. Apply these rules to rationale too.
- Restate only what the card says. Do not add benefits, symptoms, outcomes, or reasons that are not in the card's guideline_says. Do not make a recommendation sound stronger than the card (no "required" or "must" unless the card says so).
- Never mention card IDs such as E1 in point or rationale; name the topic instead.
- Do not add drugs, doses, numbers, or claims not in the card. Never tell anyone to start, stop, or change a medicine. Explain why the topic matters without giving treatment instructions.
- Return exactly one JSON object with a "points" array. No markdown, <think> blocks, reasoning text, or text outside the JSON. Every entry must include an eligible card_id. Use this exact structure: {"points":[{"card_id":"E2","point":"...","rationale":"..."}]}`;
  const user = JSON.stringify({ caregiver_inputs: input, eligible_cards: cards });
  return { system, user };
}

export const Route = createFileRoute("/api/public/navigator-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limit = rateLimit(clientIp(request));
        if (!limit.allowed) return json({ error: "rate_limited", message: RATE_LIMIT_MESSAGE }, 429, { "retry-after": String(limit.retryAfterSec) });
        const parsed = await readJsonBody(request);
        if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
        if (typeof parsed.body !== "object" || parsed.body === null) return json({ error: "invalid_json" }, 400);
        const body = parsed.body as { health?: unknown; conditions?: unknown; hfType?: unknown; medicines?: unknown; numbers?: unknown; worry?: unknown };
        const key = process.env["NEBIUS_API_KEY"];

        if (body.health) {
          if (!key) return json({ ok: false, error: "missing_api_key" });
          try {
            const model = await selectModel(key);
            return json({ ok: true, model, nemotron_models: cachedList, model_from_env: !!process.env["NEBIUS_MODEL"] });
          } catch (e) {
            return json({ ok: false, error: (e as Error).message });
          }
        }

        const input: BriefInput = {
          conditions: (Array.isArray(body.conditions) ? body.conditions : []).map(String).slice(0, 3) as BriefInput["conditions"],
          hfType: sanitizeHfType(body.hfType),
          medicines: (Array.isArray(body.medicines) ? body.medicines : []).map((m) => String(m).slice(0, 80)).slice(0, 30),
          numbers: sanitizeNumbers(body.numbers),
          worry: typeof body.worry === "string" ? body.worry.slice(0, MAX_WORRY_CHARS) : "",
        };
        const eligible = filterEligible(EVIDENCE_PACK.cards as unknown as Card[], input.conditions, input.medicines);
        const eligible_ids = eligible.map((c) => c.id);
        if (!eligible.length) return json({ points: [], mode: "fallback", eligible_ids });
        const fallback = (error: string, extra: Record<string, unknown> = {}) =>
          json({ points: fallbackPoints(eligible, input.hfType), mode: "fallback", error, eligible_ids, ...extra });
        if (!key) return fallback("missing_api_key");

        const t0 = Date.now();
        try {
          const model = await selectModel(key);
          const { system, user } = buildPrompt(input, eligible);
          const r = await fetch(`${BASE}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify({
              model, temperature: 0, max_tokens: 2400,
              response_format: { type: "json_object" },
              ...(/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
              messages: [{ role: "system", content: system }, { role: "user", content: user }],
            }),
            signal: AbortSignal.timeout(20000),
          });
          const latency_ms = Date.now() - t0;
          if (!r.ok) return fallback(`model_http_${r.status}`, { model, latency_ms });
          const data = (await r.json()) as { model?: string; choices?: { message?: { content?: string } }[] };
          const used = data.model ?? model;
          const points = validateModelOutput(data.choices?.[0]?.message?.content ?? "", eligible, input);
          if (!points) return fallback("model_output_invalid", { model: used, latency_ms });
          return json({ points, mode: "nemotron", model: used, latency_ms, eligible_ids });
        } catch (e) {
          const msg = (e as Error).name === "TimeoutError" ? "model_timeout" : "model_request_failed";
          return fallback(msg, { latency_ms: Date.now() - t0 });
        }
      },
    },
  },
});
