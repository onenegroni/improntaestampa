#!/usr/bin/env bash
# Redeploy site/ to Aldana's Cloudflare worker "improntaestampa" (non-interactive).
# Needs: CLOUDFLARE_API_TOKEN (template "Edit Cloudflare Workers") and CLOUDFLARE_ACCOUNT_ID.
# Usage: CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"; : "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
(cd .. && node build.js)
npx --yes wrangler@4.166.0 whoami
npx --yes wrangler@4.166.0 deploy   # worker: https://improntaestampa.maize-haddock.workers.dev (never --temporary)
npx --yes wrangler@4.166.0 pages deploy ../site --project-name improntaestampa --branch main --commit-dirty=true   # https://improntaestampa.pages.dev
