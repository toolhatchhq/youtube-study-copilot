# Changelog

## Unreleased

- Added founder-style repo contract and operating docs.
- Added GitHub issue templates, PR template, and CI workflow scaffolding.
- Added release, runbook, KPI, and analytics documentation for solo + AI operations.
- Added GitHub Pages source, build, and deploy workflow for public docs.
- Added a launch audit script and product setup guide for the live launch stack.
- Added shared telemetry plumbing for PostHog events and Sentry error reporting.
- Switched billing setup from Lemon Squeezy scaffolding to Polar hosted checkout and public license validation.
- Updated onboarding, launch docs, and public terms/privacy copy to match the live Polar flow.
- Tightened supported watch-page detection to canonical YouTube hosts and aligned manifest permissions with that scope.
- Made Polar license refresh and deactivation resilient to transient provider failures instead of clearing local Pro access immediately.
- Added activation rollback for failed local email or benefit checks and clearer transcript-load errors when captions are unreadable.
- Fixed the Pages generator to emit repo-scoped GitHub Pages links and ship a favicon asset for the public docs site.
- Hardened the launch audit to fail when generated Pages HTML contains internal links outside the configured GitHub Pages base path.
- Added `scripts/billing-smoke.mjs` as a repeatable pre-release gate for the live Polar checkout, portal, organization, and optional env-backed license lifecycle flow.
- Narrowed the launch profile to GitHub Pages plus issue-form support and removed unused telemetry permissions from the manifest for this release.
- Added YouTube caption-detection fallbacks so videos with valid caption tracks are less likely to be misreported as captionless.
- Moved transcript fetching onto the active YouTube page context and added JSON3/WebVTT transcript parsing for caption responses that are not plain XML.
- Updated transcript loading to prefer YouTube's default caption track and retry other available tracks before giving up on videos with empty caption payloads.
- Added explicit detection for YouTube consent/auth transcript blocks so restricted pages report the real blocker instead of a generic empty-caption error.
- Adjusted caption-track selection to prefer a manual English track over a translated default subtitle when both are available.

## 0.4.0 - 2026-03-26

- Added export actions, billing flow, onboarding pages, store docs, and product polish.

## 0.1.0 - 2026-03-25

- Created the initial YouTube Study Copilot scaffold and research package.
