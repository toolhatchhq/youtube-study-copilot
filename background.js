import {
  APP_CONFIG,
  getCurrentPlanId,
  getPlanDefinition,
  isBillingConfigured,
  maskLicenseKey,
  normalizeEmail,
  normalizeLicenseKey
} from "./config.js";
import {
  captureError,
  createErrorPayload,
  trackEvent
} from "./telemetry.js";

const STORAGE_KEYS = {
  billing: "billing-state",
  settings: "app-settings",
  studyPacks: "study-packs"
};

function isSupportedYouTubeWatchUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname.includes("youtube.com") && url.pathname === "/watch" && url.searchParams.has("v");
  } catch {
    return false;
  }
}

function pickCaptionTrack(captionTracks) {
  if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
    return null;
  }

  const manualEnglish = captionTracks.find((track) => track.languageCode?.startsWith("en") && !track.kind);
  const manualAny = captionTracks.find((track) => !track.kind);
  const autoEnglish = captionTracks.find((track) => track.languageCode?.startsWith("en"));

  return manualEnglish || manualAny || autoEnglish || captionTracks[0];
}

function createDefaultSettings() {
  return {
    onboardingCompleted: false,
    installedAt: new Date().toISOString()
  };
}

function createDefaultBillingState() {
  return {
    provider: APP_CONFIG.billing.provider,
    status: "free",
    hasAccess: false,
    email: "",
    licenseKey: "",
    maskedLicenseKey: "",
    instanceId: "",
    customerName: "",
    productName: "",
    variantName: "",
    activatedAt: "",
    lastValidatedAt: "",
    lastError: ""
  };
}

function sanitizeStudyPack(payload) {
  const flashcards = Array.isArray(payload.flashcards) ? payload.flashcards : [];
  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];
  const summary = Array.isArray(payload.summary) ? payload.summary : [];

  return {
    id: String(payload.id || crypto.randomUUID()),
    title: String(payload.title || "Untitled video").trim(),
    url: String(payload.url || ""),
    author: String(payload.author || ""),
    captionLanguage: String(payload.captionLanguage || ""),
    createdAt: payload.createdAt || new Date().toISOString(),
    transcriptExcerpt: String(payload.transcriptExcerpt || "").slice(0, 1800),
    summary: summary.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5),
    flashcards: flashcards
      .map((item) => ({
        front: String(item?.front || "").trim(),
        back: String(item?.back || "").trim()
      }))
      .filter((item) => item.front && item.back)
      .slice(0, 10),
    quiz: quiz
      .map((item) => ({
        question: String(item?.question || "").trim(),
        answer: String(item?.answer || "").trim()
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 10)
  };
}

async function updateSidePanelForTab(tabId, urlString) {
  const enabled = isSupportedYouTubeWatchUrl(urlString);

  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled
  }).catch(() => {});
}

async function getActiveTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return activeTab || null;
}

async function getActiveVideoContext() {
  const activeTab = await getActiveTab();

  if (!activeTab?.id || !activeTab.url || !isSupportedYouTubeWatchUrl(activeTab.url)) {
    return null;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    world: "MAIN",
    func: () => {
      const playerResponse = window.ytInitialPlayerResponse || window.__INITIAL_PLAYER_RESPONSE__ || null;
      const titleNode = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
      const ownerNode = document.querySelector("#owner a");
      const videoUrl = window.location.href;
      const url = new URL(videoUrl);
      const videoId = url.searchParams.get("v");
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

      return {
        videoId,
        url: videoUrl,
        title: titleNode?.textContent?.trim() || playerResponse?.videoDetails?.title || document.title.replace(/\s*-\s*YouTube$/, ""),
        author: ownerNode?.textContent?.trim() || playerResponse?.videoDetails?.author || "",
        shortDescription: playerResponse?.videoDetails?.shortDescription || "",
        captionTracks
      };
    }
  });

  if (!result?.videoId) {
    return null;
  }

  const captionTrack = pickCaptionTrack(result.captionTracks);

  return {
    videoId: result.videoId,
    url: result.url,
    title: result.title,
    author: result.author,
    shortDescription: result.shortDescription,
    captionTrack: captionTrack
      ? {
          baseUrl: captionTrack.baseUrl,
          languageCode: captionTrack.languageCode || "",
          name: captionTrack.name?.simpleText || captionTrack.vssId || "Captions",
          kind: captionTrack.kind || "standard"
        }
      : null
  };
}

async function getStoredStudyPacks() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.studyPacks);
  return Array.isArray(stored[STORAGE_KEYS.studyPacks]) ? stored[STORAGE_KEYS.studyPacks] : [];
}

async function trimStoredStudyPacks(limit) {
  const existing = await getStoredStudyPacks();
  const next = existing.slice(0, limit);
  if (next.length !== existing.length) {
    await chrome.storage.local.set({ [STORAGE_KEYS.studyPacks]: next });
  }
  return next;
}

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return {
    ...createDefaultSettings(),
    ...(stored[STORAGE_KEYS.settings] || {})
  };
}

async function saveSettings(partial) {
  const next = {
    ...(await getSettings()),
    ...(partial || {})
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

async function getBillingState() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.billing);
  return {
    ...createDefaultBillingState(),
    ...(stored[STORAGE_KEYS.billing] || {})
  };
}

async function saveBillingState(nextState) {
  const next = {
    ...createDefaultBillingState(),
    ...(nextState || {})
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.billing]: next });
  await trimStoredStudyPacks(getPlanDefinition(getCurrentPlanId(next)).saveLimit);
  return next;
}

async function getBillingPermissionGranted() {
  return chrome.permissions.contains({
    origins: [APP_CONFIG.billing.licenseApiOrigin]
  });
}

async function getBootstrap() {
  return {
    billing: await getBillingState(),
    billingPermissionGranted: await getBillingPermissionGranted(),
    billingReady: isBillingConfigured(),
    settings: await getSettings(),
    version: chrome.runtime.getManifest().version,
    savedPacks: await getStoredStudyPacks()
  };
}

async function saveStudyPack(payload) {
  const existing = await getStoredStudyPacks();
  const billingState = await getBillingState();
  const planId = getCurrentPlanId(billingState);
  const plan = getPlanDefinition(planId);
  const sanitized = sanitizeStudyPack(payload);
  const withoutCurrent = existing.filter((item) => item.id !== sanitized.id);
  const next = [sanitized, ...withoutCurrent].slice(0, plan.saveLimit);
  const trimmed = withoutCurrent.length + 1 > next.length;

  await chrome.storage.local.set({ [STORAGE_KEYS.studyPacks]: next });

  return {
    packs: next,
    meta: {
      planId,
      saveLimit: plan.saveLimit,
      trimmed
    }
  };
}

async function deleteStudyPack(packId) {
  const existing = await getStoredStudyPacks();
  const next = existing.filter((item) => item.id !== packId);
  await chrome.storage.local.set({ [STORAGE_KEYS.studyPacks]: next });
  return next;
}

function assertBillingConfigured() {
  if (!isBillingConfigured()) {
    throw new Error("Set your Polar checkout URL and organization ID in config.js before enabling Pro billing.");
  }
}

function getRequiredOrganizationId() {
  const organizationId = String(APP_CONFIG.billing.organizationId || "").trim();
  if (!organizationId || organizationId.includes("YOUR-POLAR-ORG-ID")) {
    throw new Error("Set your Polar organization ID in config.js before enabling Pro billing.");
  }
  return organizationId;
}

function getConfiguredBenefitId() {
  return String(APP_CONFIG.billing.benefitId || "").trim();
}

function getPolarLicenseRecord(data) {
  return data?.license_key || data || {};
}

function getPolarCustomerEmail(licenseRecord) {
  return normalizeEmail(licenseRecord?.customer?.email || "");
}

function getPolarCustomerName(licenseRecord) {
  return String(
    licenseRecord?.customer?.name
    || licenseRecord?.customer?.email
    || ""
  ).trim();
}

function assertBenefitMatch(licenseRecord) {
  const benefitId = getConfiguredBenefitId();
  if (!benefitId) {
    return;
  }

  if (String(licenseRecord?.benefit_id || "").trim() !== benefitId) {
    throw new Error("This license belongs to a different Polar benefit.");
  }
}

function assertCustomerMatch(inputEmail, customerEmail) {
  if (!APP_CONFIG.billing.requireEmailMatch) {
    return;
  }

  const normalizedInput = normalizeEmail(inputEmail);
  const normalizedCustomer = normalizeEmail(customerEmail);

  if (!normalizedInput) {
    throw new Error("Enter the email address used during checkout.");
  }

  if (normalizedInput !== normalizedCustomer) {
    throw new Error("The checkout email does not match the license owner.");
  }
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

async function callPolarLicenseApi(path, payload) {
  const response = await fetch(`https://api.polar.sh/v1/customer-portal/license-keys/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractPolarError(json, response.status));
  }

  return json || {};
}

function buildInstanceName() {
  const runtimeId = chrome.runtime.id ? chrome.runtime.id.slice(0, 4) : "ext";
  return `${APP_CONFIG.shortName} ${runtimeId}-${Date.now().toString(36)}`;
}

async function activateProLicense(payload) {
  assertBillingConfigured();

  const organizationId = getRequiredOrganizationId();
  const email = normalizeEmail(payload?.email);
  const licenseKey = normalizeLicenseKey(payload?.licenseKey);

  if (!licenseKey) {
    throw new Error("Enter a license key to activate Pro.");
  }

  const data = await callPolarLicenseApi("activate", {
    key: licenseKey,
    organization_id: organizationId,
    label: buildInstanceName()
  });

  const licenseRecord = getPolarLicenseRecord(data);
  assertBenefitMatch(licenseRecord);
  assertCustomerMatch(email, getPolarCustomerEmail(licenseRecord));

  const nextState = await saveBillingState({
    provider: APP_CONFIG.billing.provider,
    status: String(licenseRecord?.status || "active"),
    hasAccess: true,
    email: email || getPolarCustomerEmail(licenseRecord),
    licenseKey,
    maskedLicenseKey: maskLicenseKey(licenseKey),
    instanceId: String(data?.id || data?.activation_id || ""),
    customerName: getPolarCustomerName(licenseRecord),
    productName: APP_CONFIG.billing.productName,
    variantName: String(licenseRecord?.benefit_id || "").trim(),
    activatedAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    lastError: ""
  });

  await trackEvent("license_activated", {
    provider: APP_CONFIG.billing.provider,
    benefit_id: nextState.variantName
  });

  return nextState;
}

async function validateProLicense() {
  assertBillingConfigured();

  const current = await getBillingState();
  const organizationId = getRequiredOrganizationId();

  if (!current.licenseKey) {
    throw new Error("No Pro license is stored on this device.");
  }

  const requestPayload = {
    key: current.licenseKey,
    organization_id: organizationId
  };

  if (current.instanceId) {
    requestPayload.activation_id = current.instanceId;
  }

  let data;
  try {
    data = await callPolarLicenseApi("validate", requestPayload);
  } catch (error) {
    return saveBillingState({
      ...createDefaultBillingState(),
      lastError: error instanceof Error ? error.message : "This license is no longer valid."
    });
  }

  const licenseRecord = getPolarLicenseRecord(data);
  assertBenefitMatch(licenseRecord);
  if (current.email) {
    assertCustomerMatch(current.email, getPolarCustomerEmail(licenseRecord));
  }

  return saveBillingState({
    ...current,
    status: String(licenseRecord?.status || "active"),
    hasAccess: true,
    customerName: getPolarCustomerName(licenseRecord) || current.customerName,
    productName: APP_CONFIG.billing.productName,
    variantName: String(licenseRecord?.benefit_id || current.variantName || "").trim(),
    instanceId: String(data?.activation?.id || current.instanceId || ""),
    lastValidatedAt: new Date().toISOString(),
    lastError: ""
  });
}

async function clearProLicense() {
  const current = await getBillingState();
  if (current.licenseKey && current.instanceId && isBillingConfigured()) {
    const organizationId = getRequiredOrganizationId();
    await callPolarLicenseApi("deactivate", {
      key: current.licenseKey,
      organization_id: organizationId,
      activation_id: current.instanceId
    });

    return {
      billing: await saveBillingState(createDefaultBillingState()),
      note: "This device was deactivated and returned to the free plan."
    };
  }

  return {
    billing: await saveBillingState(createDefaultBillingState()),
    note: "Local access was cleared on this device."
  };
}

async function reportRuntimeError(error, area, context = {}) {
  const errorPayload = createErrorPayload(error);
  await Promise.allSettled([
    trackEvent("error_shown", {
      error_area: area,
      error_message: errorPayload.message,
      ...context
    }),
    captureError(errorPayload, {
      area,
      ...context
    })
  ]);
}

async function openUrl(url) {
  const target = String(url || "").trim();
  if (!target) {
    throw new Error("No URL was provided.");
  }

  await chrome.tabs.create({ url: target });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  }).catch(() => {});

  await trackEvent("install", {
    reason: details.reason
  });

  if (details.reason === "install") {
    await trackEvent("onboarding_started", {
      entry: "install_welcome"
    });
    await chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html")
    }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) {
    await updateSidePanelForTab(tabId, tab.url);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    await updateSidePanelForTab(tabId, changeInfo.url || tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "GET_APP_BOOTSTRAP":
        sendResponse({ ok: true, data: await getBootstrap() });
        return;
      case "SET_ONBOARDING_COMPLETED":
        sendResponse({ ok: true, data: await saveSettings({ onboardingCompleted: Boolean(message.payload?.completed) }) });
        return;
      case "GET_ACTIVE_VIDEO_CONTEXT":
        sendResponse({ ok: true, data: await getActiveVideoContext() });
        return;
      case "GET_SAVED_STUDY_PACKS":
        sendResponse({ ok: true, data: await getStoredStudyPacks() });
        return;
      case "SAVE_STUDY_PACK":
        sendResponse({ ok: true, data: await saveStudyPack(message.payload || {}) });
        return;
      case "DELETE_STUDY_PACK":
        sendResponse({ ok: true, data: await deleteStudyPack(message.payload?.id) });
        return;
      case "ACTIVATE_PRO_LICENSE":
        sendResponse({ ok: true, data: await activateProLicense(message.payload || {}) });
        return;
      case "VALIDATE_PRO_LICENSE":
        sendResponse({ ok: true, data: await validateProLicense() });
        return;
      case "CLEAR_PRO_LICENSE":
        sendResponse({ ok: true, data: await clearProLicense() });
        return;
      case "OPEN_URL":
        await openUrl(message.payload?.url);
        sendResponse({ ok: true, data: true });
        return;
      case "TRACK_EVENT":
        sendResponse({
          ok: true,
          data: await trackEvent(message.payload?.event, message.payload?.properties || {})
        });
        return;
      case "CAPTURE_ERROR":
        sendResponse({
          ok: true,
          data: await captureError(message.payload?.error || {}, message.payload?.context || {})
        });
        return;
      default:
        sendResponse({ ok: false, error: "Unsupported message type." });
    }
  })().catch((error) => {
    reportRuntimeError(error, "runtime_message", {
      message_type: message?.type || "unknown"
    }).catch(() => {});
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error."
    });
  });

  return true;
});
