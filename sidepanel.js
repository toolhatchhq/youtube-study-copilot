import {
  APP_CONFIG,
  getCurrentPlanId,
  getLocalSupportFallback,
  getPlanDefinition,
  hasExportAccess,
  isBillingConfigured,
  isPlaceholderContact
} from "./config.js";
import {
  captureUiError,
  trackUiEvent
} from "./telemetry.js";

const state = {
  billing: null,
  billingPermissionGranted: false,
  billingReady: false,
  context: null,
  displayedPackSource: null,
  licenseFormOpen: false,
  livePack: null,
  savedPacks: [],
  selectedSavedPackId: "",
  settings: null,
  transcriptSegments: [],
  transcriptText: ""
};

const stopwords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "for", "from", "had", "has",
  "have", "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our", "she",
  "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "what", "when",
  "where", "which", "who", "will", "with", "you", "your"
]);

const elements = {
  billingBadge: document.querySelector("#billing-badge"),
  billingCopy: document.querySelector("#billing-copy"),
  buildPackButton: document.querySelector("#build-pack-button"),
  captionStatus: document.querySelector("#caption-status"),
  checkoutButton: document.querySelector("#checkout-button"),
  clearLicenseButton: document.querySelector("#clear-license-button"),
  dismissOnboardingButton: document.querySelector("#dismiss-onboarding-button"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  exportJsonButton: document.querySelector("#export-json-button"),
  exportMarkdownButton: document.querySelector("#export-markdown-button"),
  exportPlanPill: document.querySelector("#export-plan-pill"),
  exportStatus: document.querySelector("#export-status"),
  exportTranscriptButton: document.querySelector("#export-transcript-button"),
  flashcardsList: document.querySelector("#flashcards-list"),
  freePlanList: document.querySelector("#free-plan-list"),
  freePlanPrice: document.querySelector("#free-plan-price"),
  licenseEmail: document.querySelector("#license-email"),
  licenseForm: document.querySelector("#license-form"),
  licenseKey: document.querySelector("#license-key"),
  licenseStatus: document.querySelector("#license-status"),
  loadTranscriptButton: document.querySelector("#load-transcript-button"),
  manageBillingButton: document.querySelector("#manage-billing-button"),
  onboardingCard: document.querySelector("#onboarding-card"),
  onboardingList: document.querySelector("#onboarding-list"),
  openPrivacyButton: document.querySelector("#open-privacy-button"),
  openSetupButton: document.querySelector("#open-setup-button"),
  openSupportButton: document.querySelector("#open-support-button"),
  openWelcomeButton: document.querySelector("#open-welcome-button"),
  openYouTubeButton: document.querySelector("#open-youtube-button"),
  packEmpty: document.querySelector("#pack-empty"),
  packSourceBadge: document.querySelector("#pack-source-badge"),
  planBadge: document.querySelector("#plan-badge"),
  proPlanList: document.querySelector("#pro-plan-list"),
  proPlanPrice: document.querySelector("#pro-plan-price"),
  quizList: document.querySelector("#quiz-list"),
  refreshButton: document.querySelector("#refresh-button"),
  refreshLicenseButton: document.querySelector("#refresh-license-button"),
  savePackButton: document.querySelector("#save-pack-button"),
  savedCount: document.querySelector("#saved-count"),
  savedPacks: document.querySelector("#saved-packs"),
  status: document.querySelector("#status"),
  summaryList: document.querySelector("#summary-list"),
  toggleLicenseFormButton: document.querySelector("#toggle-license-form-button"),
  transcriptLength: document.querySelector("#transcript-length"),
  transcriptPreview: document.querySelector("#transcript-preview"),
  videoAuthor: document.querySelector("#video-author"),
  videoMeta: document.querySelector("#video-meta"),
  videoTitle: document.querySelector("#video-title")
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

function setStatus(message) {
  elements.status.textContent = message;
}

function setLicenseStatus(message) {
  elements.licenseStatus.textContent = message;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtmlEntities(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${text}</body>`, "text/html");
  return doc.body.textContent || "";
}

function transcriptSegmentsToText(segments) {
  return segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
}

function getDisplayedPack() {
  if (state.displayedPackSource === "saved" && state.selectedSavedPackId) {
    return state.savedPacks.find((item) => item.id === state.selectedSavedPackId) || null;
  }
  return state.displayedPackSource === "live" ? state.livePack : null;
}

function getCurrentPlan() {
  return getCurrentPlanId(state.billing);
}

function getSupportTarget() {
  if (!isPlaceholderContact(APP_CONFIG.supportUrl)) {
    return APP_CONFIG.supportUrl;
  }
  return chrome.runtime.getURL(getLocalSupportFallback());
}

function getTelemetryContext(extra = {}) {
  const displayedPack = getDisplayedPack();
  return Object.fromEntries(
    Object.entries({
      video_id: state.context?.videoId || displayedPack?.id || "",
      caption_language: state.context?.captionTrack?.languageCode || displayedPack?.captionLanguage || "",
      ...extra
    }).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
  );
}

function queueEvent(event, properties = {}) {
  trackUiEvent(event, getTelemetryContext(properties)).catch(() => {});
}

function queueUiError(error, area, sink, extra = {}) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  const details = getTelemetryContext({
    error_area: area,
    error_message: message,
    ...extra
  });

  sink(message);
  trackUiEvent("error_shown", details).catch(() => {});
  captureUiError(error, details).catch(() => {});
}

function handleStatusError(error, area, extra = {}) {
  queueUiError(error, area, setStatus, extra);
}

function handleLicenseError(error, area, extra = {}) {
  queueUiError(error, area, setLicenseStatus, extra);
}

function renderPlanFeatures(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderOnboarding() {
  const hidden = Boolean(state.settings?.onboardingCompleted);
  elements.onboardingCard.classList.toggle("hidden", hidden);
  elements.onboardingList.innerHTML = "";
  APP_CONFIG.onboardingSteps.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    elements.onboardingList.appendChild(li);
  });
}

function renderVideoContext() {
  if (!state.context) {
    elements.videoMeta.classList.add("hidden");
    elements.videoTitle.textContent = "";
    elements.videoAuthor.textContent = "";
    elements.captionStatus.textContent = "";
    elements.loadTranscriptButton.disabled = true;
    elements.buildPackButton.disabled = true;
    elements.savePackButton.disabled = !(state.displayedPackSource === "live" && state.livePack);
    return;
  }

  elements.videoMeta.classList.remove("hidden");
  elements.videoTitle.textContent = state.context.title;
  elements.videoAuthor.textContent = state.context.author ? `by ${state.context.author}` : "";
  elements.captionStatus.textContent = state.context.captionTrack
    ? `Captions found: ${state.context.captionTrack.languageCode || state.context.captionTrack.name}`
    : "No captions detected for this video.";
  elements.loadTranscriptButton.disabled = !state.context.captionTrack;
  elements.buildPackButton.disabled = !state.transcriptText;
  elements.savePackButton.disabled = !(state.displayedPackSource === "live" && state.livePack);
}

function renderTranscript() {
  const preview = state.transcriptText ? state.transcriptText.slice(0, 1600) : "No transcript loaded yet.";
  elements.transcriptPreview.textContent = preview;
  elements.transcriptLength.textContent = `${state.transcriptText.length} chars`;
}

function renderSummary() {
  const summary = getDisplayedPack()?.summary || [];
  elements.summaryList.innerHTML = "";
  if (!summary.length) {
    elements.summaryList.innerHTML = "<li>No study pack generated yet.</li>";
    return;
  }
  summary.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    elements.summaryList.appendChild(li);
  });
}

function renderCardGroup(container, items, mode) {
  container.innerHTML = "";
  if (!items.length) {
    const card = document.createElement("article");
    card.className = "flashcard";
    card.innerHTML = `<h3>${mode === "quiz" ? "Question" : "Front"}</h3><p>No items yet.</p>`;
    container.appendChild(card);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "flashcard";
    card.innerHTML = mode === "quiz"
      ? `<h3>Question</h3><p>${escapeHtml(item.question)}</p><h3>Answer</h3><p>${escapeHtml(item.answer)}</p>`
      : `<h3>Front</h3><p>${escapeHtml(item.front)}</p><h3>Back</h3><p>${escapeHtml(item.back)}</p>`;
    container.appendChild(card);
  });
}

function renderStudyPack() {
  const pack = getDisplayedPack();
  elements.packSourceBadge.textContent = state.displayedPackSource === "saved"
    ? "Saved pack"
    : state.displayedPackSource === "live"
      ? "Current session"
      : "No pack";
  elements.packEmpty.classList.toggle("hidden", Boolean(pack));
  renderSummary();
  renderCardGroup(elements.flashcardsList, pack?.flashcards || [], "flashcards");
  renderCardGroup(elements.quizList, pack?.quiz || [], "quiz");
}

function renderBilling() {
  const freePlan = getPlanDefinition("free");
  const proPlan = getPlanDefinition("pro");
  const planId = getCurrentPlan();
  const active = Boolean(state.billing?.hasAccess);
  const checkoutConfigured = state.billingReady && isBillingConfigured();
  const portalConfigured = /^https:\/\//i.test(String(APP_CONFIG.billing.billingPortalUrl || "").trim());

  elements.planBadge.textContent = planId === "pro" ? "Pro" : "Free";
  elements.billingBadge.textContent = active ? "Pro active" : "Free plan";
  elements.billingCopy.textContent = active
    ? `Pro is active on this device. You now have ${proPlan.saveLimit} local save slots and ${proPlan.exports.join(", ")} exports.`
    : `Save the latest ${freePlan.saveLimit} packs locally and export Markdown for free. Upgrade for CSV, JSON, transcript export, and a ${proPlan.saveLimit}-pack archive.`;

  elements.freePlanPrice.textContent = freePlan.priceLabel;
  elements.proPlanPrice.textContent = APP_CONFIG.billing.priceLabel || proPlan.priceLabel;
  renderPlanFeatures(elements.freePlanList, freePlan.highlights);
  renderPlanFeatures(elements.proPlanList, proPlan.highlights);

  elements.checkoutButton.disabled = !checkoutConfigured;
  elements.checkoutButton.textContent = checkoutConfigured ? "Unlock Pro" : "Setup Billing";
  elements.toggleLicenseFormButton.disabled = !checkoutConfigured;
  elements.toggleLicenseFormButton.textContent = state.licenseFormOpen ? "Hide License Form" : "Activate License";
  elements.refreshLicenseButton.classList.toggle("hidden", !state.billing?.licenseKey);
  elements.manageBillingButton.classList.toggle("hidden", !portalConfigured);
  elements.clearLicenseButton.disabled = !state.billing?.licenseKey;
  elements.licenseForm.classList.toggle("hidden", !state.licenseFormOpen);

  if (active) {
    const name = state.billing.customerName ? ` for ${state.billing.customerName}` : "";
    const validated = state.billing.lastValidatedAt ? ` Last checked ${formatDate(state.billing.lastValidatedAt)}.` : "";
    setLicenseStatus(`Pro active${name}. ${state.billing.maskedLicenseKey || ""}${validated}`.trim());
  } else if (!checkoutConfigured) {
    setLicenseStatus("Add your Polar checkout URL and organization ID in config.js to turn on Pro billing.");
  } else if (state.billing?.lastError) {
    setLicenseStatus(state.billing.lastError);
  } else {
    setLicenseStatus("License requests talk to Polar only when you activate, refresh, or deactivate Pro.");
  }
}

function renderExports() {
  const pack = getDisplayedPack();
  const planId = getCurrentPlan();
  const hasPack = Boolean(pack);
  const transcriptReady = state.displayedPackSource === "live" && Boolean(state.transcriptText);

  elements.exportPlanPill.textContent = planId === "pro" ? "All exports unlocked" : "Markdown free";
  elements.exportMarkdownButton.disabled = !(hasPack && hasExportAccess(planId, "markdown"));
  elements.exportCsvButton.disabled = !(hasPack && hasExportAccess(planId, "csv"));
  elements.exportJsonButton.disabled = !(hasPack && hasExportAccess(planId, "json"));
  elements.exportTranscriptButton.disabled = !(hasPack && transcriptReady && hasExportAccess(planId, "transcript"));

  if (!hasPack) {
    elements.exportStatus.textContent = "Generate or load a study pack to export it.";
  } else if (planId === "free") {
    elements.exportStatus.textContent = "Markdown export is free. CSV, JSON, and transcript export unlock with Pro.";
  } else if (!transcriptReady) {
    elements.exportStatus.textContent = "Transcript export needs captions loaded in the current session. Markdown, CSV, and JSON are ready.";
  } else {
    elements.exportStatus.textContent = "Your current pack is ready for Markdown, CSV, JSON, and transcript export.";
  }
}

function renderSavedPacks() {
  elements.savedCount.textContent = String(state.savedPacks.length);
  elements.savedPacks.innerHTML = "";
  if (!state.savedPacks.length) {
    elements.savedPacks.innerHTML = '<p class="muted">Nothing saved yet.</p>';
    return;
  }

  state.savedPacks.forEach((item) => {
    const wrapper = document.createElement("article");
    wrapper.className = `saved-item${state.displayedPackSource === "saved" && state.selectedSavedPackId === item.id ? " active" : ""}`;
    wrapper.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p class="muted">${escapeHtml(formatDate(item.createdAt))}</p>
      <p class="muted tiny">${escapeHtml(item.captionLanguage || "Unknown captions")} · ${(item.flashcards || []).length} cards · ${(item.quiz || []).length} quiz prompts</p>
      <div class="saved-actions">
        <button type="button" class="ghost small" data-action="load" data-pack-id="${escapeHtml(item.id)}">Load</button>
        <button type="button" class="ghost small" data-action="delete" data-pack-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    `;
    elements.savedPacks.appendChild(wrapper);
  });
}

function renderAll() {
  renderOnboarding();
  renderVideoContext();
  renderTranscript();
  renderStudyPack();
  renderBilling();
  renderExports();
  renderSavedPacks();
}

async function fetchTranscript(baseUrl) {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Transcript fetch failed with status ${response.status}.`);
  }
  const xmlText = await response.text();
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  return Array.from(xml.querySelectorAll("text"))
    .map((node) => ({
      start: Number(node.getAttribute("start") || 0),
      duration: Number(node.getAttribute("dur") || 0),
      text: decodeHtmlEntities(node.textContent || "").replace(/\s+/g, " ").trim()
    }))
    .filter((segment) => segment.text);
}

function pickTopSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40)
    .sort((left, right) => right.length - left.length)
    .slice(0, 5);
}

function extractKeyTerms(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word));
  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([word]) => word);
}

function buildHeuristicStudyPack(context, transcriptText) {
  const summary = pickTopSentences(transcriptText).map((sentence) => sentence.replace(/\s+/g, " ").trim());
  const keyTerms = extractKeyTerms(transcriptText);
  const flashcards = keyTerms.map((term) => {
    const sentence = transcriptText
      .split(/(?<=[.!?])\s+/)
      .find((candidate) => candidate.toLowerCase().includes(term)) || `The video discusses ${term}.`;
    return {
      front: `What does "${term}" refer to in "${context.title}"?`,
      back: sentence.trim()
    };
  });
  const quiz = summary.slice(0, 4).map((item, index) => ({
    question: `What is a key takeaway #${index + 1} from this video?`,
    answer: item
  }));
  return {
    summary: summary.length ? summary : [`This video covers ${context.title}.`],
    flashcards,
    quiz
  };
}

function cleanJsonText(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text.trim();
}

async function buildWithPromptApi(context, transcriptText) {
  if (!globalThis.LanguageModel) {
    throw new Error("Chrome Prompt API is not available in this environment.");
  }
  const availability = await globalThis.LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error("Chrome Prompt API is unavailable on this device.");
  }
  const session = await globalThis.LanguageModel.create();
  try {
    const prompt = `
You are creating concise study materials from a YouTube transcript.
Return JSON only.
{
  "summary": ["string"],
  "flashcards": [{"front": "string", "back": "string"}],
  "quiz": [{"question": "string", "answer": "string"}]
}
Rules:
- 5 summary bullets max
- 6 flashcards max
- 5 quiz questions max
- use clear, practical language
- focus on concrete takeaways
Video title: ${context.title}
Author: ${context.author || "Unknown"}
Description: ${context.shortDescription?.slice(0, 500) || "None"}
Transcript:
${transcriptText.slice(0, 20000)}
`;
    const raw = await session.prompt(prompt);
    const parsed = JSON.parse(cleanJsonText(raw));
    return {
      summary: Array.isArray(parsed.summary) ? parsed.summary.slice(0, 5) : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards.slice(0, 6) : [],
      quiz: Array.isArray(parsed.quiz) ? parsed.quiz.slice(0, 5) : []
    };
  } finally {
    session.destroy?.();
  }
}

function buildLivePack(context, generatedPack) {
  return {
    id: context.videoId,
    title: context.title,
    url: context.url,
    author: context.author,
    captionLanguage: context.captionTrack?.languageCode || "",
    createdAt: new Date().toISOString(),
    transcriptExcerpt: state.transcriptText.slice(0, 1800),
    summary: generatedPack.summary,
    flashcards: generatedPack.flashcards,
    quiz: generatedPack.quiz
  };
}

async function refreshContext() {
  setStatus("Checking the current tab...");
  state.context = await sendMessage("GET_ACTIVE_VIDEO_CONTEXT");
  state.livePack = null;
  state.transcriptSegments = [];
  state.transcriptText = "";
  if (state.displayedPackSource === "live") {
    state.displayedPackSource = null;
  }

  if (!state.context) {
    setStatus("Open a YouTube watch page with a video selected.");
  } else if (!state.context.captionTrack) {
    setStatus("This video was found, but no captions are available.");
  } else {
    setStatus("Ready to load transcript.");
  }
  renderAll();
}

async function loadTranscript() {
  if (!state.context?.captionTrack?.baseUrl) {
    setStatus("No caption track is available.");
    return;
  }
  setStatus("Loading transcript...");
  state.transcriptSegments = await fetchTranscript(state.context.captionTrack.baseUrl);
  state.transcriptText = transcriptSegmentsToText(state.transcriptSegments);
  state.livePack = null;
  if (state.displayedPackSource === "live") {
    state.displayedPackSource = null;
  }
  setStatus(`Transcript loaded with ${state.transcriptSegments.length} caption lines.`);
  renderAll();
}

async function markOnboardingComplete(silent = false, source = "sidepanel") {
  const alreadyCompleted = Boolean(state.settings?.onboardingCompleted);
  state.settings = await sendMessage("SET_ONBOARDING_COMPLETED", { completed: true });
  if (!alreadyCompleted) {
    queueEvent("onboarding_completed", {
      entry: source
    });
  }
  renderOnboarding();
  if (!silent) {
    setStatus("Onboarding checklist hidden. You can reopen the guide anytime.");
  }
}

async function buildStudyPack() {
  if (!state.context || !state.transcriptText) {
    setStatus("Load a transcript first.");
    return;
  }
  setStatus("Building study pack...");
  let generationMode = "prompt_api";
  try {
    state.livePack = buildLivePack(state.context, await buildWithPromptApi(state.context, state.transcriptText));
    setStatus("Study pack generated with Chrome built-in AI.");
  } catch (error) {
    generationMode = "fallback";
    state.livePack = buildLivePack(state.context, buildHeuristicStudyPack(state.context, state.transcriptText));
    setStatus(`Built fallback study pack. ${error.message}`);
  }
  state.selectedSavedPackId = "";
  state.displayedPackSource = "live";
  queueEvent("core_action_completed", {
    generation_mode: generationMode
  });
  await markOnboardingComplete(true, "core_action");
  renderAll();
}

async function saveStudyPack() {
  if (!state.livePack) {
    setStatus("Generate a study pack first.");
    return;
  }
  const result = await sendMessage("SAVE_STUDY_PACK", state.livePack);
  state.savedPacks = result.packs;
  renderSavedPacks();
  setStatus(result.meta?.trimmed
    ? `Study pack saved. Your ${result.meta.planId} plan keeps the latest ${result.meta.saveLimit} packs locally.`
    : "Study pack saved locally.");
}

async function deleteStudyPack(packId) {
  state.savedPacks = await sendMessage("DELETE_STUDY_PACK", { id: packId });
  if (state.selectedSavedPackId === packId) {
    state.selectedSavedPackId = "";
    state.displayedPackSource = null;
  }
  renderAll();
  setStatus("Saved pack removed.");
}

function loadSavedPack(packId) {
  const pack = state.savedPacks.find((item) => item.id === packId);
  if (!pack) {
    setStatus("That saved pack could not be found.");
    return;
  }
  state.selectedSavedPackId = packId;
  state.displayedPackSource = "saved";
  renderAll();
  setStatus(`Loaded saved pack for "${pack.title}".`);
}

function sanitizeFilename(value) {
  return String(value || "study-pack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "study-pack";
}

function buildMarkdownExport(pack) {
  const summary = pack.summary.map((item) => `- ${item}`).join("\n");
  const flashcards = pack.flashcards.map((item, index) => `${index + 1}. **${item.front}**\n   - ${item.back}`).join("\n");
  const quiz = pack.quiz.map((item, index) => `${index + 1}. ${item.question}\n   - ${item.answer}`).join("\n");
  return `# ${pack.title}

- Source: ${pack.url || "N/A"}
- Author: ${pack.author || "Unknown"}
- Captions: ${pack.captionLanguage || "Unknown"}
- Created: ${formatDate(pack.createdAt) || pack.createdAt}

## Summary
${summary || "- No summary available."}

## Flashcards
${flashcards || "1. No flashcards available."}

## Quiz
${quiz || "1. No quiz questions available."}
`;
}

function csvRow(values) {
  return values.map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",");
}

function buildFlashcardsCsv(pack) {
  return [csvRow(["front", "back"]), ...pack.flashcards.map((item) => csvRow([item.front, item.back]))].join("\n");
}

function buildJsonExport(pack) {
  return JSON.stringify({ ...pack, exportedAt: new Date().toISOString(), plan: getCurrentPlan() }, null, 2);
}

function buildTranscriptExport() {
  if (!state.transcriptText) {
    throw new Error("Load captions in the current session to export the transcript.");
  }
  return state.transcriptText;
}

function downloadTextFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function requirePack() {
  const pack = getDisplayedPack();
  if (!pack) {
    throw new Error("Generate or load a study pack before exporting.");
  }
  return pack;
}

function requireExportAccess(format) {
  if (!hasExportAccess(getCurrentPlan(), format)) {
    throw new Error(`${format.toUpperCase()} export is part of Study Copilot Pro.`);
  }
}

async function exportPack(format) {
  const pack = requirePack();
  const base = `${sanitizeFilename(pack.title)}-${sanitizeFilename(format)}`;
  if (format === "markdown") {
    requireExportAccess("markdown");
    downloadTextFile(`${base}.md`, "text/markdown;charset=utf-8", buildMarkdownExport(pack));
  } else if (format === "csv") {
    requireExportAccess("csv");
    downloadTextFile(`${base}.csv`, "text/csv;charset=utf-8", buildFlashcardsCsv(pack));
  } else if (format === "json") {
    requireExportAccess("json");
    downloadTextFile(`${base}.json`, "application/json;charset=utf-8", buildJsonExport(pack));
  } else if (format === "transcript") {
    requireExportAccess("transcript");
    downloadTextFile(`${base}.txt`, "text/plain;charset=utf-8", buildTranscriptExport());
  } else {
    throw new Error("Unsupported export format.");
  }
  queueEvent("export_used", {
    format
  });
  setStatus(`${format.toUpperCase()} export is downloading.`);
}

async function openUrl(url) {
  await sendMessage("OPEN_URL", { url });
}

async function ensureBillingPermission() {
  if (!state.billingReady) {
    return false;
  }
  const origin = APP_CONFIG.billing.licenseApiOrigin;
  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (granted) {
    state.billingPermissionGranted = true;
    return true;
  }
  state.billingPermissionGranted = await chrome.permissions.request({ origins: [origin] });
  return state.billingPermissionGranted;
}

async function openCheckout() {
  if (!state.billingReady) {
    state.licenseFormOpen = true;
    renderBilling();
    queueEvent("paywall_viewed", {
      entry: "billing_setup_notice"
    });
    setLicenseStatus("Set your Polar checkout URL and organization ID in config.js before shipping Pro billing.");
    return;
  }
  queueEvent("paywall_viewed", {
    entry: "checkout_button"
  });
  queueEvent("checkout_started", {
    provider: APP_CONFIG.billing.provider,
    entry: "checkout_button"
  });
  await openUrl(APP_CONFIG.billing.checkoutUrl);
}

async function refreshLicense() {
  if (!state.billing?.licenseKey) {
    setLicenseStatus("Paste a license key first, then activate Pro.");
    return;
  }
  if (!await ensureBillingPermission()) {
    setLicenseStatus("License refresh needs permission to contact api.polar.sh.");
    return;
  }
  setLicenseStatus("Refreshing Pro access...");
  state.billing = await sendMessage("VALIDATE_PRO_LICENSE");
  renderBilling();
  renderExports();
  setLicenseStatus(state.billing.hasAccess ? "Pro access refreshed successfully." : state.billing.lastError || "This device has been returned to the free plan.");
}

async function activateLicense(event) {
  event.preventDefault();
  if (!state.billingReady) {
    setLicenseStatus("Billing is not configured yet. Update config.js first.");
    return;
  }
  if (!await ensureBillingPermission()) {
    setLicenseStatus("License activation needs permission to contact api.polar.sh.");
    return;
  }
  setLicenseStatus("Activating Pro...");
  state.billing = await sendMessage("ACTIVATE_PRO_LICENSE", {
    email: elements.licenseEmail.value.trim(),
    licenseKey: elements.licenseKey.value.trim()
  });
  elements.licenseEmail.value = state.billing.email || elements.licenseEmail.value.trim();
  elements.licenseKey.value = "";
  renderBilling();
  renderExports();
  setLicenseStatus("Pro is now active on this device.");
}

async function clearLicense() {
  if (!state.billing?.licenseKey) {
    setLicenseStatus("There is no active license on this device.");
    return;
  }
  setLicenseStatus("Deactivating this device...");
  const result = await sendMessage("CLEAR_PRO_LICENSE");
  state.billing = result.billing;
  renderBilling();
  renderExports();
  setLicenseStatus(result.note || "Local Pro access was removed from this device.");
}

async function loadBootstrap() {
  const bootstrap = await sendMessage("GET_APP_BOOTSTRAP");
  state.billing = bootstrap.billing;
  state.billingPermissionGranted = bootstrap.billingPermissionGranted;
  state.billingReady = bootstrap.billingReady;
  state.savedPacks = Array.isArray(bootstrap.savedPacks) ? bootstrap.savedPacks : [];
  state.settings = bootstrap.settings || {};
  elements.licenseEmail.value = state.billing?.email || "";
  renderAll();
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => refreshContext().catch((error) => handleStatusError(error, "refresh_context")));
  elements.loadTranscriptButton.addEventListener("click", () => loadTranscript().catch((error) => handleStatusError(error, "load_transcript")));
  elements.buildPackButton.addEventListener("click", () => buildStudyPack().catch((error) => handleStatusError(error, "build_pack")));
  elements.savePackButton.addEventListener("click", () => saveStudyPack().catch((error) => handleStatusError(error, "save_pack")));
  elements.exportMarkdownButton.addEventListener("click", () => exportPack("markdown").catch((error) => handleStatusError(error, "export_markdown")));
  elements.exportCsvButton.addEventListener("click", () => exportPack("csv").catch((error) => handleStatusError(error, "export_csv")));
  elements.exportJsonButton.addEventListener("click", () => exportPack("json").catch((error) => handleStatusError(error, "export_json")));
  elements.exportTranscriptButton.addEventListener("click", () => exportPack("transcript").catch((error) => handleStatusError(error, "export_transcript")));
  elements.checkoutButton.addEventListener("click", () => openCheckout().catch((error) => handleLicenseError(error, "checkout")));
  elements.toggleLicenseFormButton.addEventListener("click", () => {
    if (!state.licenseFormOpen) {
      queueEvent("paywall_viewed", {
        entry: "license_form_toggle"
      });
    }
    state.licenseFormOpen = !state.licenseFormOpen;
    renderBilling();
  });
  elements.refreshLicenseButton.addEventListener("click", () => refreshLicense().catch((error) => handleLicenseError(error, "refresh_license")));
  elements.manageBillingButton.addEventListener("click", () => openUrl(APP_CONFIG.billing.billingPortalUrl).catch((error) => handleLicenseError(error, "billing_portal")));
  elements.licenseForm.addEventListener("submit", (event) => activateLicense(event).catch((error) => handleLicenseError(error, "activate_license")));
  elements.clearLicenseButton.addEventListener("click", () => clearLicense().catch((error) => handleLicenseError(error, "clear_license")));
  elements.dismissOnboardingButton.addEventListener("click", () => markOnboardingComplete(false, "sidepanel_dismiss").catch((error) => handleStatusError(error, "complete_onboarding")));
  elements.openWelcomeButton.addEventListener("click", () => openUrl(chrome.runtime.getURL("welcome.html")).catch((error) => handleStatusError(error, "open_welcome")));
  elements.openYouTubeButton.addEventListener("click", () => openUrl("https://www.youtube.com").catch((error) => handleStatusError(error, "open_youtube")));
  elements.openPrivacyButton.addEventListener("click", () => {
    const target = isPlaceholderContact(APP_CONFIG.privacyPolicyUrl) ? chrome.runtime.getURL("privacy.html") : APP_CONFIG.privacyPolicyUrl;
    openUrl(target).catch((error) => handleStatusError(error, "open_privacy"));
  });
  elements.openSupportButton.addEventListener("click", () => openUrl(getSupportTarget()).catch((error) => handleStatusError(error, "open_support")));
  elements.openSetupButton.addEventListener("click", () => openUrl(chrome.runtime.getURL("welcome.html")).catch((error) => handleStatusError(error, "open_setup")));
  elements.savedPacks.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button?.dataset.packId) {
      return;
    }
    if (button.dataset.action === "load") {
      loadSavedPack(button.dataset.packId);
    } else if (button.dataset.action === "delete") {
      deleteStudyPack(button.dataset.packId).catch((error) => handleStatusError(error, "delete_pack"));
    }
  });
}

async function init() {
  bindEvents();
  await loadBootstrap();
  await refreshContext();
}

init().catch((error) => handleStatusError(error, "init"));
