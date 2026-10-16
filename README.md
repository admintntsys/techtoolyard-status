# TechToolYard™ status

Public status page for the TechToolYard apps, hosted on GitHub Pages so it stays up when Cloudflare (which hosts the apps and DNS) is down.

- Page: https://admintntsys.github.io/techtoolyard-status/
- Data: https://admintntsys.github.io/techtoolyard-status/status.json (CORS-open, read by the in-app banners)

## How it works

- `.github/workflows/check.yml` runs every 5 minutes (GitHub's minimum; scheduled runs can be delayed). It runs `scripts/check.mjs`, which:
  - GETs each app's health URL (`https://<app>.techtoolyard.com/api/health`, and `https://techtoolyard.com/`). An app shows "Not responding" only after 2 failed checks in a row; over 8 s is "Responding slowly".
  - Reads Cloudflare (`cloudflarestatus.com/api/v2/status.json`) and Stripe (`status.stripe.com/current`) public status and repeats what they say, with a link to their status page.
  - Writes `status.json` and appends status changes to `history.json` (last 500). It commits only when something changed, plus a heartbeat every 30 minutes, to keep the repo small.
- Apps and providers are listed in `config.json`. No dependencies; Node 20 built-ins only. Tests: `node --test test/`.
- Free tier only: public repo, Actions minutes are free for public repos, Pages from the `main` branch root.
- GitHub disables scheduled workflows after 60 days with no repo activity; the heartbeat commits keep it active. If it ever stops, re-enable it under Actions.

## LEGAL rules (enforced by tests where possible)

- No uptime percentages or guarantees.
- Provider issues are stated as facts ("Cloudflare says: …") with a link to that provider's status page.
- Nothing about data or security incidents is ever posted automatically. The checker only reports whether apps respond.
- Manual notes go in `INCIDENTS.md` (template inside). Anything that might involve someone's data goes to LEGAL first and is never posted here.

## Custom domain (not set up yet)

Our Cloudflare token can't edit DNS. To serve this at `status.techtoolyard.com` later:

1. In Cloudflare DNS for techtoolyard.com add `CNAME status → admintntsys.github.io`, **DNS only (grey cloud)**, so the page doesn't depend on the Cloudflare proxy.
2. Repo Settings → Pages → Custom domain: `status.techtoolyard.com`, then tick Enforce HTTPS. (This adds a `CNAME` file containing `status.techtoolyard.com`.)
3. Keep the `admintntsys.github.io/techtoolyard-status` address linked in the app footers as the backup, because DNS itself is on Cloudflare.

## License

MIT
