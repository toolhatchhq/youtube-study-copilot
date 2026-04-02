# YouTube Study Copilot Privacy Policy

Effective date: March 28, 2026

YouTube Study Copilot is a Chrome extension that turns captioned YouTube videos into study materials such as summaries, flashcards, quizzes, and exports.

## Information The Extension Accesses

The extension accesses:

- the current YouTube watch page URL
- video title, author, description, and caption metadata
- caption text after the user chooses to load the transcript
- saved study packs and local settings stored by the extension in Chrome

## How Data Is Used

This data is used only to:

- fetch a transcript for the active YouTube video
- generate study materials inside the extension
- save study packs locally for the user
- export user-created study packs when requested
- manage local onboarding and billing state

## Local Storage

Study packs, onboarding preferences, and local license state are stored in `chrome.storage.local` on the user's device.

## Third-Party Services

The extension contacts third-party services only in these cases:

- when Chrome's built-in AI features are available and used by the browser for local generation
- when a user chooses to activate, refresh, or deactivate a Pro license, in which case the extension sends the provided email and license key to Polar's public license API

This launch build does not send analytics events to PostHog or error reports to Sentry.

The extension does not include ad tracking or general browsing-history collection.

## Permissions

The extension requests access to:

- YouTube watch pages so it can read captions and video metadata
- local extension storage so it can save packs and settings
- Polar's license API only when the user activates, refreshes, or deactivates a Pro license

## Contact

Use the public support page: [https://toolhatchhq.github.io/youtube-study-copilot/support/](https://toolhatchhq.github.io/youtube-study-copilot/support/)

Customer intake goes through the GitHub support issue link published on that page for this launch build.
