function decodeHtmlEntities(text) {
  return String(text || "").replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g, (_match, entity) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      case "nbsp":
        return " ";
      default: {
        if (entity.startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return _match;
      }
    }
  });
}

function normalizeTranscriptText(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function parseVttTimestamp(value) {
  const match = String(value || "").trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const milliseconds = Number(match[4] || 0);

  return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
}

export function looksLikeHtmlResponse(text, contentType = "") {
  const normalizedText = String(text || "").trimStart();
  const normalizedType = String(contentType || "").toLowerCase();

  return normalizedType.includes("text/html")
    || normalizedText.startsWith("<!DOCTYPE html")
    || normalizedText.startsWith("<html")
    || normalizedText.startsWith("<HTML");
}

export function buildTranscriptFetchCandidates(baseUrl) {
  if (!baseUrl) {
    return [];
  }

  const urls = [];
  const seen = new Set();

  function pushCandidate(inputUrl, extraParams = {}) {
    const url = new URL(inputUrl);
    Object.entries(extraParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    const href = url.toString();
    if (!seen.has(href)) {
      seen.add(href);
      urls.push(href);
    }
  }

  pushCandidate(baseUrl);
  pushCandidate(baseUrl, { fmt: "json3" });
  pushCandidate(baseUrl, { fmt: "vtt" });

  return urls;
}

export function parseXmlTranscript(xmlText) {
  const source = String(xmlText || "");
  if (!source.includes("<text")) {
    return [];
  }

  const segments = [];

  for (const match of source.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    const startMatch = attrs.match(/\bstart=(["'])(.*?)\1/);
    const durationMatch = attrs.match(/\bdur=(["'])(.*?)\1/);
    const text = normalizeTranscriptText(body);

    if (!text) {
      continue;
    }

    segments.push({
      start: Number(startMatch?.[2] || 0),
      duration: Number(durationMatch?.[2] || 0),
      text
    });
  }

  return segments;
}

export function parseJson3Transcript(jsonText) {
  let data;
  try {
    data = JSON.parse(String(jsonText || ""));
  } catch {
    return [];
  }

  const events = Array.isArray(data?.events) ? data.events : [];

  return events
    .map((event) => ({
      start: Number(event?.tStartMs || 0) / 1000,
      duration: Number(event?.dDurationMs || 0) / 1000,
      text: normalizeTranscriptText(
        Array.isArray(event?.segs)
          ? event.segs.map((segment) => segment?.utf8 || "").join("")
          : ""
      )
    }))
    .filter((segment) => segment.text);
}

export function parseWebVttTranscript(vttText) {
  const lines = String(vttText || "").replace(/\r/g, "").split("\n");
  const segments = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.includes("-->")) {
      continue;
    }

    const [startText, endText] = line.split("-->").map((part) => part.trim());
    const start = parseVttTimestamp(startText);
    const end = parseVttTimestamp(endText);

    if (start === null || end === null) {
      continue;
    }

    const textLines = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const cueLine = lines[cursor].trim();
      if (!cueLine) {
        index = cursor;
        break;
      }
      textLines.push(cueLine);
      if (cursor === lines.length - 1) {
        index = cursor;
      }
    }

    const text = normalizeTranscriptText(textLines.join(" "));
    if (!text) {
      continue;
    }

    segments.push({
      start,
      duration: Math.max(0, end - start),
      text
    });
  }

  return segments;
}

export function parseTranscriptResponse(responseText, contentType = "") {
  const text = String(responseText || "");
  if (!text.trim()) {
    throw new Error("YouTube returned an empty caption response.");
  }

  if (looksLikeHtmlResponse(text, contentType)) {
    throw new Error("YouTube returned an unreadable caption page instead of transcript data.");
  }

  const normalizedType = String(contentType || "").toLowerCase();
  const parsers = [];

  if (normalizedType.includes("json") || text.trimStart().startsWith("{")) {
    parsers.push(parseJson3Transcript, parseXmlTranscript, parseWebVttTranscript);
  } else if (normalizedType.includes("vtt") || text.trimStart().startsWith("WEBVTT")) {
    parsers.push(parseWebVttTranscript, parseXmlTranscript, parseJson3Transcript);
  } else {
    parsers.push(parseXmlTranscript, parseJson3Transcript, parseWebVttTranscript);
  }

  for (const parser of parsers) {
    const segments = parser(text);
    if (segments.length) {
      return segments;
    }
  }

  throw new Error("YouTube did not return readable caption lines for this video.");
}
