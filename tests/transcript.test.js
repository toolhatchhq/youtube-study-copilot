import { describe, it } from "node:test";
import assert from "node:assert/strict";

await import("./chrome-shim.js");
const {
  buildTranscriptFetchCandidates,
  looksLikeHtmlResponse,
  parseJson3Transcript,
  parseTranscriptResponse,
  parseWebVttTranscript,
  parseXmlTranscript
} = await import("../transcript.js");

describe("buildTranscriptFetchCandidates", () => {
  it("includes xml, json3, and vtt candidates without duplicates", () => {
    const candidates = buildTranscriptFetchCandidates("https://www.youtube.com/api/timedtext?v=abc123&lang=en");

    assert.deepEqual(candidates, [
      "https://www.youtube.com/api/timedtext?v=abc123&lang=en",
      "https://www.youtube.com/api/timedtext?v=abc123&lang=en&fmt=json3",
      "https://www.youtube.com/api/timedtext?v=abc123&lang=en&fmt=vtt"
    ]);
  });
});

describe("looksLikeHtmlResponse", () => {
  it("detects html bodies and content types", () => {
    assert.equal(looksLikeHtmlResponse("<!DOCTYPE html><html></html>", ""), true);
    assert.equal(looksLikeHtmlResponse("", "text/html; charset=UTF-8"), true);
    assert.equal(looksLikeHtmlResponse("<transcript></transcript>", "text/xml"), false);
  });
});

describe("parseXmlTranscript", () => {
  it("parses YouTube xml captions", () => {
    const xml = '<transcript><text start="0.5" dur="1.2">Hello &amp; welcome</text><text start="1.7" dur="0.8">Let&#39;s begin</text></transcript>';
    const segments = parseXmlTranscript(xml);

    assert.deepEqual(segments, [
      { start: 0.5, duration: 1.2, text: "Hello & welcome" },
      { start: 1.7, duration: 0.8, text: "Let's begin" }
    ]);
  });
});

describe("parseJson3Transcript", () => {
  it("parses json3 caption events", () => {
    const json = JSON.stringify({
      events: [
        {
          tStartMs: 0,
          dDurationMs: 1200,
          segs: [{ utf8: "Hello " }, { utf8: "world" }]
        },
        {
          tStartMs: 1500,
          dDurationMs: 700,
          segs: [{ utf8: "How are you?" }]
        }
      ]
    });

    const segments = parseJson3Transcript(json);

    assert.deepEqual(segments, [
      { start: 0, duration: 1.2, text: "Hello world" },
      { start: 1.5, duration: 0.7, text: "How are you?" }
    ]);
  });
});

describe("parseWebVttTranscript", () => {
  it("parses webvtt captions", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.500 --> 00:00:01.700",
      "Hello world",
      "",
      "00:00:02.000 --> 00:00:03.000",
      "Second line"
    ].join("\n");

    const segments = parseWebVttTranscript(vtt);

    assert.deepEqual(segments, [
      { start: 0.5, duration: 1.2, text: "Hello world" },
      { start: 2, duration: 1, text: "Second line" }
    ]);
  });
});

describe("parseTranscriptResponse", () => {
  it("chooses xml parsing when given xml", () => {
    const segments = parseTranscriptResponse('<transcript><text start="0" dur="1">XML line</text></transcript>', "text/xml");
    assert.equal(segments[0].text, "XML line");
  });

  it("chooses json parsing when given json3", () => {
    const segments = parseTranscriptResponse(JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "JSON line" }] }]
    }), "application/json");
    assert.equal(segments[0].text, "JSON line");
  });

  it("chooses vtt parsing when given webvtt", () => {
    const segments = parseTranscriptResponse("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nVTT line", "text/vtt");
    assert.equal(segments[0].text, "VTT line");
  });

  it("throws a helpful error for html responses", () => {
    assert.throws(
      () => parseTranscriptResponse("<!DOCTYPE html><html><body>blocked</body></html>", "text/html"),
      /unreadable caption page/i
    );
  });
});
