export const APP_CONFIG = {
  appName: "YouTube Study Copilot",
  shortName: "Study Copilot",
  tagline: "Turn YouTube lessons into notes, flashcards, quizzes, and exports.",
  publicSite: {
    baseUrl: "https://toolhatchhq.github.io/youtube-study-copilot",
    supportUrl: "https://toolhatchhq.github.io/youtube-study-copilot/support/",
    privacyPolicyUrl: "https://toolhatchhq.github.io/youtube-study-copilot/privacy/",
    termsUrl: "https://toolhatchhq.github.io/youtube-study-copilot/terms/",
    changelogUrl: "https://toolhatchhq.github.io/youtube-study-copilot/changelog/"
  },
  supportEmail: "",
  supportUrl: "https://toolhatchhq.github.io/youtube-study-copilot/support/",
  privacyPolicyUrl: "https://toolhatchhq.github.io/youtube-study-copilot/privacy/",
  termsUrl: "https://toolhatchhq.github.io/youtube-study-copilot/terms/",
  billing: {
    provider: "Lemon Squeezy",
    licenseApiOrigin: "https://api.lemonsqueezy.com/*",
    checkoutUrl: "https://YOUR-STORE.lemonsqueezy.com/checkout/buy/YOUR-VARIANT-SLUG",
    billingPortalUrl: "",
    storeId: 0,
    productId: 0,
    variantId: 0,
    productName: "Study Copilot Pro",
    priceLabel: "$19 lifetime",
    requireEmailMatch: true
  },
  integrations: {
    sentry: {
      enabled: false,
      dsn: "",
      environment: "production",
      releaseChannel: "chrome-web-store",
      product: "youtube-study-copilot"
    },
    posthog: {
      enabled: false,
      apiKey: "",
      apiHost: "https://us.i.posthog.com",
      product: "youtube-study-copilot"
    },
    helpScout: {
      mailbox: "study-copilot",
      docsUrl: "https://toolhatchhq.github.io/youtube-study-copilot/support/",
      supportEmail: ""
    },
    github: {
      owner: "toolhatchhq",
      repo: "youtube-study-copilot",
      repositoryUrl: "https://github.com/toolhatchhq/youtube-study-copilot",
      pagesBaseUrl: "https://toolhatchhq.github.io/youtube-study-copilot",
      issuesUrl: "https://github.com/toolhatchhq/youtube-study-copilot/issues",
      changelogUrl: "https://toolhatchhq.github.io/youtube-study-copilot/changelog/"
    }
  },
  plans: {
    free: {
      id: "free",
      label: "Free",
      priceLabel: "$0",
      saveLimit: 5,
      exports: ["markdown"],
      highlights: [
        "Generate notes, flashcards, and quizzes from captioned YouTube videos.",
        "Save the latest 5 study packs locally in Chrome.",
        "Export the current pack as Markdown."
      ]
    },
    pro: {
      id: "pro",
      label: "Pro",
      priceLabel: "$19 lifetime",
      saveLimit: 50,
      exports: ["markdown", "csv", "json", "transcript"],
      highlights: [
        "Export flashcards as CSV for Anki, Sheets, or Notion.",
        "Back up study packs as JSON.",
        "Export the transcript as plain text after loading captions.",
        "Keep the latest 50 study packs locally."
      ]
    }
  },
  onboardingSteps: [
    "Open a YouTube watch page with captions enabled.",
    "Load the transcript, then generate a study pack.",
    "Save the pack locally or export it for review.",
    "Unlock Pro if you want CSV, JSON, transcript export, and a deeper archive."
  ]
};

const PLACEHOLDER_MARKERS = [
  `YOUR-${"ORG"}`,
  `YOUR-${"STORE"}`,
  "your" + "domain" + ".com",
  "support@" + "your" + "domain" + ".com"
];

export function getPlanDefinition(planId) {
  return APP_CONFIG.plans[planId] || APP_CONFIG.plans.free;
}

export function isBillingConfigured() {
  const checkoutUrl = String(APP_CONFIG.billing.checkoutUrl || "").trim();
  const storeId = Number(APP_CONFIG.billing.storeId || 0);
  const productId = Number(APP_CONFIG.billing.productId || 0);

  return /^https:\/\//i.test(checkoutUrl) && storeId > 0 && productId > 0;
}

export function getCurrentPlanId(billingState) {
  return billingState?.hasAccess ? "pro" : "free";
}

export function hasExportAccess(planId, format) {
  return getPlanDefinition(planId).exports.includes(format);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeLicenseKey(value) {
  return String(value || "").trim();
}

export function maskLicenseKey(value) {
  const cleaned = normalizeLicenseKey(value);
  if (cleaned.length <= 8) {
    return cleaned;
  }

  return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
}

export function isPlaceholderContact(value) {
  const normalized = String(value || "").trim();
  return !normalized || PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function getLocalSupportFallback() {
  return "support.html";
}
