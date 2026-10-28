# Line of Choice

**choice.ruangmalaysia.org** — a short game about personal responsibility for young adults in Malaysia, with a check-in and check-out survey, referral codes, and an admin console.
A game by the Emotional Health Project (eh.ruangmalaysia.org). Run by Ruang Malaysia. This is its own site, separate from the Emotional Health Project site.

| Page | What it is |
|---|---|
| `/` | The site: home (drag the dot above the line), how it works, the game, support |
| `/#play` | The game flow: referral code → check-in → play → check-out → results and invite link |
| `/admin` | Admin console (password protected) |
| `/gallery` | Prototype gallery: every screen on phone and desktop with sample answers |

No build step. Plain HTML, CSS and JS, plus four small Vercel functions in `api/`.

## Deploy

1. **GitHub** — `gh repo create line-of-choice --public --source=. --push` (or `./deploy.sh`).
2. **Vercel** — import the repo at https://vercel.com/new. Framework preset: **Other**. No build command.
3. **Database** — in the Vercel project: **Storage → Create Database → Upstash for Redis** (free tier is plenty), and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. **Admin password** — **Settings → Environment Variables** → add `ADMIN_PASSWORD`.
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables load.
6. **Domain** — **Settings → Domains** → add `choice.ruangmalaysia.org`. Vercel shows a CNAME record for `choice`; add it wherever ruangmalaysia.org's DNS is managed. HTTPS is issued automatically once DNS resolves.

Open `/admin`, sign in, and create your first referral code. Until the database is connected, the site still works but each player's data stays in their own browser, and the admin console says so.

## Referral codes

- Create codes in the admin console (e.g. `UM-NOV` for a workshop). Share `https://choice.ruangmalaysia.org/?ref=UM-NOV#play`, or players type the code in.
- Every player gets their own share code on the results screen. Friends who arrive through it are counted under **Friend invites**.

## What is stored

One record per session, with no names or contact details: referral code, age range, device type, check-in and check-out (mood out of 10, four 1–5 statements, an optional sentence, a 0–10 recommend score), and each run (XP, level, time above the line, and each trigger choice with whether it was above the line, whether time ran out, and decision time). Admins can delete sessions and export CSV.

## Run locally

```bash
node dev-server.mjs      # http://localhost:3000 · in-memory database · admin password "admin"
```
Set `KV_REST_API_URL`, `KV_REST_API_TOKEN` and `ADMIN_PASSWORD` first to use a real database.

## Editing content

Scenarios, levels, survey statements and age ranges live in `assets/content.js`. Keep scenario ids (`s01`…) stable: stored data refers to them. The game area's look lives in `assets/game.css` and the drawing code in `assets/game.js`; the rest of the site uses `assets/styles.css`. Helpline numbers are in `index.html` (support page, check-in care note and the “Need to talk now?” sheet).
