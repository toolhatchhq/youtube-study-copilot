# KPIs

## Primary Metrics

- activation rate: install to first successful study-pack generation
- transcript success rate: load transcript success over transcript attempts
- export engagement: percent of activated users who export at least once
- paid conversion: paywall view to valid Pro activation
- support load: conversations per 100 active users
- refund rate: refunds per paid customer

## Business Questions

- Which videos and use cases lead to the first successful study pack fastest?
- Does Markdown export drive later Pro conversion?
- Which errors most strongly correlate with drop-off?
- Are users blocked more often by missing captions or by unclear value?
- Does a one-time Pro license convert well enough before testing subscriptions?

## Billing References

- billing provider: Lemon Squeezy
- product name: Study Copilot Pro
- price: `$19 lifetime`
- required config source: `config.js`
- billing setup notes: `BILLING_SETUP.md`
- support URL source: `APP_CONFIG.supportUrl`
- privacy URL source: `APP_CONFIG.privacyPolicyUrl`
- changelog URL source: `APP_CONFIG.integrations.github.changelogUrl`

## Launch Dashboard Must Answer

- how many users installed
- how many completed onboarding
- how many loaded captions
- how many generated a study pack
- how many viewed the paywall
- how many activated Pro
