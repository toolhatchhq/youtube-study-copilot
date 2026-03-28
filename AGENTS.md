# YouTube Study Copilot Agent Instructions

## Read First

Before planning or coding, read these files in order:

1. `AGENTS.md`
2. `CURRENT_PRIORITIES.md`
3. `docs/spec.md`
4. `ops/runbook.md`

For launch, telemetry, billing, or public-doc work, also read:

1. `LAUNCH_STACK_SETUP.md`
2. `analytics/events.md`
3. `site-src/`

For new product positioning, monetization changes, or major feature bets, also read:

1. `research/opportunity-brief.md`
2. `research/competitor-matrix.md`
3. `research/policy-risk.md`
4. `research/ai-stack.md`
5. `research/unit-economics.md`
6. `research/go-no-go.md`

If the workspace includes `founder-os/`, use it as the operating standard for labels, workflows, templates, and founder routines.

## Repo Rules

- Repo Markdown is canonical.
- Update living docs when behavior or operations change.
- Link work back to a source issue, support thread, Sentry issue, PostHog insight, or roadmap item.
- Do not leave key decisions only in chat.

## Required Doc Updates After Shipping

Update at least one of:

- `CURRENT_PRIORITIES.md`
- `docs/spec.md`
- `docs/decisions.md`
- `ops/runbook.md`

## Product Context

This product is a Chrome side-panel extension that turns captioned YouTube videos into study packs with notes, flashcards, quizzes, exports, and a freemium billing model.

The current business constraints are:

- solo founder support burden must stay low
- Chrome Web Store acquisition must remain clear and policy-safe
- billing uses Polar hosted checkout plus public license activation
- public support, privacy, terms, and changelog pages must exist before release
- telemetry must stay anonymous and low-maintenance when enabled
