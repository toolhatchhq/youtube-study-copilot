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
    provider: "Polar",
    licenseApiOrigin: "https://api.polar.sh/*",
    checkoutUrl: "https://buy.polar.sh/polar_cl_y4n1Z3zttgqQB1n1CH1NUES0RDgomh0IgiSrs1ZUdiK",
    billingPortalUrl: "https://polar.sh/toolhatch-hq/portal",
    organizationId: "f39d8a9f-5e9f-47de-836b-2bfa02f8d12d",
    benefitId: "8449fac5-1d59-4fe8-9406-aa4aa262f44d",
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
  `YOUR-POLAR-${"ORG-ID"}`,
  "your" + "domain" + ".com",
  "support@" + "your" + "domain" + ".com"
];

export function getPlanDefinition(planId) {
  return APP_CONFIG.plans[planId] || APP_CONFIG.plans.free;
}

export function isBillingConfigured() {
  const checkoutUrl = String(APP_CONFIG.billing.checkoutUrl || "").trim();
  const organizationId = String(APP_CONFIG.billing.organizationId || "").trim();

  return /^https:\/\//i.test(checkoutUrl) && Boolean(organizationId) && !isPlaceholderContact(organizationId);
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

export function getSupportContactUrl() {
  if (!isPlaceholderContact(APP_CONFIG.supportEmail)) {
    return `mailto:${APP_CONFIG.supportEmail}`;
  }
  if (!isPlaceholderContact(APP_CONFIG.supportUrl)) {
    return APP_CONFIG.supportUrl;
  }
  if (!isPlaceholderContact(APP_CONFIG.integrations?.github?.issuesUrl)) {
    return APP_CONFIG.integrations.github.issuesUrl;
  }
  return "";
}

export function validateConfig() {
  const warnings = [];
  if (!getSupportContactUrl() && !getLocalSupportFallback()) {
    warnings.push("No support route is configured -- users will have no clear path to contact support.");
  }
  if (!String(APP_CONFIG.billing.benefitId || "").trim()) {
    warnings.push("billing.benefitId is empty -- any license key from your Polar org will activate Pro, not just keys for this product.");
  }
  if (APP_CONFIG.integrations?.sentry?.enabled && !String(APP_CONFIG.integrations.sentry.dsn || "").trim()) {
    warnings.push("Sentry is enabled but DSN is empty -- errors will be silently dropped.");
  }
  if (APP_CONFIG.integrations?.posthog?.enabled && !String(APP_CONFIG.integrations.posthog.apiKey || "").trim()) {
    warnings.push("PostHog is enabled but apiKey is empty -- events will be silently dropped.");
  }
  return warnings;
}
