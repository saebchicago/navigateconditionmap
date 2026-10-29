import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_BODY_BYTES,
  RATE_LIMIT,
  RATE_LIMIT_MESSAGE,
  RATE_WINDOW_MS,
  clientIp,
  createRateLimiter,
  readJsonBody,
} from "@/server/request-guards";
import { Route } from "@/routes/api/public/navigator-brief";

type Handler = (ctx: { request: Request }) => Promise<Response>;
const post = (Route.options as unknown as { server: { handlers: { POST: Handler } } }).server
  .handlers.POST;
const req = (body: string, ip = "203.0.113.1", headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/public/navigator-brief", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    body,
  });

describe("readJsonBody", () => {
  it("parses a body under the limit", async () => {
    expect(await readJsonBody(req('{"worry":"ok"}'))).toEqual({ ok: true, body: { worry: "ok" } });
  });
  it("rejects a body over 8 KB even without a content-length header", async () => {
    const big = JSON.stringify({ worry: "x".repeat(MAX_BODY_BYTES) });
    expect(await readJsonBody(req(big))).toEqual({
      ok: false,
      status: 413,
      error: "body_too_large",
    });
  });
  it("rejects a declared content-length over 8 KB before reading", async () => {
    expect(
      await readJsonBody(
        req("{}", "203.0.113.1", { "content-length": String(MAX_BODY_BYTES + 1) }),
      ),
    ).toEqual({ ok: false, status: 413, error: "body_too_large" });
  });
  it("rejects invalid JSON", async () => {
    expect(await readJsonBody(req("{not json"))).toEqual({
      ok: false,
      status: 400,
      error: "invalid_json",
    });
  });
});

describe("rate limiter", () => {
  it("allows 10 requests per IP per 10 minutes, then blocks until the window resets", () => {
    const limit = createRateLimiter();
    for (let i = 0; i < RATE_LIMIT; i++) expect(limit("a", 1000).allowed).toBe(true);
    expect(limit("a", 1000)).toEqual({ allowed: false, retryAfterSec: RATE_WINDOW_MS / 1000 });
    expect(limit("b", 1000).allowed).toBe(true);
    expect(limit("a", 1000 + RATE_WINDOW_MS).allowed).toBe(true);
  });
  it("reads the client IP from proxy headers", () => {
    expect(clientIp(req("{}", "198.51.100.7, 10.0.0.1"))).toBe("198.51.100.7");
    expect(
      clientIp(
        new Request("http://localhost", {
          headers: {
            "x-forwarded-for": "6.6.6.6",
            "x-real-ip": "198.51.100.8",
            "cf-connecting-ip": "192.0.2.9",
          },
        }),
      ),
    ).toBe("192.0.2.9");
    expect(
      clientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.8" },
        }),
      ),
    ).toBe("198.51.100.8");
    expect(
      clientIp(new Request("http://localhost", { headers: { "cf-connecting-ip": "192.0.2.9" } })),
    ).toBe("192.0.2.9");
    expect(clientIp(new Request("http://localhost"))).toBe("unknown");
  });
});

describe("navigator-brief route guards", () => {
  beforeEach(() => vi.stubEnv("NEBIUS_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("returns 413 for a body over 8 KB", async () => {
    const r = await post({
      request: req(JSON.stringify({ worry: "x".repeat(MAX_BODY_BYTES) }), "198.51.100.1"),
    });
    expect(r.status).toBe(413);
  });
  it("returns 400 for a JSON body that is not an object", async () => {
    expect((await post({ request: req("null", "198.51.100.2") })).status).toBe(400);
  });
  it("caps worry at 300 characters before it reaches the model", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "test-key");
    vi.stubEnv("NEBIUS_MODEL", "nvidia/nemotron-test");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })),
      );
    await post({
      request: req(
        JSON.stringify({
          conditions: ["type_2_diabetes"],
          medicines: [],
          numbers: {},
          worry: "w".repeat(1000),
        }),
        "198.51.100.3",
      ),
    });
    const sent = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as {
      messages: { content: string }[];
    };
    const user = JSON.parse(sent.messages[1]?.content ?? "{}") as {
      caregiver_inputs: { worry: string };
    };
    expect(user.caregiver_inputs.worry).toBe("w".repeat(300));
    fetchSpy.mockRestore();
  });
  it("returns 429 with a friendly message after 10 requests from one IP", async () => {
    const body = JSON.stringify({
      conditions: ["type_2_diabetes"],
      medicines: [],
      numbers: {},
      worry: "",
    });
    for (let i = 0; i < RATE_LIMIT; i++)
      expect((await post({ request: req(body, "198.51.100.4") })).status).toBe(200);
    const blocked = await post({ request: req(body, "198.51.100.4") });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await blocked.json()).toEqual({ error: "rate_limited", message: RATE_LIMIT_MESSAGE });
    expect((await post({ request: req(body, "198.51.100.5") })).status).toBe(200);
  });
});
