# Release Checklist

## Product Readiness

1. `CURRENT_PRIORITIES.md` reflects current launch work.
2. `docs/spec.md` matches the actual behavior.
3. `docs/decisions.md` includes any new product or technical decision.
4. `CHANGELOG.md` is updated.

## Public Docs

1. `node scripts/build-pages.mjs` completes successfully.
2. `node scripts/launch-audit.mjs --strict` passes.
3. Support URL is live.
4. Privacy policy URL is live.
5. Terms URL is live.
6. Changelog page or release notes are reachable.
7. Chrome Web Store listing copy and screenshots are current.

## Billing

1. Polar checkout URL is correct.
2. `organizationId` is correct.
3. `benefitId` is correct if entitlement matching is locked to one benefit.
4. `node scripts/billing-smoke.mjs` succeeds.
5. Optional: set `POLAR_TEST_LICENSE_EMAIL` and `POLAR_TEST_LICENSE_KEY`, then rerun `node scripts/billing-smoke.mjs` to exercise live activation, validation, and deactivation.

## Reliability

1. Telemetry is either intentionally disabled for this release or fully configured and tested.
2. Support routes point to the public support page and issue form, or to a live Help Scout inbox if you have enabled one.
3. GitHub issue forms are present.
4. Repo contract and extension checks pass.
5. Public Pages deployment workflow is enabled.
