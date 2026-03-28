# Current Priorities

Updated: March 28, 2026

## Top 3 Priorities

1. Run the first end-to-end Polar paid-license test using the live checkout and real organization ID.
2. Set the live PostHog, Sentry, and Help Scout values that still cannot be inferred locally.
3. Run launch QA against the live GitHub Pages site and prepare the Chrome Web Store submission.

## Current Blockers

- Optional `benefitId` is still blank, so the extension is not yet locked to a single Polar benefit. This is acceptable for launch unless you want stricter entitlement matching.
- Sentry, PostHog, and Help Scout are wired structurally but not configured with live credentials.
- Paid-license QA has not yet been run against the live Polar checkout flow.

## Release Target

- April 2026 Chrome Web Store launch candidate
