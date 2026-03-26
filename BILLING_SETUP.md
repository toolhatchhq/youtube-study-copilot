# Lemon Squeezy Billing Setup

Effective for this extension build: March 26, 2026

This extension is already wired for Lemon Squeezy's public license flow:

- `POST /v1/licenses/activate`
- `POST /v1/licenses/validate`
- `POST /v1/licenses/deactivate`

The only values you still need from your own Lemon Squeezy account are:

- `checkoutUrl`
- `storeId`
- `productId`
- `variantId`
- optional `billingPortalUrl`

## Best First Offer

Use a one-time paid product:

- Product name: `Study Copilot Pro`
- Price: `$19 lifetime`
- Payment type: single payment
- License keys: enabled
- Activation limit: `1` or `2`

This matches the current extension UX and keeps support simpler than subscriptions.

## Exact Steps In Lemon Squeezy

1. Create or open your Lemon Squeezy store.
2. If needed, keep working in Test Mode first.
3. Create a new product named `Study Copilot Pro`.
4. Set it as a single-payment product.
5. Set the paid variant price to `$19`.
6. Enable license keys for the product or variant.
7. Set the activation limit to `1` or `2`.
8. Publish the product.
9. Open the product's `Share` page and copy the hosted checkout URL.
10. Copy your numeric store, product, and variant IDs from Lemon Squeezy.
11. Paste those values into `config.js`.
12. If you sell subscriptions later, add `https://YOUR-STORE.lemonsqueezy.com/billing` as `billingPortalUrl`.

## Paste These Values Into config.js

```js
billing: {
  provider: "Lemon Squeezy",
  licenseApiOrigin: "https://api.lemonsqueezy.com/*",
  checkoutUrl: "https://YOUR-STORE.lemonsqueezy.com/checkout/buy/YOUR-VARIANT-SLUG",
  billingPortalUrl: "",
  storeId: 12345,
  productId: 67890,
  variantId: 67891,
  productName: "Study Copilot Pro",
  priceLabel: "$19 lifetime",
  requireEmailMatch: true
}
```

## Notes

- Use the checkout URL from Lemon Squeezy's Share page. Do not copy a one-time cart URL.
- Keep `requireEmailMatch: true` for lower fraud and support risk.
- Do not put a secret API key inside this Chrome extension.
- The extension will stay in free mode until `checkoutUrl`, `storeId`, and `productId` are real.

## Test Checklist

1. In Test Mode, use the hosted checkout URL and complete a purchase with a test card.
2. Confirm Lemon Squeezy emails a test receipt and license key.
3. Paste the checkout email and license key into the extension.
4. Confirm Pro unlocks.
5. Click `Refresh Access` and confirm validation succeeds.
6. Click `Deactivate Device` and confirm the extension returns to free mode.

## Official Docs

- Sharing products: https://docs.lemonsqueezy.com/help/products/sharing-products
- License keys tutorial: https://docs.lemonsqueezy.com/guides/tutorials/license-keys
- Generating license keys: https://docs.lemonsqueezy.com/help/licensing/generating-license-keys
- Test mode: https://docs.lemonsqueezy.com/help/getting-started/test-mode
- Activate your store: https://docs.lemonsqueezy.com/help/getting-started/activate-your-store
- Customer portal: https://docs.lemonsqueezy.com/help/online-store/customer-portal
