# Product Spec

## Audience

- students using YouTube for learning
- language learners reviewing educational videos
- self-learners who want notes, flashcards, and quiz prompts from long-form video

## Core Job

Turn a captioned YouTube watch page into a usable study pack without requiring the user to leave Chrome.

## Current Behavior

- opens as a Chrome side panel on supported YouTube watch pages
- reads the current video metadata and available caption track
- loads transcript text from the selected caption source
- generates summary bullets, flashcards, and quiz prompts
- prefers Chrome's built-in Prompt API when available
- falls back to heuristic generation when built-in AI is unavailable
- saves study packs locally with free-vs-pro archive limits
- exports Markdown on the free plan
- gates CSV, JSON, and transcript export behind Pro
- opens a welcome page on install and uses it as the options page
- exposes setup shortcuts from the welcome page for checkout, privacy, support, and repo notes
- supports Polar license activation, validation, and device deactivation
- emits product telemetry events to PostHog when enabled in `config.js`
- sends runtime error reports to Sentry when enabled in `config.js`
- ships public support, privacy, terms, and changelog pages from repo-managed Markdown via GitHub Pages

## Permissions

- `storage`
- `tabs`
- `scripting`
- `sidePanel`
- host access to `https://www.youtube.com/*`
- host access to `https://*.i.posthog.com/*`
- host access to `https://*.ingest.sentry.io/*`
- optional host access to `https://api.polar.sh/*`

## Out Of Scope For This Release

- user accounts and cloud sync
- team collaboration or shared study decks
- OCR or document parsing beyond YouTube captions
- subscription billing or seat management
