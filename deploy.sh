#!/usr/bin/env bash
# Creates the GitHub repo and deploys to Vercel. Needs: git, gh (run `gh auth login` once), node.
set -euo pipefail
cd "$(dirname "$0")"
NAME="${1:-line-of-choice}"
[ -d .git ] || { git init -q -b main; git add .; git commit -qm "Line of Choice: site, game, surveys, referral codes, admin console"; }
gh repo create "$NAME" --public --source=. --push
npx --yes vercel@latest --prod --yes
cat <<MSG

Deployed. Two steps left in the Vercel dashboard (project → Storage / Settings):
  1. Storage → Create Database → Upstash for Redis → connect to this project
  2. Settings → Environment Variables → ADMIN_PASSWORD
Then redeploy, open /admin and sign in.
MSG
