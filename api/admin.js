// Admin API. Every call needs "Authorization: Bearer <ADMIN_PASSWORD>".
import { hasStore, redis, send, readBody, isAdmin, P, CODE_RE, ID_RE, clientIp, limited } from "./_lib.js";

export default async function handler(req, res) {
  if (!hasStore()) return send(res, 503, { error: "Database not connected" });
  if (!process.env.ADMIN_PASSWORD) return send(res, 503, { error: "Set ADMIN_PASSWORD in Vercel, then redeploy." });
  if (!isAdmin(req)) {
    if (await limited("a:" + clientIp(req), 20, 300)) return send(res, 429, { error: "Too many attempts. Wait five minutes." });
    return send(res, 401, { error: "Wrong password" });
  }

  if (req.method === "GET") {
    const [ids, refsFlat] = await redis([["ZREVRANGE", P + "sessions", 0, 4999], ["HGETALL", P + "refs"]]);
    const sessions = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const [vals] = await redis([["MGET", ...chunk.map(id => P + "s:" + id)]]);
      vals.forEach(v => { if (v) try { sessions.push(JSON.parse(v)); } catch {} });
    }
    const refs = [];
    for (let i = 0; i < (refsFlat || []).length; i += 2) {
      let r = {}; try { r = JSON.parse(refsFlat[i + 1]); } catch {}
      refs.push({ code: refsFlat[i], label: r.label || "", createdAt: r.createdAt || 0 });
    }
    return send(res, 200, { sessions, refs, mode: "api" });
  }

  if (req.method === "POST") {
    const b = readBody(req);
    if (b.action === "createRef") {
      const code = String(b.code || "").toUpperCase();
      if (!CODE_RE.test(code)) return send(res, 400, { error: "Codes are 2–24 characters: A–Z, 0–9 and hyphens." });
      await redis([["HSET", P + "refs", code, JSON.stringify({ label: String(b.label || "").slice(0, 80), createdAt: Date.now() })]]);
      return send(res, 200, { ok: true });
    }
    if (b.action === "deleteRef") {
      await redis([["HDEL", P + "refs", String(b.code || "")]]);
      return send(res, 200, { ok: true });
    }
    if (b.action === "deleteSession") {
      const id = String(b.id || "");
      if (!ID_RE.test(id)) return send(res, 400, { error: "Invalid id" });
      await redis([["DEL", P + "s:" + id], ["ZREM", P + "sessions", id]]);
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { error: "Unknown action" });
  }
  send(res, 405, { error: "Use GET or POST" });
}
