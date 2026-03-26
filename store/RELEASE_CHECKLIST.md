# Release Checklist

## Required Before Submission

1. Replace the placeholder billing fields in `config.js`.
2. Keep the GitHub Pages support, privacy, terms, and changelog URLs in `config.js` unless you already have a better live destination.
3. Build the public docs site with `node scripts/build-pages.mjs`.
4. Publish the site through GitHub Pages.
5. Decide whether support will temporarily route through the GitHub issue form before Help Scout is live.
6. Replace the generated icons if you want a custom final brand treatment.
7. Capture Chrome Web Store screenshots using the real side panel flow.

## Functional QA

1. Load the extension unpacked in Chrome.
2. Open a captioned YouTube video and confirm transcript loading works.
3. Build a pack with and without Chrome's built-in AI available.
4. Save more than 5 packs on the free plan and confirm the archive trims correctly.
5. Confirm Markdown export works on the free plan.
6. Activate a test Pro license and verify CSV, JSON, and transcript export unlock.
7. Deactivate the device and confirm the extension returns to the free plan.
8. Verify PostHog and Sentry receive test events when enabled.

## Store Readiness

1. Confirm the onboarding page opens on install.
2. Confirm `welcome.html` works as the extension options page.
3. Verify privacy, support, terms, and changelog links open correctly.
4. Run `node scripts/launch-audit.mjs --strict`.
5. Double-check that no placeholder domain or contact info remains in the listing copy.
