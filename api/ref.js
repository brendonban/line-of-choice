// Check a referral code: one created by an admin, or another player's share code.
import { hasStore, redis, send, P, CODE_RE } from "./_lib.js";

export default async function handler(req, res) {
  const code = String((req.query && req.query.code) || "").toUpperCase();
  if (!CODE_RE.test(code) || !hasStore()) return send(res, 200, { valid: false });
  const [ref, friend] = await redis([["HGET", P + "refs", code], ["HEXISTS", P + "share", code]]);
  if (ref) { let r = {}; try { r = JSON.parse(ref); } catch {} return send(res, 200, { valid: true, kind: "code", label: r.label || "" }); }
  if (friend) return send(res, 200, { valid: true, kind: "friend" });
  send(res, 200, { valid: false });
}
