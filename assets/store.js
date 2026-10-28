/* Storage adapter.
   "api"   — deployed on Vercel with a database connected: everything goes to /api/*.
   "local" — no database (opened as a file, a preview, or before setup): data stays in this browser,
             so the site and admin console still work for demos. */
window.Store = (() => {
  let mode = null, health = null;
  const LKEY = "ehp_local_db";

  function ldb() {
    try { return JSON.parse(localStorage.getItem(LKEY)) || { sessions: {}, refs: {} }; }
    catch (e) { return { sessions: {}, refs: {} }; }
  }
  function lsave(db) { try { localStorage.setItem(LKEY, JSON.stringify(db)); } catch (e) {} }

  async function detect() {
    if (mode) return mode;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch("/api/health", { cache: "no-store", signal: ctl.signal });
      clearTimeout(t);
      health = await r.json();
      mode = health && health.ok && health.storage ? "api" : "local";
    } catch (e) { health = { ok: false, storage: false }; mode = "local"; }
    return mode;
  }

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((j && j.error) || ("Request failed (" + r.status + ")")); err.status = r.status; throw err; }
    return j;
  }

  return {
    detect, get mode() { return mode; }, get health() { return health; },

    async saveSession(s) {
      if (window.EHP_DEMO) return true;
      await detect();
      s.updatedAt = Date.now();
      if (mode === "api") {
        try { await api("/api/session", { method: "POST", body: JSON.stringify({ session: s }) }); return true; }
        catch (e) { console.warn("Could not save session", e); return false; }
      }
      const db = ldb(); db.sessions[s.id] = s; lsave(db); return true;
    },

    async checkRef(code) {
      await detect();
      if (!code) return { valid: false };
      if (mode === "api") { try { return await api("/api/ref?code=" + encodeURIComponent(code)); } catch (e) { return { valid: false }; } }
      const db = ldb();
      if (db.refs[code]) return { valid: true, kind: "code", label: db.refs[code].label };
      if (Object.values(db.sessions).some(s => s.shareCode === code)) return { valid: true, kind: "friend" };
      return { valid: false };
    },

    /* admin */
    async adminLoad(pw) {
      await detect();
      if (mode === "api") return api("/api/admin", { headers: { Authorization: "Bearer " + pw } });
      const db = ldb();
      return { sessions: Object.values(db.sessions), refs: Object.entries(db.refs).map(([code, v]) => ({ code, ...v })), mode: "local" };
    },
    async adminAction(pw, body) {
      await detect();
      if (mode === "api") return api("/api/admin", { method: "POST", headers: { Authorization: "Bearer " + pw }, body: JSON.stringify(body) });
      const db = ldb();
      if (body.action === "createRef") db.refs[body.code] = { label: body.label || "", createdAt: Date.now() };
      if (body.action === "deleteRef") delete db.refs[body.code];
      if (body.action === "deleteSession") delete db.sessions[body.id];
      lsave(db); return { ok: true };
    },
  };
})();
