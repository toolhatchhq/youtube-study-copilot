import { APP_CONFIG } from "./config.js";

const STORAGE_KEYS = {
  anonymousId: "telemetry-anonymous-id",
  billing: "billing-state"
};

const TELEMETRY_MESSAGE_TYPES = {
  track: "TRACK_EVENT",
  captureError: "CAPTURE_ERROR"
};

function getManifestVersion() {
  return chrome.runtime.getManifest().version;
}

function getReleaseName() {
  const product = APP_CONFIG.integrations?.sentry?.product
    || APP_CONFIG.integrations?.posthog?.product
    || APP_CONFIG.shortName
    || APP_CONFIG.appName;

  return `${product}@${getManifestVersion()}`;
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function sanitizeObjectEntries(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, entryValue]) => (
      entryValue !== undefined
      && entryValue !== null
      && String(entryValue).trim() !== ""
    ))
  );
}

async function getAnonymousId() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anonymousId);
  let anonymousId = String(stored[STORAGE_KEYS.anonymousId] || "").trim();

  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    await chrome.storage.local.set({ [STORAGE_KEYS.anonymousId]: anonymousId });
  }

  return anonymousId;
}

async function getBillingTier() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.billing);
  return stored[STORAGE_KEYS.billing]?.hasAccess ? "pro" : "free";
}

async function getGlobalProperties(overrides = {}) {
  return sanitizeObjectEntries({
    product: APP_CONFIG.integrations?.posthog?.product || APP_CONFIG.integrations?.sentry?.product || APP_CONFIG.shortName,
    version: getManifestVersion(),
    environment: APP_CONFIG.integrations?.sentry?.environment || "production",
    release_channel: APP_CONFIG.integrations?.sentry?.releaseChannel || "chrome-web-store",
    user_tier: await getBillingTier(),
    ...overrides
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }
}

function isPostHogConfigured() {
  return Boolean(
    APP_CONFIG.integrations?.posthog?.enabled
    && String(APP_CONFIG.integrations.posthog.apiKey || "").trim()
    && normalizeOrigin(APP_CONFIG.integrations.posthog.apiHost)
  );
}

function parseSentryDsn(dsn) {
  const url = new URL(String(dsn || "").trim());
  const projectId = url.pathname.replace(/^\/+/, "");

  if (!url.username || !projectId) {
    throw new Error("Invalid Sentry DSN.");
  }

  return {
    origin: `${url.protocol}//${url.host}`,
    publicKey: url.username,
    projectId
  };
}

function isSentryConfigured() {
  return Boolean(APP_CONFIG.integrations?.sentry?.enabled && String(APP_CONFIG.integrations.sentry.dsn || "").trim());
}

function sendRuntimeMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown runtime error."));
        return;
      }

      resolve(response.data);
    });
  });
}

export function createErrorPayload(error) {
  if (error && typeof error === "object" && !(error instanceof Error)) {
    return {
      name: String(error.name || "Error"),
      message: String(error.message || "Unknown error."),
      stack: String(error.stack || "")
    };
  }

  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error || "Unknown error."),
    stack: error instanceof Error ? error.stack || "" : ""
  };
}

export function getTelemetryProductName() {
  return APP_CONFIG.integrations?.posthog?.product
    || APP_CONFIG.integrations?.sentry?.product
    || APP_CONFIG.shortName
    || APP_CONFIG.appName;
}

export async function trackEvent(event, properties = {}) {
  if (!isPostHogConfigured()) {
    return false;
  }

  try {
    const apiHost = normalizeOrigin(APP_CONFIG.integrations.posthog.apiHost);
    const distinctId = await getAnonymousId();

    await postJson(`${apiHost}/capture/`, {
      api_key: APP_CONFIG.integrations.posthog.apiKey,
      event,
      distinct_id: distinctId,
      timestamp: new Date().toISOString(),
      properties: {
        ...await getGlobalProperties(properties),
        $lib: "youtube-study-copilot-extension"
      }
    });

    return true;
  } catch (error) {
    console.warn("PostHog event failed", error);
    return false;
  }
}

export async function captureError(errorInput, context = {}) {
  if (!isSentryConfigured()) {
    return false;
  }

  try {
    const parsedDsn = parseSentryDsn(APP_CONFIG.integrations.sentry.dsn);
    const errorPayload = createErrorPayload(errorInput);
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const anonymousId = await getAnonymousId();
    const tags = await getGlobalProperties();
    const envelopeUrl = `${parsedDsn.origin}/api/${parsedDsn.projectId}/envelope/?sentry_key=${encodeURIComponent(parsedDsn.publicKey)}&sentry_version=7`;

    const event = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      logger: getTelemetryProductName(),
      release: getReleaseName(),
      user: {
        id: anonymousId
      },
      tags,
      message: {
        formatted: errorPayload.message
      },
      extra: sanitizeObjectEntries({
        error_name: errorPayload.name,
        error_stack: errorPayload.stack,
        ...context
      })
    };

    const envelope = [
      JSON.stringify({
        event_id: eventId,
        sent_at: new Date().toISOString(),
        dsn: APP_CONFIG.integrations.sentry.dsn,
        sdk: {
          name: "youtube-study-copilot-extension",
          version: getManifestVersion()
        }
      }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event)
    ].join("\n");

    const response = await fetch(envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope"
      },
      body: envelope
    });

    if (!response.ok) {
      throw new Error(`Sentry request failed with status ${response.status}.`);
    }

    return true;
  } catch (error) {
    console.warn("Sentry event failed", error);
    return false;
  }
}

export async function trackUiEvent(event, properties = {}) {
  return sendRuntimeMessage(TELEMETRY_MESSAGE_TYPES.track, { event, properties });
}

export async function captureUiError(error, context = {}) {
  return sendRuntimeMessage(TELEMETRY_MESSAGE_TYPES.captureError, {
    error: createErrorPayload(error),
    context
  });
}
