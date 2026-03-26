import fs from "node:fs";

const requiredFiles = [
  "research/source-log.md",
  "research/opportunity-brief.md",
  "research/competitor-matrix.md",
  "research/policy-risk.md",
  "research/ai-stack.md",
  "research/unit-economics.md",
  "research/go-no-go.md"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));

if (missing.length) {
  console.error("Missing research gate files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const goNoGo = fs.readFileSync("research/go-no-go.md", "utf8");
if (!/Status:\s*`?(Go|Conditional Go|No-Go|Pending)`?/i.test(goNoGo)) {
  console.error("research/go-no-go.md must contain a Status line.");
  process.exit(1);
}

console.log("Research gate OK");
