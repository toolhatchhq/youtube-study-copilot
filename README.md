# YouTube Study Copilot

Chrome side-panel MVP that turns captioned YouTube videos into study notes, flashcards, quizzes, exports, and saved review packs.

This repo now follows the shared Founder OS contract so it is understandable and maintainable in VS Code and AI coding tools without a separate project-management system.

## What This MVP Now Includes

- transcript loading from YouTube caption tracks
- study-pack generation with Chrome Prompt API when available
- heuristic fallback generation when built-in AI is unavailable
- local saved-pack library with free-plan archive limits
- Markdown export on the free plan
- CSV, JSON, and transcript export gates for Pro
- first-run onboarding page opened on install
- Polar hosted checkout plus public license activation, refresh, and deactivation flow
- local privacy and support pages
- GitHub Pages source files and deployment workflow for public support, privacy, terms, and changelog pages
- shared telemetry plumbing for PostHog events and Sentry error reporting
- Chrome Web Store listing and release docs in `store/`

## Billing Setup

Edit `config.js` before publishing:

- `APP_CONFIG.billing.checkoutUrl`
- `APP_CONFIG.billing.organizationId`
- `APP_CONFIG.billing.benefitId` if you want to lock Pro to a single Polar benefit
- `APP_CONFIG.billing.billingPortalUrl` if you have a customer portal
- `APP_CONFIG.supportUrl` if you want a different support destination than the GitHub Pages default
- `APP_CONFIG.supportEmail` later if you add Help Scout or direct email support
- `APP_CONFIG.privacyPolicyUrl` if you are not using the GitHub Pages default
- `APP_CONFIG.termsUrl` if you are not using the GitHub Pages default

Detailed step-by-step setup is in `BILLING_SETUP.md`.

Until those fields are configured, the extension stays fully usable in free mode and shows clear setup messaging for Pro billing.

## Launch Ops

This repo now includes:

- `site-src/` for public Pages content
- `scripts/build-pages.mjs` to build the public docs site
- `scripts/launch-audit.mjs` to surface missing files and unresolved launch placeholders
- `.github/workflows/deploy-pages.yml` for GitHub Pages publishing
- `telemetry.js` as the shared event and error-reporting interface

Fastest launch path:

- keep the GitHub Pages URLs already wired in `config.js`
- publish the Pages site before buying a custom domain
- use the GitHub issue form linked from `/support/` as the temporary customer intake path

## Plan Design

Free:

- build study packs
- save the latest 5 packs locally
- export Markdown

Pro:

- export flashcards as CSV
- export full packs as JSON
- export transcript text after loading captions
- save the latest 50 packs locally

## Store Assets And Docs

- `store/STORE_LISTING.md`
- `store/PRIVACY_POLICY.md`
- `store/RELEASE_CHECKLIST.md`
- `LAUNCH_STACK_SETUP.md`
- `welcome.html`
- `privacy.html`
- `support.html`

## Operating Docs

- `AGENTS.md`
- `CURRENT_PRIORITIES.md`
- `docs/spec.md`
- `docs/roadmap.md`
- `docs/decisions.md`
- `ops/runbook.md`
- `ops/release-checklist.md`
- `analytics/events.md`
- `business/kpis.md`
- `CHANGELOG.md`

## Research Docs

- `research/source-log.md`
- `research/opportunity-brief.md`
- `research/competitor-matrix.md`
- `research/policy-risk.md`
- `research/ai-stack.md`
- `research/unit-economics.md`
- `research/go-no-go.md`

## Load In Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select this folder

## Key Files

- `manifest.json`
- `config.js`
- `telemetry.js`
- `background.js`
- `sidepanel.html`
- `sidepanel.css`
- `sidepanel.js`
- `welcome.html`
- `welcome.js`
- `page.css`
- `site-src/`
- `scripts/build-pages.mjs`
