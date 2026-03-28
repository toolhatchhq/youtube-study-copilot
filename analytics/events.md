# Analytics Events

This file defines the standard event names for PostHog and for any internal analytics layer.

## Global Properties

Attach when available:

- `product`: `youtube-study-copilot`
- `version`
- `environment`
- `release_channel`
- `user_tier`
- `video_id`
- `caption_language`
- `entry`
- `provider`

## Baseline Events

### `install`

- fired on first install

### `onboarding_started`

- fired when the welcome flow is opened for a new install

### `onboarding_completed`

- fired when the onboarding checklist is dismissed or marked complete

### `paywall_viewed`

- fired when the billing section or upgrade CTA is meaningfully opened

### `checkout_started`

- fired when the Polar checkout is launched

### `license_activated`

- fired when a valid license is activated locally

### `core_action_completed`

- fired when a study pack is successfully generated

Suggested properties:

- `generation_mode`: `prompt_api` or `fallback`

### `export_used`

- fired when export succeeds

Suggested properties:

- `format`: `markdown`, `csv`, `json`, `transcript`

### `error_shown`

- fired when a user-visible error is shown

Suggested properties:

- `error_area`
- `error_message`

### `uninstall_started`

- reserved for future uninstall feedback flow
