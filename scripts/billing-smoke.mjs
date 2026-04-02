import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const rootDir = process.cwd();

function readAppConfig() {
  const configPath = path.join(rootDir, "config.js");
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(/export const APP_CONFIG = (\{[\s\S]*?\n\});/);

  if (!match) {
    throw new Error("Could not parse APP_CONFIG from config.js.");
  }

  return vm.runInNewContext(`(${match[1]})`, {});
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

async function fetchWithRedirect(url, { readText = false } = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "youtube-study-copilot-billing-smoke"
    }
  });

  const result = {
    response,
    finalUrl: response.url
  };

  if (readText) {
    result.text = await response.text();
  }

  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyCheckout(config) {
  const checkoutUrl = normalizeUrl(config.billing?.checkoutUrl);
  assert(/^https:\/\//i.test(checkoutUrl), "billing.checkoutUrl must be a live HTTPS URL.");

  const { response, finalUrl } = await fetchWithRedirect(checkoutUrl);
  assert(response.ok, `Checkout URL returned ${response.status}.`);

  const final = new URL(finalUrl);
  assert(final.hostname === "polar.sh", `Checkout redirected to unexpected host: ${final.hostname}`);
  assert(final.pathname.startsWith("/checkout/"), `Checkout redirected to unexpected path: ${final.pathname}`);
  const checkoutClientSecret = final.pathname.split("/").filter(Boolean).at(-1);
  assert(checkoutClientSecret?.startsWith("polar_c_"), "Checkout redirect did not expose a Polar checkout client id.");

  const checkoutClientResponse = await fetch(`https://api.polar.sh/v1/checkouts/client/${checkoutClientSecret}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "youtube-study-copilot-billing-smoke"
    }
  });
  assert(checkoutClientResponse.ok, `Checkout client API returned ${checkoutClientResponse.status}.`);

  const checkoutClient = await checkoutClientResponse.json().catch(() => null);
  assert(checkoutClient && typeof checkoutClient === "object", "Checkout client API did not return JSON.");
  assert(checkoutClient.product?.name === config.billing.productName, "Checkout client product name did not match config.js.");
  assert(checkoutClient.organization_id === config.billing.organizationId, "Checkout client organization id did not match config.js.");
  assert(checkoutClient.product_price?.type === "one_time", "Checkout client did not expose a one-time product price.");

  const normalizedPrice = String(config.billing.priceLabel || "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (normalizedPrice) {
    const expectedCents = Math.round(Number(normalizedPrice[1]) * 100);
    assert(checkoutClient.amount === expectedCents, `Checkout client amount ${checkoutClient.amount} did not match expected ${expectedCents}.`);
  }

  return {
    finalUrl,
    checkoutClient
  };
}

async function verifyPortal(config) {
  const portalUrl = normalizeUrl(config.billing?.billingPortalUrl);
  assert(/^https:\/\//i.test(portalUrl), "billing.billingPortalUrl must be a live HTTPS URL.");

  const { response, finalUrl } = await fetchWithRedirect(portalUrl);
  assert(response.ok, `Billing portal URL returned ${response.status}.`);

  const final = new URL(finalUrl);
  assert(final.hostname === "polar.sh", `Billing portal redirected to unexpected host: ${final.hostname}`);
  assert(/\/portal\/request\/?$/.test(final.pathname), `Billing portal redirected to unexpected path: ${final.pathname}`);

  return {
    finalUrl
  };
}

async function verifyOrganization(config) {
  const organizationId = String(config.billing?.organizationId || "").trim();
  assert(organizationId, "billing.organizationId must be configured.");

  const response = await fetch(`https://api.polar.sh/v1/organizations/${encodeURIComponent(organizationId)}/payment-status`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "youtube-study-copilot-billing-smoke"
    }
  });

  assert(response.ok, `Organization payment-status returned ${response.status}.`);
  const json = await response.json().catch(() => null);
  assert(json && typeof json === "object", "Organization payment-status did not return JSON.");

  return json;
}

function extractPolarError(json, status) {
  if (typeof json?.detail === "string" && json.detail.trim()) {
    return json.detail.trim();
  }

  if (Array.isArray(json?.detail) && json.detail[0]?.msg) {
    return String(json.detail[0].msg).trim();
  }

  if (typeof json?.error === "string" && json.error.trim()) {
    return json.error.trim();
  }

  return `Polar returned ${status}.`;
}

async function callPolarLicenseApi(pathName, payload) {
  const response = await fetch(`https://api.polar.sh/v1/customer-portal/license-keys/${pathName}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "youtube-study-copilot-billing-smoke"
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractPolarError(json, response.status));
  }

  return json || {};
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLicenseKey(value) {
  return String(value || "").trim();
}

function getPolarLicenseRecord(data) {
  return data?.license_key || data || {};
}

function getPolarActivationId(data) {
  return String(data?.activation?.id || data?.activation_id || data?.id || "").trim();
}

async function maybeRunLiveLicenseFlow(config) {
  const email = normalizeEmail(process.env.POLAR_TEST_LICENSE_EMAIL);
  const licenseKey = normalizeLicenseKey(process.env.POLAR_TEST_LICENSE_KEY);

  if (!email || !licenseKey) {
    return {
      skipped: true,
      reason: "Set POLAR_TEST_LICENSE_EMAIL and POLAR_TEST_LICENSE_KEY to run live activation/validate/deactivate."
    };
  }

  const organizationId = String(config.billing.organizationId || "").trim();
  let activationId = "";

  try {
    const activation = await callPolarLicenseApi("activate", {
      key: licenseKey,
      organization_id: organizationId,
      label: `billing-smoke-${Date.now().toString(36)}`
    });

    activationId = getPolarActivationId(activation);
    const activationRecord = getPolarLicenseRecord(activation);

    if (config.billing.requireEmailMatch) {
      assert(
        normalizeEmail(activationRecord?.customer?.email) === email,
        "Activated license email did not match POLAR_TEST_LICENSE_EMAIL."
      );
    }

    if (String(config.billing.benefitId || "").trim()) {
      assert(
        String(activationRecord?.benefit_id || "").trim() === String(config.billing.benefitId).trim(),
        "Activated license did not match the configured benefitId."
      );
    }

    const validation = await callPolarLicenseApi("validate", {
      key: licenseKey,
      organization_id: organizationId,
      activation_id: activationId
    });

    const validationRecord = getPolarLicenseRecord(validation);
    assert(
      String(validationRecord?.status || "").trim().toLowerCase() === "active",
      "Validated license did not report active status."
    );

    return {
      skipped: false,
      activated: true,
      activationId
    };
  } finally {
    if (activationId) {
      await callPolarLicenseApi("deactivate", {
        key: licenseKey,
        organization_id: organizationId,
        activation_id: activationId
      });
    }
  }
}

async function main() {
  const config = readAppConfig();

  const checkout = await verifyCheckout(config);
  const portal = await verifyPortal(config);
  const paymentStatus = await verifyOrganization(config);
  const liveLicenseFlow = await maybeRunLiveLicenseFlow(config);

  console.log("Billing smoke passed.");
  console.log(`- checkout: ${checkout.finalUrl}`);
  console.log(`- checkout amount: ${checkout.checkoutClient.amount} ${String(checkout.checkoutClient.currency || "").toUpperCase()}`);
  console.log(`- portal: ${portal.finalUrl}`);
  console.log(`- payment status keys: ${Object.keys(paymentStatus).join(", ") || "(none)"}`);

  if (liveLicenseFlow.skipped) {
    console.log(`- live license flow: skipped (${liveLicenseFlow.reason})`);
  } else {
    console.log(`- live license flow: activate/validate/deactivate succeeded (${liveLicenseFlow.activationId})`);
  }
}

main().catch((error) => {
  console.error(`Billing smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  if (error?.cause?.code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY") {
    console.error("Hint: retry with `node --use-system-ca scripts/billing-smoke.mjs` on machines where Node is missing the local CA chain.");
  }
  process.exit(1);
});
