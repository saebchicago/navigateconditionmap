// Request guards for the public brief endpoint: body size cap and a simple in-memory per-IP rate limit.
export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_WORRY_CHARS = 300;
export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MESSAGE =
  "You have made several briefs in a short time. Please wait a few minutes and try again.";

export type BodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; error: "invalid_json" | "body_too_large" };

/** Reads at most maxBytes of the request body, then parses JSON. */
export async function readJsonBody(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<BodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes)
    return { ok: false, status: 413, error: "body_too_large" };
  if (!request.body) return { ok: false, status: 400, error: "invalid_json" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, error: "body_too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

/** First client IP from common proxy headers; "unknown" when none is present. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ??
    forwarded ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Fixed-window counter per key. Per server instance, so it is a speed bump, not a hard quota. */
export function createRateLimiter(limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } => {
    if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return { allowed: true, retryAfterSec: 0 };
    }
    entry.count += 1;
    if (entry.count <= limit) return { allowed: true, retryAfterSec: 0 };
    return { allowed: false, retryAfterSec: Math.ceil((entry.start + windowMs - now) / 1000) };
  };
}
