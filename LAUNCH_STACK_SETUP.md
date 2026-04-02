# Launch Stack Setup

Use this sequence to turn the local MVP into a live launch candidate.

## 1. GitHub

1. Create a GitHub organization for the brand.
2. Publish `founder-os` as a private repo.
3. Publish `youtube-study-copilot` as a public repo before enabling GitHub Pages on GitHub Free.
4. Apply labels from `founder-os/github/labels.json`.
5. Create the `Portfolio` project with the states from `founder-os/github/project-states.json`.
6. Enable branch protection on `main` with required checks and no required reviewer count.

## 2. GitHub Pages

1. For the fastest no-domain launch, keep the GitHub Pages URLs already set in `config.js` and `site-src/site.json`, or replace only the org slug if you pick a different GitHub organization.
2. Run `node scripts/build-pages.mjs`.
3. Enable the `Deploy Pages` workflow.
4. Confirm these URLs resolve:
   - `/support/`
   - `/privacy/`
   - `/terms/`
   - `/changelog/`

## 3. Polar

1. Follow `BILLING_SETUP.md`.
2. Paste the live `organizationId` into `config.js`.
3. If you want stricter entitlement matching, paste the Polar `benefitId` into `config.js`.
4. Keep the hosted checkout link and billing portal URL current in `config.js`.
5. Keep `requireEmailMatch: true`.
6. Run `node scripts/billing-smoke.mjs`.
7. Optional: set `POLAR_TEST_LICENSE_EMAIL` and `POLAR_TEST_LICENSE_KEY`, then rerun `node scripts/billing-smoke.mjs` to exercise live activation, validation, and device deactivation.

## 4. Telemetry

1. The current launch profile ships with telemetry disabled.
2. If you later enable PostHog, add the manifest permissions back, copy the project API key into `APP_CONFIG.integrations.posthog.apiKey`, and verify the baseline events in `analytics/events.md`.
3. If you later enable Sentry, add the manifest permissions back, copy the browser DSN into `APP_CONFIG.integrations.sentry.dsn`, and verify the required release tags and alerts.

## 5. Help Scout

1. Help Scout is optional for a later release.
2. Until then, keep the GitHub Pages support URL as the public listing link and use the GitHub issue form linked from that page as the intake path.
3. If you later enable Help Scout, update `APP_CONFIG.integrations.helpScout.supportEmail` and `APP_CONFIG.supportEmail`.

## 6. Final Gate

1. Run `node scripts/launch-audit.mjs --strict`.
2. Run `node scripts/billing-smoke.mjs`.
3. Run the VS Code tasks for repo contract, JS checks, Pages build, and launch audit.
4. Confirm the Chrome Web Store listing links use the public Pages URLs.
5. Update `CHANGELOG.md` and `CURRENT_PRIORITIES.md` with the launch state.
