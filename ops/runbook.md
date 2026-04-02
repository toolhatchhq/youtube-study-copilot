# Runbook

## Support

- Current launch support channel: the GitHub Pages support URL plus the GitHub issue form linked from that page
- Public support URL: publish `site-src/support.md` through GitHub Pages and place the final URL in `APP_CONFIG.supportUrl`
- Common support topics:
  - no captions available
  - transcript failed to load
  - license activation failed
  - refund or billing confusion
  - exported file expectations
- Help Scout is optional for a later release, not a launch blocker for this build

## Billing

- Provider: Polar
- Launch model: one-time Pro license
- Required config values:
  - `checkoutUrl`
  - `organizationId`
  - optional `benefitId`
  - optional `billingPortalUrl`
- Rule: billing setup steps and refund handling must stay documented here and in `BILLING_SETUP.md`
- Extension behavior: activation checks validate the expected checkout email and benefit locally after Polar responds, and failed local checks attempt an automatic deactivation rollback.
- Extension behavior: transient Polar validation or deactivation failures keep the current local Pro state intact and should be retried before support treats them as an entitlement loss.
- Pre-release gate: run `node scripts/billing-smoke.mjs`; add `POLAR_TEST_LICENSE_EMAIL` and `POLAR_TEST_LICENSE_KEY` when you want the script to exercise live activation, validation, and deactivation.

## Sentry Setup Standard

- Status: deferred for this release. Keep Sentry disabled unless the manifest and config are intentionally updated together.
- Track tags:
  - `product`
  - `version`
  - `environment`
  - `release_channel`
  - `user_tier`
- Required alerts:
  - new error spike
  - high-frequency error
  - release regression
- Rule: recurring Sentry issues become GitHub issues unless explicitly ignored with a documented reason

## PostHog Setup Standard

- Status: deferred for this release. Keep PostHog disabled unless the manifest and config are intentionally updated together.
- Track baseline events from `analytics/events.md`
- Build dashboards for:
  - activation funnel
  - paid conversion funnel
  - top feature usage
  - drop-off versus error correlation

## Help Scout Standard

- Status: deferred for this release. The public support page and GitHub issue form are the customer-facing channel for launch.
- Use product tags or views inside the shared portfolio mailbox
- Saved replies required for:
  - refund request
  - license activation problem
  - missing captions
  - billing confusion
- Rule: any support thread implying a product change becomes a GitHub issue labeled `source:support`

## Incident Handling

1. Assess severity as `sev1`, `sev2`, or `sev3`.
2. Create or update a GitHub incident issue with the source link.
3. Check Sentry for frequency and scope.
4. Check Help Scout for customer impact.
5. Decide workaround, rollback, or hotfix path.
6. Update this runbook if the incident revealed a missing operating step.

## Release And Recovery

- Keep `CHANGELOG.md` current.
- Run `node scripts/build-pages.mjs` and `node scripts/launch-audit.mjs --strict` before every release candidate.
- Confirm public support, privacy, terms, and changelog links work before every release.
- If a release breaks a core flow, stop promotion, document the issue, and ship a rollback or hotfix before resuming acquisition.
