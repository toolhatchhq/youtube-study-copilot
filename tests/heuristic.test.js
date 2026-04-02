import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Shim chrome.* before importing source modules.
await import("./chrome-shim.js");

// The heuristic functions are not exported from sidepanel.js (they are
// internal to the module). To test them in isolation we replicate the
// same logic here. This mirrors the pattern used in background.test.js.
// When the source changes, these copies must be kept in sync.

// ---------- shared helpers (copied from sidepanel.js) ----------

const stopwords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "for", "from", "had", "has",
  "have", "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our", "she",
  "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "what", "when",
  "where", "which", "who", "will", "with", "you", "your"
]);

const fillerWords = new Set([
  "actually", "basically", "really", "just", "like", "going", "gonna", "thing", "things", "stuff",
  "right", "well", "okay", "know", "think", "mean", "want", "need", "look", "kind", "sort", "sure",
  "something", "anything", "everything", "probably", "maybe", "also", "even", "still", "much", "very",
  "pretty", "quite", "little", "people", "guys", "way", "lot", "lots", "bit", "got", "get", "gets",
  "getting", "make", "makes", "made", "take", "come", "goes", "went", "said", "says", "tell", "told",
  "called", "talk", "talking", "start", "started", "point", "video", "today", "here", "now", "lets",
  "hey", "hello", "thanks", "thank", "welcome", "subscribe", "channel", "comment", "comments",
  "below", "click", "link", "description"
]);

function isContentWord(word) {
  return word.length > 2 && !stopwords.has(word) && !fillerWords.has(word);
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 1);
}

function splitSentences(text) {
  let prepared = text;
  if ((text.match(/[.!?]/g) || []).length < text.length / 300) {
    prepared = text.replace(/(.{100,180}?)\s/g, "$1.\n");
  }
  return prepared
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function scoreSentences(text, maxSentences = 5) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const sentenceTokens = sentences.map((s) => tokenize(s).filter(isContentWord));
  const total = sentenceTokens.length;
  const docFreq = new Map();
  for (const tokens of sentenceTokens) {
    for (const w of new Set(tokens)) { docFreq.set(w, (docFreq.get(w) || 0) + 1); }
  }
  const idf = (word) => Math.log(total / (docFreq.get(word) || 1));
  const scored = sentenceTokens.map((tokens, i) => {
    if (tokens.length === 0) return { index: i, score: 0 };
    const tfIdf = tokens.reduce((sum, w) => sum + idf(w), 0) / tokens.length;
    const pos = i / total;
    let posBonus = 0;
    if (pos < 0.15) posBonus = 0.3 * (1 - pos / 0.15);
    else if (pos > 0.9) posBonus = 0.15 * ((pos - 0.9) / 0.1);
    const len = sentences[i].length;
    let lenFactor = 1.0;
    if (len < 30) lenFactor = 0.3;
    else if (len < 60) lenFactor = 0.7;
    else if (len > 300) lenFactor = 0.6;
    else if (len > 250) lenFactor = 0.8;
    return { index: i, score: tfIdf * lenFactor + posBonus };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const candidate of scored) {
    if (picked.length >= maxSentences) break;
    const isDuplicate = picked.some((p) => jaccardSimilarity(sentences[candidate.index], sentences[p.index]) > 0.6);
    if (!isDuplicate) picked.push(candidate);
  }
  picked.sort((a, b) => a.index - b.index);
  return picked.map((p) => sentences[p.index].replace(/\s+/g, " ").trim());
}

function extractKeyConcepts(text, maxTerms = 6) {
  const words = tokenize(text);
  const total = words.length;
  if (total === 0) return [];
  const candidates = new Map();
  for (const w of words) {
    if (w.length > 3 && isContentWord(w)) {
      const entry = candidates.get(w);
      candidates.set(w, { count: (entry?.count || 0) + 1, type: "uni" });
    }
  }
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1];
    if (a.length > 2 && b.length > 2 && isContentWord(a) && isContentWord(b)) {
      const key = `${a} ${b}`;
      const entry = candidates.get(key);
      candidates.set(key, { count: (entry?.count || 0) + 1, type: "bi" });
    }
  }
  for (let i = 0; i < words.length - 2; i++) {
    const a = words[i], c = words[i + 2];
    if (a.length > 2 && c.length > 2 && isContentWord(a) && isContentWord(c)) {
      const key = `${a} ${words[i + 1]} ${c}`;
      const entry = candidates.get(key);
      candidates.set(key, { count: (entry?.count || 0) + 1, type: "tri" });
    }
  }
  const minCount = total < 500 ? 1 : 2;
  for (const [key, value] of candidates) { if (value.count < minCount) candidates.delete(key); }
  const scored = [];
  for (const [phrase, data] of candidates) {
    const tf = data.count / total;
    const ngramBonus = data.type === "tri" ? 1.8 : data.type === "bi" ? 1.5 : 1.0;
    const avgLen = phrase.replace(/\s/g, "").length / phrase.split(/\s+/).length;
    const lenBonus = Math.min(avgLen / 5, 1.5);
    scored.push({ phrase, score: tf * ngramBonus * lenBonus, count: data.count });
  }
  scored.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const candidate of scored) {
    if (selected.length >= maxTerms) break;
    const subsumed = selected.some((s) => s.phrase.includes(candidate.phrase) || candidate.phrase.includes(s.phrase));
    if (!subsumed) selected.push(candidate);
  }
  return selected.map((s) => s.phrase);
}

function findBestContext(concept, sentences) {
  let best = null, bestScore = -1;
  for (const s of sentences) {
    if (!s.toLowerCase().includes(concept)) continue;
    const contentWords = tokenize(s).filter(isContentWord);
    const score = Math.min(contentWords.length, 25);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

function buildCardFromContext(concept, sentence) {
  const lower = sentence.toLowerCase();
  if (/\b(because|since|due\s+to|causes?|leads?\s+to|results?\s+in)\b/.test(lower)) {
    return { front: `What causes or explains ${concept}?`, back: sentence.trim() };
  }
  if (/\b(important|essential|critical|should|must|need\s+to)\b/.test(lower)) {
    return { front: `Why is ${concept} important?`, back: sentence.trim() };
  }
  if (/\b(example|such\s+as|for\s+instance|e\.g\.|including)\b/.test(lower)) {
    return { front: `Give an example related to ${concept}.`, back: sentence.trim() };
  }
  if (/\d+\s*(%|percent|million|billion|thousand|times|years?)/.test(lower)) {
    return { front: `What key fact or figure is associated with ${concept}?`, back: sentence.trim() };
  }
  if (/\b(is|are|means|refers?\s+to|defined?\s+as)\b/.test(lower)) {
    return { front: `Define "${concept}" as discussed in this video.`, back: sentence.trim() };
  }
  return { front: `Explain what this video says about ${concept}.`, back: sentence.trim() };
}

function escapeRegExpChars(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateFillInBlank(sentence, keyConcepts) {
  const lower = sentence.toLowerCase();
  const concept = keyConcepts.find((c) => lower.includes(c));
  if (concept) {
    const blanked = sentence.replace(new RegExp(escapeRegExpChars(concept), "gi"), "________");
    return { question: `Fill in the blank: ${blanked}`, answer: concept };
  }
  const words = sentence.split(/\s+/);
  const content = words.filter((w) => w.length > 4 && isContentWord(w.toLowerCase().replace(/[^a-z]/g, "")));
  if (content.length > 0) {
    const target = content.reduce((a, b) => (a.length > b.length ? a : b));
    return { question: `Fill in the blank: ${sentence.replace(target, "________")}`, answer: target };
  }
  return null;
}

function generateWhyHowQuestion(sentence, keyConcepts) {
  const lower = sentence.toLowerCase();
  const concept = keyConcepts.find((c) => lower.includes(c));
  if (/\b(because|since|due to|causes?|leads?\s+to)\b/.test(lower)) {
    return { question: `What is the result or consequence of ${concept || "this point"}?`, answer: sentence.trim() };
  }
  if (concept) {
    return { question: `How does the video explain the significance of ${concept}?`, answer: sentence.trim() };
  }
  return { question: `Why is the following point emphasized? Hint: "${sentence.slice(0, 50)}..."`, answer: sentence.trim() };
}

function generateQuiz(summary, keyConcepts, maxQuestions = 5) {
  const generators = [generateFillInBlank, generateWhyHowQuestion];
  const quiz = [];
  for (let i = 0; i < Math.min(maxQuestions, summary.length); i++) {
    const gen = generators[i % generators.length];
    const item = gen(summary[i], keyConcepts);
    if (item) quiz.push(item);
  }
  return quiz;
}

function generateFlashcards(keyConcepts, allSentences, maxCards = 6) {
  const cards = [];
  for (const concept of keyConcepts) {
    if (cards.length >= maxCards) break;
    const ctx = findBestContext(concept, allSentences);
    if (!ctx) continue;
    cards.push(buildCardFromContext(concept, ctx));
  }
  return cards;
}

function buildHeuristicStudyPack(context, transcriptText) {
  const allSentences = splitSentences(transcriptText);
  const summary = scoreSentences(transcriptText);
  const keyConcepts = extractKeyConcepts(transcriptText, 6);
  const flashcards = generateFlashcards(keyConcepts, allSentences, 6);
  const quiz = generateQuiz(summary, keyConcepts, 5);
  return {
    summary: summary.length ? summary : [`This video covers ${context.title}.`],
    flashcards: flashcards.length ? flashcards : [{ front: `What is the main topic of "${context.title}"?`, back: `This video discusses ${context.title}.` }],
    quiz: quiz.length ? quiz : [{ question: `What are the key points from "${context.title}"?`, answer: summary[0] || `The video covers ${context.title}.` }]
  };
}

// ---------- sample transcript for testing ----------

const SAMPLE_TRANSCRIPT = `Machine learning is a subset of artificial intelligence that enables systems to learn from data. The algorithm identifies patterns in training data and uses them to make predictions. Neural networks are inspired by the human brain and consist of layers of interconnected nodes. Deep learning is a type of machine learning that uses neural networks with many layers. Supervised learning requires labeled data where each example has a known correct answer. Unsupervised learning finds hidden patterns in data without labeled examples. The model's performance is measured by comparing predictions against actual outcomes. Overfitting occurs when a model performs well on training data but poorly on new unseen data. Regularization techniques help prevent overfitting by adding constraints to the model. Transfer learning allows a model trained on one task to be applied to a different but related task. Gradient descent is the optimization algorithm used to minimize the error in neural networks. The learning rate determines how quickly the model updates its parameters during training. Feature engineering is the process of selecting and transforming input variables to improve model accuracy. Cross-validation splits the data into multiple folds to get a more reliable estimate of performance. Bias in machine learning can lead to unfair outcomes and must be carefully monitored and addressed.`;

const SHORT_TRANSCRIPT = "Deep learning uses neural networks. It is very powerful for image recognition tasks.";

const UNPUNCTUATED_TRANSCRIPT = "so today we are going to talk about machine learning and how it works in practice the basic idea is that you feed data into an algorithm and it learns patterns from that data then it can make predictions on new data it has never seen before this is really powerful because it means computers can solve problems without being explicitly programmed for every possible scenario the key thing to understand is that machine learning requires good quality training data without good data the model will not perform well";

// ---------- tests ----------

describe("splitSentences", () => {
  it("splits on punctuation", () => {
    const sentences = splitSentences(SAMPLE_TRANSCRIPT);
    assert.ok(sentences.length >= 10, `Expected >=10 sentences, got ${sentences.length}`);
  });

  it("handles unpunctuated text by inserting breaks", () => {
    const sentences = splitSentences(UNPUNCTUATED_TRANSCRIPT);
    assert.ok(sentences.length >= 2, `Expected >=2 sentences from unpunctuated text, got ${sentences.length}`);
  });

  it("filters sentences shorter than 20 chars", () => {
    const sentences = splitSentences("Hi. This is a much longer sentence that should be kept.");
    assert.ok(sentences.every((s) => s.length >= 20));
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(splitSentences(""), []);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical strings", () => {
    assert.equal(jaccardSimilarity("hello world", "hello world"), 1);
  });

  it("returns 0 for completely different strings", () => {
    assert.equal(jaccardSimilarity("hello world", "foo bar"), 0);
  });

  it("returns value between 0 and 1 for partial overlap", () => {
    const sim = jaccardSimilarity("hello world foo", "hello world bar");
    assert.ok(sim > 0 && sim < 1, `Expected 0 < sim < 1, got ${sim}`);
  });
});

describe("scoreSentences", () => {
  it("returns at most 5 sentences", () => {
    const result = scoreSentences(SAMPLE_TRANSCRIPT);
    assert.ok(result.length <= 5, `Expected <=5, got ${result.length}`);
    assert.ok(result.length >= 1, "Expected at least 1 sentence");
  });

  it("returns sentences in original transcript order", () => {
    const result = scoreSentences(SAMPLE_TRANSCRIPT);
    for (let i = 1; i < result.length; i++) {
      const posA = SAMPLE_TRANSCRIPT.indexOf(result[i - 1]);
      const posB = SAMPLE_TRANSCRIPT.indexOf(result[i]);
      assert.ok(posA < posB, `Sentence "${result[i - 1].slice(0, 30)}..." should appear before "${result[i].slice(0, 30)}..."`);
    }
  });

  it("does not return near-duplicate sentences", () => {
    const duplicateText = "Machine learning is great for solving problems. Machine learning is great for solving many problems. Deep learning uses neural networks for complex tasks. Computer vision analyzes images automatically. Natural language processing handles text data effectively.";
    const result = scoreSentences(duplicateText);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const sim = jaccardSimilarity(result[i], result[j]);
        assert.ok(sim <= 0.6, `Sentences too similar (${sim.toFixed(2)}): "${result[i].slice(0, 40)}" vs "${result[j].slice(0, 40)}"`);
      }
    }
  });

  it("handles short transcripts", () => {
    const result = scoreSentences(SHORT_TRANSCRIPT);
    assert.ok(result.length >= 0);
  });

  it("handles unpunctuated text", () => {
    const result = scoreSentences(UNPUNCTUATED_TRANSCRIPT);
    assert.ok(result.length >= 1, "Should extract at least 1 sentence from unpunctuated text");
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(scoreSentences(""), []);
  });
});

describe("extractKeyConcepts", () => {
  it("returns at most 6 concepts", () => {
    const result = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    assert.ok(result.length <= 6, `Expected <=6, got ${result.length}`);
    assert.ok(result.length >= 1, "Expected at least 1 concept");
  });

  it("extracts bigrams when they exist", () => {
    const result = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const hasBigram = result.some((c) => c.includes(" "));
    assert.ok(hasBigram, `Expected at least one bigram/trigram in: ${JSON.stringify(result)}`);
  });

  it("filters out filler words", () => {
    const result = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    for (const concept of result) {
      for (const word of concept.split(/\s+/)) {
        assert.ok(!fillerWords.has(word), `Filler word "${word}" found in concept "${concept}"`);
      }
    }
  });

  it("handles subsumption (prefers longer phrase over component)", () => {
    const text = "machine learning machine learning machine learning machine machine machine";
    const result = extractKeyConcepts(text, 3);
    const hasMachineLearning = result.some((c) => c === "machine learning");
    const hasStandaloneMachine = result.some((c) => c === "machine");
    if (hasMachineLearning) {
      assert.ok(!hasStandaloneMachine, "Should not have both 'machine learning' and standalone 'machine'");
    }
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(extractKeyConcepts(""), []);
  });
});

describe("buildCardFromContext", () => {
  it("detects definition pattern", () => {
    const card = buildCardFromContext("entropy", "Entropy is a measure of disorder in a system.");
    assert.ok(card.front.includes("Define"), `Expected definition question, got: ${card.front}`);
  });

  it("detects cause-effect pattern", () => {
    const card = buildCardFromContext("warming", "Warming occurs because greenhouse gases trap heat.");
    assert.ok(card.front.includes("causes") || card.front.includes("explains"), `Expected cause question, got: ${card.front}`);
  });

  it("detects importance pattern", () => {
    const card = buildCardFromContext("testing", "Testing is important for catching bugs early.");
    assert.ok(card.front.includes("important"), `Expected importance question, got: ${card.front}`);
  });

  it("detects example pattern", () => {
    const card = buildCardFromContext("algorithms", "For example, sorting algorithms include quicksort and mergesort.");
    assert.ok(card.front.includes("example"), `Expected example question, got: ${card.front}`);
  });

  it("detects factual/numeric pattern", () => {
    const card = buildCardFromContext("growth", "Growth increased by 50 percent over the last 5 years.");
    assert.ok(card.front.includes("fact") || card.front.includes("figure"), `Expected factual question, got: ${card.front}`);
  });

  it("falls back to general question", () => {
    const card = buildCardFromContext("topology", "Topology studies spatial properties preserved under deformation.");
    assert.ok(card.front.includes("Explain") || card.front.includes("Define"), `Expected general or definition question, got: ${card.front}`);
  });
});

describe("generateFlashcards", () => {
  it("returns at most maxCards flashcards", () => {
    const sentences = splitSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const cards = generateFlashcards(concepts, sentences, 6);
    assert.ok(cards.length <= 6);
    assert.ok(cards.length >= 1, "Expected at least 1 flashcard");
  });

  it("produces varied question types (not all identical fronts)", () => {
    const sentences = splitSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const cards = generateFlashcards(concepts, sentences, 6);
    if (cards.length >= 2) {
      const fronts = new Set(cards.map((c) => c.front.split(" ").slice(0, 2).join(" ")));
      assert.ok(fronts.size >= 2, `Expected varied question types, got: ${[...fronts].join(", ")}`);
    }
  });

  it("all cards have non-empty front and back", () => {
    const sentences = splitSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const cards = generateFlashcards(concepts, sentences, 6);
    for (const card of cards) {
      assert.ok(card.front.trim().length > 0, "Front should not be empty");
      assert.ok(card.back.trim().length > 0, "Back should not be empty");
    }
  });
});

describe("generateFillInBlank", () => {
  it("blanks a key concept when found", () => {
    const result = generateFillInBlank(
      "Machine learning is a subset of artificial intelligence.",
      ["machine learning", "artificial intelligence"]
    );
    assert.ok(result);
    assert.ok(result.question.includes("________"), `Expected blank in: ${result.question}`);
    assert.ok(!result.question.toLowerCase().includes("machine learning"), "Should have replaced the concept");
  });

  it("falls back to longest content word when no concept matches", () => {
    const result = generateFillInBlank(
      "The optimization algorithm minimizes prediction errors.",
      ["quantum computing"]
    );
    assert.ok(result);
    assert.ok(result.question.includes("________"));
  });
});

describe("generateQuiz", () => {
  it("returns at most maxQuestions items", () => {
    const summary = scoreSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const quiz = generateQuiz(summary, concepts, 5);
    assert.ok(quiz.length <= 5);
    assert.ok(quiz.length >= 1, "Expected at least 1 quiz question");
  });

  it("questions are not circular (question != answer)", () => {
    const summary = scoreSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const quiz = generateQuiz(summary, concepts, 5);
    for (const item of quiz) {
      assert.notEqual(item.question, item.answer, "Question should not equal answer");
      assert.ok(!item.question.includes(`key takeaway #`), "Should not use old circular template");
    }
  });

  it("all items have non-empty question and answer", () => {
    const summary = scoreSentences(SAMPLE_TRANSCRIPT);
    const concepts = extractKeyConcepts(SAMPLE_TRANSCRIPT);
    const quiz = generateQuiz(summary, concepts, 5);
    for (const item of quiz) {
      assert.ok(item.question.trim().length > 0);
      assert.ok(item.answer.trim().length > 0);
    }
  });
});

describe("buildHeuristicStudyPack (integration)", () => {
  it("returns valid pack structure", () => {
    const context = { title: "Intro to ML", author: "Dr. Smith", url: "https://youtube.com/watch?v=abc", videoId: "abc" };
    const pack = buildHeuristicStudyPack(context, SAMPLE_TRANSCRIPT);
    assert.ok(Array.isArray(pack.summary), "summary should be an array");
    assert.ok(Array.isArray(pack.flashcards), "flashcards should be an array");
    assert.ok(Array.isArray(pack.quiz), "quiz should be an array");
  });

  it("respects max limits", () => {
    const context = { title: "Intro to ML", author: "Dr. Smith" };
    const pack = buildHeuristicStudyPack(context, SAMPLE_TRANSCRIPT);
    assert.ok(pack.summary.length <= 5);
    assert.ok(pack.flashcards.length <= 6);
    assert.ok(pack.quiz.length <= 5);
  });

  it("produces fallbacks for very short transcripts", () => {
    const context = { title: "Short Video", author: "Author" };
    const pack = buildHeuristicStudyPack(context, "Hello.");
    assert.ok(pack.summary.length >= 1, "Should have at least 1 summary fallback");
    assert.ok(pack.flashcards.length >= 1, "Should have at least 1 flashcard fallback");
    assert.ok(pack.quiz.length >= 1, "Should have at least 1 quiz fallback");
  });

  it("handles unpunctuated transcript", () => {
    const context = { title: "Auto Captions", author: "Creator" };
    const pack = buildHeuristicStudyPack(context, UNPUNCTUATED_TRANSCRIPT);
    assert.ok(pack.summary.length >= 1);
  });

  it("flashcards have varied question types", () => {
    const context = { title: "Intro to ML", author: "Dr. Smith" };
    const pack = buildHeuristicStudyPack(context, SAMPLE_TRANSCRIPT);
    if (pack.flashcards.length >= 2) {
      const prefixes = new Set(pack.flashcards.map((c) => c.front.split(" ").slice(0, 2).join(" ")));
      assert.ok(prefixes.size >= 2, `Expected varied flashcard types, got: ${[...prefixes].join(", ")}`);
    }
  });

  it("quiz questions are not the old circular format", () => {
    const context = { title: "Intro to ML", author: "Dr. Smith" };
    const pack = buildHeuristicStudyPack(context, SAMPLE_TRANSCRIPT);
    for (const item of pack.quiz) {
      assert.ok(!item.question.includes("key takeaway #"), `Old circular format detected: ${item.question}`);
    }
  });
});
