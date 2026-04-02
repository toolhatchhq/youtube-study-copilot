import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Shim chrome.* before importing source modules.
await import("./chrome-shim.js");

import {
  getPlanDefinition,
  isBillingConfigured,
  getCurrentPlanId,
  hasExportAccess,
  normalizeEmail,
  normalizeLicenseKey,
  maskLicenseKey,
  isPlaceholderContact,
  getLocalSupportFallback,
  getSupportContactUrl,
  validateConfig
} from "../config.js";

describe("getPlanDefinition", () => {
  it("returns free plan for 'free'", () => {
    const plan = getPlanDefinition("free");
    assert.equal(plan.id, "free");
    assert.equal(plan.saveLimit, 5);
  });

  it("returns pro plan for 'pro'", () => {
    const plan = getPlanDefinition("pro");
    assert.equal(plan.id, "pro");
    assert.equal(plan.saveLimit, 50);
  });

  it("falls back to free for unknown plan id", () => {
    const plan = getPlanDefinition("enterprise");
    assert.equal(plan.id, "free");
  });

  it("falls back to free for undefined", () => {
    const plan = getPlanDefinition(undefined);
    assert.equal(plan.id, "free");
  });
});

describe("isBillingConfigured", () => {
  it("returns true when checkout URL and org ID are valid", () => {
    assert.equal(isBillingConfigured(), true);
  });
});

describe("getCurrentPlanId", () => {
  it("returns 'pro' when hasAccess is true", () => {
    assert.equal(getCurrentPlanId({ hasAccess: true }), "pro");
  });

  it("returns 'free' when hasAccess is false", () => {
    assert.equal(getCurrentPlanId({ hasAccess: false }), "free");
  });

  it("returns 'free' for null billing state", () => {
    assert.equal(getCurrentPlanId(null), "free");
  });

  it("returns 'free' for undefined", () => {
    assert.equal(getCurrentPlanId(undefined), "free");
  });
});

describe("hasExportAccess", () => {
  it("free plan has markdown access", () => {
    assert.equal(hasExportAccess("free", "markdown"), true);
  });

  it("free plan lacks csv access", () => {
    assert.equal(hasExportAccess("free", "csv"), false);
  });

  it("pro plan has csv access", () => {
    assert.equal(hasExportAccess("pro", "csv"), true);
  });

  it("pro plan has json access", () => {
    assert.equal(hasExportAccess("pro", "json"), true);
  });

  it("pro plan has transcript access", () => {
    assert.equal(hasExportAccess("pro", "transcript"), true);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeEmail("  User@Example.COM  "), "user@example.com");
  });

  it("handles null", () => {
    assert.equal(normalizeEmail(null), "");
  });

  it("handles undefined", () => {
    assert.equal(normalizeEmail(undefined), "");
  });
});

describe("normalizeLicenseKey", () => {
  it("trims whitespace", () => {
    assert.equal(normalizeLicenseKey("  abc-123  "), "abc-123");
  });

  it("handles null", () => {
    assert.equal(normalizeLicenseKey(null), "");
  });
});

describe("maskLicenseKey", () => {
  it("masks long keys", () => {
    assert.equal(maskLicenseKey("abcdefghijklmnop"), "abcd...mnop");
  });

  it("returns short keys unmasked", () => {
    assert.equal(maskLicenseKey("abcd1234"), "abcd1234");
  });

  it("returns short keys unmasked when under 8", () => {
    assert.equal(maskLicenseKey("abc"), "abc");
  });

  it("handles empty string", () => {
    assert.equal(maskLicenseKey(""), "");
  });
});

describe("isPlaceholderContact", () => {
  it("returns true for empty string", () => {
    assert.equal(isPlaceholderContact(""), true);
  });

  it("returns true for null", () => {
    assert.equal(isPlaceholderContact(null), true);
  });

  it("returns false for real URL", () => {
    assert.equal(isPlaceholderContact("https://example.com/support"), false);
  });
});

describe("getLocalSupportFallback", () => {
  it("returns support.html", () => {
    assert.equal(getLocalSupportFallback(), "support.html");
  });
});

describe("getSupportContactUrl", () => {
  it("returns the public support URL when email is empty", () => {
    const url = getSupportContactUrl();
    assert.ok(url.includes("/support/"));
  });
});

describe("validateConfig", () => {
  it("returns an array of warnings", () => {
    const warnings = validateConfig();
    assert.ok(Array.isArray(warnings));
  });

  it("does not warn about supportEmail when a support page exists", () => {
    const warnings = validateConfig();
    assert.ok(!warnings.some((w) => w.includes("supportEmail")));
  });

  it("does not warn about benefitId when it is set", () => {
    const warnings = validateConfig();
    assert.ok(!warnings.some((w) => w.includes("benefitId")));
  });
});
