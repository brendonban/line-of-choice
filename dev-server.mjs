// Local preview with working API: `node dev-server.mjs` → http://localhost:3000
// Uses your real Upstash database if KV_REST_API_URL/TOKEN are set; otherwise an in-memory mock.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.ADMIN_PASSWORD ||= "admin";

if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  process.env.KV_REST_API_URL = "http://mock-redis.local"; process.env.KV_REST_API_TOKEN = "mock";
  const kv = new Map(), z = new Map(), h = new Map(), realFetch = globalThis.fetch;
  const run = ([cmd, ...a]) => {
    switch (cmd.toUpperCase()) {
      case "SET": kv.set(a[0], a[1]); return "OK";
      case "GET": return kv.get(a[0]) ?? null;
      case "MGET": return a.map(k => kv.get(k) ?? null);
      case "DEL": return +kv.delete(a[0]);
      case "INCR": { const v = (+kv.get(a[0]) || 0) + 1; kv.set(a[0], String(v)); return v; }
      case "EXPIRE": return 1;
      case "ZADD": { const nx = a[1] === "NX"; const [score, m] = nx ? [a[2], a[3]] : [a[1], a[2]]; const s = z.get(a[0]) || new Map(); if (nx && s.has(m)) return 0; s.set(m, +score); z.set(a[0], s); return 1; }
      case "ZREVRANGE": return [...(z.get(a[0]) || new Map())].sort((x, y) => y[1] - x[1]).slice(+a[1], +a[2] + 1).map(x => x[0]);
      case "ZREM": return +((z.get(a[0]) || new Map()).delete(a[1]));
      case "HSET": { const m = h.get(a[0]) || new Map(); m.set(a[1], a[2]); h.set(a[0], m); return 1; }
      case "HGET": return (h.get(a[0]) || new Map()).get(a[1]) ?? null;
      case "HEXISTS": return +((h.get(a[0]) || new Map()).has(a[1]));
      case "HDEL": return +((h.get(a[0]) || new Map()).delete(a[1]));
      case "HGETALL": return [...(h.get(a[0]) || new Map())].flat();
      default: throw new Error("mock: unsupported " + cmd);
    }
  };
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("http://mock-redis.local")) {
      const cmds = JSON.parse(opts.body);
      return new Response(JSON.stringify(cmds.map(c => { try { return { result: run(c) }; } catch (e) { return { error: e.message }; } })), { status: 200 });
    }
    return realFetch(url, opts);
  };
  console.log("Using in-memory database (data resets when the server stops). Admin password: " + process.env.ADMIN_PASSWORD);
}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    const name = u.pathname.slice(5).replace(/[^a-z]/g, "");
    const file = path.join(root, "api", name + ".js");
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("{}"); }
    let body = ""; for await (const c of req) body += c;
    req.query = Object.fromEntries(u.searchParams); req.body = body ? JSON.parse(body) : {};
    try { (await import(file)).default(req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  let p = path.join(root, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream");
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
