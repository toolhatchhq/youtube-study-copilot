# Policy Risk

## Permissions

- `storage`, `tabs`, `scripting`, and `sidePanel` are reasonable for the current product
- host access stays limited to YouTube plus telemetry and billing endpoints
- current permission scope is materially safer than a broad web-wide assistant

## Data Handling Risk

- transcript text is sensitive enough that privacy copy must stay clear
- telemetry must remain anonymous and should avoid raw transcript contents
- billing must not embed secret server credentials in the extension

## Chrome Web Store And Platform Risk

- summary and transcript tools are common, so differentiation matters
- browser-native AI is attractive but cannot be the only path because Prompt API support depends on device constraints
- extension policy risk stays moderate as long as the product avoids deceptive claims, broad scraping, and unrelated data collection

## Risk Mitigations

- keep the MVP scoped to captioned YouTube watch pages
- keep a clear free mode even when billing is not configured
- keep local-first storage and explicit export actions
- disclose analytics and Sentry clearly before live enablement
- use public policy and support pages before store submission
