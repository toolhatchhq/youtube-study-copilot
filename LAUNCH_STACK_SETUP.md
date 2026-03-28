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
6. Run one test purchase, activation, refresh, and device deactivation before release.

## 4. PostHog

1. Create a PostHog project named `youtube-study-copilot`.
2. Copy the project API key into `APP_CONFIG.integrations.posthog.apiKey`.
3. Keep `apiHost` as `https://us.i.posthog.com` unless you are using EU or self-hosted PostHog.
4. Set `enabled: true`.
5. Verify these events: `install`, `onboarding_started`, `onboarding_completed`, `paywall_viewed`, `checkout_started`, `license_activated`, `core_action_completed`, `export_used`, `error_shown`.

## 5. Sentry

1. Create a Sentry project named `youtube-study-copilot`.
2. Copy the browser DSN into `APP_CONFIG.integrations.sentry.dsn`.
3. Set `enabled: true`.
4. Create alerts for:
   - new error spike
   - high-frequency error
   - release regression
5. Confirm tags include `product`, `version`, `environment`, `release_channel`, and `user_tier`.

## 6. Help Scout

1. Create one shared mailbox for the portfolio.
2. Add a `study-copilot` tag or view.
3. Update `APP_CONFIG.integrations.helpScout.supportEmail` and `APP_CONFIG.supportEmail`.
4. Create saved replies for refunds, activation issues, missing captions, and billing confusion.
5. If Help Scout is not live yet, keep the GitHub Pages support URL as the public listing link and use the GitHub issue form linked from that page as the temporary intake path.

## 7. Final Gate

1. Run `node scripts/launch-audit.mjs --strict`.
2. Run the VS Code tasks for repo contract, JS checks, Pages build, and launch audit.
3. Confirm the Chrome Web Store listing links use the public Pages URLs.
4. Update `CHANGELOG.md` and `CURRENT_PRIORITIES.md` with the launch state.
