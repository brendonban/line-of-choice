// Shared helpers for the Vercel functions. Files starting with "_" are not routes.
import crypto from "node:crypto";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const P = "ehp:"; // key prefix

export const hasStore = () => Boolean(URL_ && TOKEN);

/** Run Redis commands through Upstash's REST pipeline. Returns an array of results. */
export async function redis(cmds) {
  const r = await fetch(URL_.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`Database error (${r.status})`);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

export function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) return false;
  const h = req.headers.authorization || "";
  const got = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export const CODE_RE = /^[A-Z0-9-]{2,24}$/;
export const ID_RE = /^[a-z0-9]{8,32}$/;

export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

/** Simple fixed-window rate limit. Returns true when the caller is over the limit. */
export async function limited(key, max, windowS) {
  const [n] = await redis([["INCR", P + "rl:" + key], ["EXPIRE", P + "rl:" + key, windowS, "NX"]]);
  return n > max;
}
