# Decisions

## 2026-03-25

- Decision: Start with a YouTube study extension rather than a general summary tool.
- Why: clearer Chrome Web Store intent, lower policy risk, stronger educational value.
- Tradeoff: narrower initial use case.

## 2026-03-26

- Decision: Use Lemon Squeezy license keys instead of building a custom billing backend for v1.
- Why: lowest solo-founder support burden and fastest path to self-serve monetization.
- Tradeoff: customer activation is device-based, not account-based.

## 2026-03-26

- Decision: Use repo Markdown plus GitHub Issues as the operating system.
- Why: works cleanly in VS Code and AI coding tools without parallel systems.
- Tradeoff: more discipline is needed to keep docs updated.

## 2026-03-26

- Decision: Keep the product local-first and store study packs in `chrome.storage.local`.
- Why: simpler privacy posture and lower infrastructure load.
- Tradeoff: no sync across devices in v1.

## 2026-03-26

- Decision: Publish support, privacy, terms, and changelog pages from repo-managed Markdown using GitHub Pages.
- Why: lowest-maintenance public docs path for a solo founder, with versioned source that VS Code and AI tools can edit directly.
- Tradeoff: public docs stay simple and static until a custom domain or richer site is justified.

## 2026-03-26

- Decision: Use one shared telemetry module for PostHog events and Sentry error capture.
- Why: launch observability needs a single implementation path that can be reused across future products and shared cleanly by the background worker, side panel, and welcome page.
- Tradeoff: telemetry requires careful config, privacy disclosure, and release testing before being enabled live.

## 2026-03-26

- Decision: Launch on GitHub Pages before buying a custom domain.
- Why: it removes the domain purchase as a blocker and keeps support, privacy, terms, and changelog pages store-ready with repo-managed source.
- Tradeoff: the public brand looks more temporary, and customer support should route through the GitHub issue form until Help Scout is live.
