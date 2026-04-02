import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Shim chrome.* before importing source modules.
await import("./chrome-shim.js");
const {
  PolarApiError,
  isSupportedYouTubeHost,
  isSupportedYouTubeWatchUrl,
  shouldClearLocalBillingStateAfterDeactivateError,
  shouldResetBillingStateAfterValidateError
} = await import("../background.js");

describe("isSupportedYouTubeWatchUrl", () => {
  it("accepts a standard YouTube watch URL", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://www.youtube.com/watch?v=abc123"), true);
  });

  it("accepts the bare youtube.com watch URL", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://youtube.com/watch?v=abc123"), true);
  });

  it("rejects YouTube homepage", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://www.youtube.com/"), false);
  });

  it("rejects YouTube search", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://www.youtube.com/results?search_query=test"), false);
  });

  it("rejects YouTube shorts", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://www.youtube.com/shorts/abc123"), false);
  });

  it("rejects non-YouTube URLs", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://example.com/watch?v=abc"), false);
  });

  it("rejects invalid URLs", () => {
    assert.equal(isSupportedYouTubeWatchUrl("not-a-url"), false);
  });

  it("rejects empty string", () => {
    assert.equal(isSupportedYouTubeWatchUrl(""), false);
  });

  it("rejects unsupported YouTube subdomains", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://music.youtube.com/watch?v=abc123"), false);
  });

  it("rejects deceptive hostnames that merely contain youtube.com", () => {
    assert.equal(isSupportedYouTubeWatchUrl("https://youtube.com.evil.example/watch?v=abc123"), false);
    assert.equal(isSupportedYouTubeWatchUrl("https://notyoutube.com/watch?v=abc123"), false);
  });
});

describe("isSupportedYouTubeHost", () => {
  it("accepts canonical YouTube hosts only", () => {
    assert.equal(isSupportedYouTubeHost("youtube.com"), true);
    assert.equal(isSupportedYouTubeHost("www.youtube.com"), true);
  });

  it("rejects unsupported or deceptive hosts", () => {
    assert.equal(isSupportedYouTubeHost("music.youtube.com"), false);
    assert.equal(isSupportedYouTubeHost("youtube.com.evil.example"), false);
  });
});

describe("Polar API error handling", () => {
  it("treats 404 validation failures as terminal", () => {
    assert.equal(shouldResetBillingStateAfterValidateError(new PolarApiError("Missing license", 404)), true);
  });

  it("preserves local access on retryable validation failures", () => {
    assert.equal(shouldResetBillingStateAfterValidateError(new PolarApiError("Provider unavailable", 503)), false);
    assert.equal(shouldResetBillingStateAfterValidateError(new Error("Network down")), false);
  });

  it("allows local deactivation cleanup only for terminal license states", () => {
    assert.equal(shouldClearLocalBillingStateAfterDeactivateError(new PolarApiError("Activation missing", 410)), true);
    assert.equal(shouldClearLocalBillingStateAfterDeactivateError(new PolarApiError("Provider unavailable", 503)), false);
  });
});

describe("pickCaptionTrack", () => {
  function pickCaptionTrack(captionTracks) {
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return null;
    }
    const manualEnglish = captionTracks.find((track) => track.languageCode?.startsWith("en") && !track.kind);
    const manualAny = captionTracks.find((track) => !track.kind);
    const autoEnglish = captionTracks.find((track) => track.languageCode?.startsWith("en"));
    return manualEnglish || manualAny || autoEnglish || captionTracks[0];
  }

  it("returns null for empty array", () => {
    assert.equal(pickCaptionTrack([]), null);
  });

  it("returns null for non-array", () => {
    assert.equal(pickCaptionTrack(null), null);
  });

  it("prefers manual English over auto", () => {
    const tracks = [
      { languageCode: "en", kind: "asr", baseUrl: "auto" },
      { languageCode: "en", baseUrl: "manual" }
    ];
    assert.equal(pickCaptionTrack(tracks).baseUrl, "manual");
  });

  it("prefers manual any language over auto English", () => {
    const tracks = [
      { languageCode: "en", kind: "asr", baseUrl: "auto-en" },
      { languageCode: "fr", baseUrl: "manual-fr" }
    ];
    assert.equal(pickCaptionTrack(tracks).baseUrl, "manual-fr");
  });

  it("falls back to auto English when no manual tracks exist", () => {
    const tracks = [
      { languageCode: "ja", kind: "asr", baseUrl: "auto-ja" },
      { languageCode: "en", kind: "asr", baseUrl: "auto-en" }
    ];
    assert.equal(pickCaptionTrack(tracks).baseUrl, "auto-en");
  });

  it("falls back to first track when nothing matches", () => {
    const tracks = [
      { languageCode: "ja", kind: "asr", baseUrl: "first" }
    ];
    assert.equal(pickCaptionTrack(tracks).baseUrl, "first");
  });
});

describe("sanitizeStudyPack", () => {
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

  it("uses provided id", () => {
    const pack = sanitizeStudyPack({ id: "vid1" });
    assert.equal(pack.id, "vid1");
  });

  it("defaults title to Untitled video", () => {
    const pack = sanitizeStudyPack({});
    assert.equal(pack.title, "Untitled video");
  });

  it("truncates transcriptExcerpt to 1800 chars", () => {
    const pack = sanitizeStudyPack({ transcriptExcerpt: "a".repeat(2000) });
    assert.equal(pack.transcriptExcerpt.length, 1800);
  });

  it("caps summary at 5 items", () => {
    const pack = sanitizeStudyPack({ summary: Array(10).fill("point") });
    assert.equal(pack.summary.length, 5);
  });

  it("caps flashcards at 10 items", () => {
    const cards = Array(15).fill({ front: "Q", back: "A" });
    const pack = sanitizeStudyPack({ flashcards: cards });
    assert.equal(pack.flashcards.length, 10);
  });

  it("filters flashcards with empty front or back", () => {
    const cards = [{ front: "Q", back: "" }, { front: "", back: "A" }, { front: "Q", back: "A" }];
    const pack = sanitizeStudyPack({ flashcards: cards });
    assert.equal(pack.flashcards.length, 1);
  });

  it("handles non-array flashcards gracefully", () => {
    const pack = sanitizeStudyPack({ flashcards: "not-an-array" });
    assert.deepEqual(pack.flashcards, []);
  });
});
