import { jsonResponse } from "./http.ts";

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return `${ip}:${auth.slice(-24)}`;
}

export function checkRateLimit(req: Request, options: RateLimitOptions): Response | null {
  const now = Date.now();
  const key = `${options.keyPrefix}:${getClientKey(req)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count <= options.limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return jsonResponse(
    { error: "Rate limit exceeded", retry_after_seconds: retryAfterSeconds },
    429,
  );
}
