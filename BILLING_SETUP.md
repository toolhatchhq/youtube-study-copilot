# Polar Billing Setup

Effective for this extension build: March 28, 2026

This extension is already wired for Polar's public customer-license flow:

- `POST /v1/customer-portal/license-keys/activate`
- `POST /v1/customer-portal/license-keys/validate`
- `POST /v1/customer-portal/license-keys/deactivate`

## Current Repo Status

- `checkoutUrl` is already set.
- `billingPortalUrl` is already set.
- `organizationId` is already set.
- `benefitId` is already set.

If you reuse this repo for a different Polar organization, update all four billing fields in `config.js`.

The live checkout URL is already set in `config.js`:

- `https://buy.polar.sh/polar_cl_y4n1Z3zttgqQB1n1CH1NUES0RDgomh0IgiSrs1ZUdiK`

## Best First Offer

Use a one-time paid product:

- Product name: `Study Copilot Pro`
- Price: `$19 lifetime`
- Payment type: one-time purchase
- Benefit type: `License Keys`
- Activation limit: `2`

This matches the current extension UX and keeps support simpler than subscriptions.

## Exact Steps In Polar

1. Create or open your Polar organization.
2. Complete account review, payout setup, and identity verification.
3. Create a product named `Study Copilot Pro`.
4. Set it as a one-time product priced at `$19`.
5. Create a `License Keys` benefit with prefix `SCP`.
6. Set the activation limit to `2`.
7. Attach that benefit to `Study Copilot Pro`.
8. Create a checkout link for the product.
9. Copy your Polar `organizationId`.
10. If you want stricter entitlement matching, also copy the benefit ID and place it in `benefitId`.
11. Paste the values into `config.js`.

## Paste These Values Into config.js

```js
billing: {
  provider: "Polar",
  licenseApiOrigin: "https://api.polar.sh/*",
  checkoutUrl: "https://buy.polar.sh/polar_cl_y4n1Z3zttgqQB1n1CH1NUES0RDgomh0IgiSrs1ZUdiK",
  billingPortalUrl: "https://polar.sh/toolhatch-hq/portal",
  organizationId: "YOUR-POLAR-ORG-ID",
  benefitId: "",
  productName: "Study Copilot Pro",
  priceLabel: "$19 lifetime",
  requireEmailMatch: true
}
```

## Notes

- Use the permanent Polar checkout link, not a temporary checkout session URL.
- Keep `requireEmailMatch: true` for lower fraud and support risk.
- Do not put a secret API key inside this Chrome extension.
- The extension will stay in free mode until `checkoutUrl` and `organizationId` are real.
- Leave `benefitId` blank unless you want the extension to reject license keys from any other benefit.

## Test Checklist

1. Run `node scripts/billing-smoke.mjs`.
2. Confirm the live Polar checkout link resolves to the correct product and price.
3. Confirm the billing portal URL resolves to the customer email access screen.
4. If you have a real test purchase, set `POLAR_TEST_LICENSE_EMAIL` and `POLAR_TEST_LICENSE_KEY`, then rerun `node scripts/billing-smoke.mjs`.
5. If needed, confirm the customer can also remove activations from the Polar customer portal.

## Official Docs

- Supported countries: https://polar.sh/docs/merchant-of-record/supported-countries
- Finance accounts: https://polar.sh/docs/features/finance/accounts
- License keys: https://polar.sh/docs/features/benefits/license-keys
- Checkout links: https://polar.sh/docs/features/checkout/links
- Deactivate license key: https://polar.sh/docs/api-reference/customer-portal/license-keys/deactivate
- Customer portal: https://polar.sh/docs/features/customer-portal
