import { hasStore, send } from "./_lib.js";

export default function handler(req, res) {
  send(res, 200, { ok: true, storage: hasStore(), admin: Boolean(process.env.ADMIN_PASSWORD) });
}
