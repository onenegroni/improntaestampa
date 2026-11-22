Impronta Estampa - deploy (Cloudflare Workers static assets)
Live: https://improntaestampa.maize-haddock.workers.dev/

Rebuild + redeploy:
  cd /workspace/impronta && node build.js
  cd deploy && npx wrangler deploy            # after the account is claimed and `npx wrangler login` was done
  (before claiming: npx wrangler deploy --temporary  -> reuses the temporary account)

If the URL changes (custom domain improntaestampa.com.ar later), update og:image / og:url in src/index.html, rebuild, redeploy.

Update (Nov 22, 2026): the site is published in TWO places from the same site/ folder, both in Aldana's Cloudflare account (Maize Haddock):
  - Cloudflare Pages:   https://improntaestampa.pages.dev   (main URL; og:url/og:image point here)
  - Cloudflare Worker:  https://improntaestampa.maize-haddock.workers.dev
Redeploy both:  cd /workspace/impronta/deploy && CLOUDFLARE_ACCOUNT_ID=7a2452726f62a894f819097660e04275 bash ./deploy.sh
(CLOUDFLARE_API_TOKEN must be in the environment.)
