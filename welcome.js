import {
  APP_CONFIG,
  getLocalSupportFallback,
  getPlanDefinition,
  isBillingConfigured,
  isPlaceholderContact
} from "./config.js";
import {
  captureUiError,
  trackUiEvent
} from "./telemetry.js";

const elements = {
  completeOnboardingButton: document.querySelector("#complete-onboarding-button"),
  freeFeatures: document.querySelector("#free-features"),
  freePrice: document.querySelector("#free-price"),
  openCheckoutButton: document.querySelector("#open-checkout-button"),
  openPrivacyButton: document.querySelector("#open-privacy-button"),
  openReadmeButton: document.querySelector("#open-readme-button"),
  openSupportButton: document.querySelector("#open-support-button"),
  openYouTubeButton: document.querySelector("#open-youtube-button"),
  proFeatures: document.querySelector("#pro-features"),
  proPrice: document.querySelector("#pro-price"),
  stepsList: document.querySelector("#steps-list"),
  welcomeStatus: document.querySelector("#welcome-status")
};

function sendMessage(type, payload) {
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

function renderList(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

async function openUrl(url) {
  await sendMessage("OPEN_URL", { url });
}

async function markSetupComplete() {
  await sendMessage("SET_ONBOARDING_COMPLETED", { completed: true });
  trackUiEvent("onboarding_completed", {
    entry: "welcome_page"
  }).catch(() => {});
  elements.welcomeStatus.textContent = "Onboarding marked complete. The side panel checklist is now hidden.";
}

function handleWelcomeError(error, area) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  const details = {
    error_area: area,
    error_message: message,
    entry: "welcome_page"
  };

  elements.welcomeStatus.textContent = message;
  trackUiEvent("error_shown", details).catch(() => {});
  captureUiError(error, details).catch(() => {});
}

function getSupportTarget() {
  if (!isPlaceholderContact(APP_CONFIG.supportUrl)) {
    return APP_CONFIG.supportUrl;
  }
  return chrome.runtime.getURL(getLocalSupportFallback());
}

function bindEvents() {
  elements.openYouTubeButton.addEventListener("click", () => {
    openUrl("https://www.youtube.com").catch((error) => {
      handleWelcomeError(error, "open_youtube");
    });
  });

  elements.completeOnboardingButton.addEventListener("click", () => {
    markSetupComplete().catch((error) => {
      handleWelcomeError(error, "complete_onboarding");
    });
  });

  elements.openCheckoutButton.addEventListener("click", () => {
    if (!isBillingConfigured()) {
      trackUiEvent("paywall_viewed", {
        entry: "welcome_setup_notice"
      }).catch(() => {});
      elements.welcomeStatus.textContent = "Billing is not configured yet. Add your Polar checkout URL and organization ID in config.js.";
      return;
    }
    trackUiEvent("paywall_viewed", {
      entry: "welcome_checkout"
    }).catch(() => {});
    trackUiEvent("checkout_started", {
      provider: APP_CONFIG.billing.provider,
      entry: "welcome_checkout"
    }).catch(() => {});
    openUrl(APP_CONFIG.billing.checkoutUrl).catch((error) => {
      handleWelcomeError(error, "open_checkout");
    });
  });

  elements.openPrivacyButton.addEventListener("click", () => {
    const target = isPlaceholderContact(APP_CONFIG.privacyPolicyUrl)
      ? chrome.runtime.getURL("privacy.html")
      : APP_CONFIG.privacyPolicyUrl;
    openUrl(target).catch((error) => {
      handleWelcomeError(error, "open_privacy");
    });
  });

  elements.openSupportButton.addEventListener("click", () => {
    openUrl(getSupportTarget()).catch((error) => {
      handleWelcomeError(error, "open_support");
    });
  });

  elements.openReadmeButton.addEventListener("click", () => {
    openUrl(chrome.runtime.getURL("support.html")).catch((error) => {
      handleWelcomeError(error, "open_readme");
    });
  });
}

function init() {
  renderList(elements.stepsList, APP_CONFIG.onboardingSteps);
  renderList(elements.freeFeatures, getPlanDefinition("free").highlights);
  renderList(elements.proFeatures, getPlanDefinition("pro").highlights);
  elements.freePrice.textContent = getPlanDefinition("free").priceLabel;
  elements.proPrice.textContent = APP_CONFIG.billing.priceLabel || getPlanDefinition("pro").priceLabel;
  bindEvents();
}

init();
