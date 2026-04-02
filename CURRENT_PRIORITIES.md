# Current Priorities

Updated: April 2, 2026

## Top 3 Priorities

1. Run `node scripts/billing-smoke.mjs` with `POLAR_TEST_LICENSE_EMAIL` plus `POLAR_TEST_LICENSE_KEY` from a real test purchase so the live activate/validate/deactivate path is verified end to end.
2. Capture final Chrome Web Store screenshots and submit the launch candidate.
3. Monitor the first live customer activations and support requests after publish to confirm the launch profile behaves as expected.

## Current Blockers

- One real purchase-backed end-to-end Pro flow still needs a human test identity so the live activate/validate/deactivate path is verified with production data.
- Chrome Web Store submission QA and final screenshots still need a pass against the current launch candidate.

## Launch Profile

- Ship with support routed through the public GitHub Pages support page and GitHub issue form.
- Keep telemetry disabled in this release candidate.
- Keep Polar billing live and verify it with the billing smoke script before release.

## Release Target

- April 2026 Chrome Web Store launch candidate
