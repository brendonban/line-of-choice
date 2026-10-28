// Players save their session here (no sign-in). Input is validated and trimmed before storing.
import { hasStore, redis, send, readBody, P, CODE_RE, ID_RE, clientIp, limited } from "./_lib.js";

const ITEM_KEYS = ["notice", "pause", "own", "help"];
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);

function items(o) { const r = {}; ITEM_KEYS.forEach(k => (r[k] = int(o && o[k], 1, 5))); return r; }
function survey(s, post) {
  if (!s || typeof s !== "object") return null;
  const out = { mood: int(s.mood, 1, 10), items: items(s.items), at: num(s.at, 0, 4e12) };
  if (post) { out.rec = int(s.rec, 0, 10); out.choose = str(s.choose, 600); }
  return out.mood == null ? null : out;
}
function run(r) {
  return {
    at: num(r.at, 0, 4e12), xp: Math.round(num(r.xp, 0, 1e7)), level: int(r.level, 1, 5) || 5,
    durationS: Math.round(num(r.durationS, 0, 36000)), aboveRatio: num(r.aboveRatio, 0, 1),
    hits: Math.round(num(r.hits, 0, 9999)), orbs: Math.round(num(r.orbs, 0, 9999)), flows: Math.round(num(r.flows, 0, 9999)),
    observes: Math.round(num(r.observes, 0, 9999)), bestStreak: Math.round(num(r.bestStreak, 0, 9999)),
    choices: (Array.isArray(r.choices) ? r.choices.slice(0, 300) : []).map(c => ({
      s: str(c && c.s, 8), good: Boolean(c && c.good), timedOut: Boolean(c && c.timedOut), ms: Math.round(num(c && c.ms, 0, 60000)),
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!hasStore()) return send(res, 503, { error: "Database not connected" });
  const s = readBody(req).session;
  if (!s || !ID_RE.test(s.id || "")) return send(res, 400, { error: "Invalid session" });
  if (await limited("s:" + clientIp(req), 120, 60)) return send(res, 429, { error: "Too many saves. Try again in a minute." });

  const now = Date.now();
  const ref = typeof s.ref === "string" ? s.ref.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) : "";
  const share = CODE_RE.test(s.shareCode || "") ? s.shareCode : "";
  const clean = {
    id: s.id, v: 1, createdAt: Math.min(num(s.createdAt, 0, 4e12) || now, now), updatedAt: now,
    ref, shareCode: share, age: str(s.age, 24), consent: Boolean(s.consent), device: str(s.device, 12),
    pre: survey(s.pre, false), post: survey(s.post, true),
    runs: (Array.isArray(s.runs) ? s.runs.slice(-50) : []).filter(r => r && typeof r === "object").map(run),
  };
  const json = JSON.stringify(clean);
  if (json.length > 200000) return send(res, 413, { error: "Session too large" });

  const cmds = [["SET", P + "s:" + clean.id, json], ["ZADD", P + "sessions", "NX", clean.createdAt, clean.id]];
  if (share) cmds.push(["HSET", P + "share", share, clean.id]);
  await redis(cmds);
  send(res, 200, { ok: true });
}
