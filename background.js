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
    throw new Error("Set your Lemon Squeezy checkout URL, store ID, and product ID in config.js before enabling Pro billing.");
  }
}

function assertProductMatch(meta) {
  const storeId = Number(APP_CONFIG.billing.storeId || 0);
  const productId = Number(APP_CONFIG.billing.productId || 0);
  const variantId = Number(APP_CONFIG.billing.variantId || 0);

  if (storeId > 0 && Number(meta?.store_id || 0) !== storeId) {
    throw new Error("This license belongs to a different Lemon Squeezy store.");
  }

  if (productId > 0 && Number(meta?.product_id || 0) !== productId) {
    throw new Error("This license belongs to a different product.");
  }

  if (variantId > 0 && Number(meta?.variant_id || 0) !== variantId) {
    throw new Error("This license belongs to a different pricing variant.");
  }
}

function assertCustomerMatch(inputEmail, meta) {
  if (!APP_CONFIG.billing.requireEmailMatch) {
    return;
  }

  const normalizedInput = normalizeEmail(inputEmail);
  const normalizedCustomer = normalizeEmail(meta?.customer_email);

  if (!normalizedInput) {
    throw new Error("Enter the email address used during checkout.");
  }

  if (normalizedInput !== normalizedCustomer) {
    throw new Error("The checkout email does not match the license owner.");
  }
}

async function callLemonSqueezyLicenseApi(path, params) {
  const response = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams(params)
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || `Lemon Squeezy returned ${response.status}.`);
  }

  return json || {};
}

function buildInstanceName() {
  const runtimeId = chrome.runtime.id ? chrome.runtime.id.slice(0, 4) : "ext";
  return `${APP_CONFIG.shortName} ${runtimeId}-${Date.now().toString(36)}`;
}

async function activateProLicense(payload) {
  assertBillingConfigured();

  const email = normalizeEmail(payload?.email);
  const licenseKey = normalizeLicenseKey(payload?.licenseKey);

  if (!licenseKey) {
    throw new Error("Enter a license key to activate Pro.");
  }

  const data = await callLemonSqueezyLicenseApi("activate", {
    license_key: licenseKey,
    instance_name: buildInstanceName()
  });

  if (!data?.activated) {
    throw new Error(data?.error || "The license could not be activated.");
  }

  assertProductMatch(data.meta);
  assertCustomerMatch(email, data.meta);

  const nextState = await saveBillingState({
    provider: APP_CONFIG.billing.provider,
    status: data.license_key?.status || "active",
    hasAccess: true,
    email,
    licenseKey,
    maskedLicenseKey: maskLicenseKey(licenseKey),
    instanceId: data.instance?.id || "",
    customerName: data.meta?.customer_name || "",
    productName: data.meta?.product_name || APP_CONFIG.billing.productName,
    variantName: data.meta?.variant_name || "",
    activatedAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    lastError: ""
  });

  await trackEvent("license_activated", {
    provider: APP_CONFIG.billing.provider,
    variant_name: nextState.variantName || data.meta?.variant_name || ""
  });

  return nextState;
}

async function validateProLicense() {
  assertBillingConfigured();

  const current = await getBillingState();

  if (!current.licenseKey) {
    throw new Error("No Pro license is stored on this device.");
  }

  const requestPayload = {
    license_key: current.licenseKey
  };

  if (current.instanceId) {
    requestPayload.instance_id = current.instanceId;
  }

  const data = await callLemonSqueezyLicenseApi("validate", requestPayload);

  if (!data?.valid) {
    return saveBillingState({
      ...createDefaultBillingState(),
      lastError: data?.error || "This license is no longer valid."
    });
  }

  assertProductMatch(data.meta);
  if (current.email) {
    assertCustomerMatch(current.email, data.meta);
  }

  return saveBillingState({
    ...current,
    status: data.license_key?.status || "active",
    hasAccess: true,
    customerName: data.meta?.customer_name || current.customerName,
    productName: data.meta?.product_name || current.productName,
    variantName: data.meta?.variant_name || current.variantName,
    lastValidatedAt: new Date().toISOString(),
    lastError: ""
  });
}

async function clearProLicense() {
  const current = await getBillingState();
  let note = "";

  if (current.licenseKey && current.instanceId && isBillingConfigured()) {
    try {
      const data = await callLemonSqueezyLicenseApi("deactivate", {
        license_key: current.licenseKey,
        instance_id: current.instanceId
      });

      if (!data?.deactivated) {
        throw new Error(data?.error || "The license instance could not be deactivated.");
      }

      assertProductMatch(data.meta);
    } catch (error) {
      note = error instanceof Error
        ? `${error.message} Local access was still cleared on this device.`
        : "Local access was cleared, but remote deactivation could not be confirmed.";
    }
  } else {
    note = "Local access was cleared on this device.";
  }

  return {
    billing: await saveBillingState(createDefaultBillingState()),
    note
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
