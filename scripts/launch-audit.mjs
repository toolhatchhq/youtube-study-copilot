import fs from "node:fs";
import path from "node:path";

const strictMode = process.argv.includes("--strict");
const rootDir = process.cwd();

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "CURRENT_PRIORITIES.md",
  "docs/spec.md",
  "docs/roadmap.md",
  "docs/decisions.md",
  "ops/runbook.md",
  "ops/release-checklist.md",
  "analytics/events.md",
  "business/kpis.md",
  "site-src/site.json",
  "site-src/index.md",
  "site-src/support.md",
  "site-src/privacy.md",
  "site-src/terms.md",
  "site-src/changelog.md",
  "scripts/build-pages.mjs",
  "store/PRIVACY_POLICY.md",
  "store/RELEASE_CHECKLIST.md",
  "telemetry.js",
  ".github/workflows/deploy-pages.yml"
];

const placeholderMarkers = [
  "YOUR-ORG",
  "YOUR-STORE",
  "yourdomain.com",
  "support@yourdomain.com",
  "https://YOUR-ORG.github.io",
  "https://YOUR-STORE.lemonsqueezy.com"
];

const launchConfigFiles = [
  ".github/ISSUE_TEMPLATE/config.yml",
  "config.js",
  "manifest.json",
  "site-src/site.json",
  "site-src/support.md",
  "site-src/terms.md"
];

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

const missingFiles = requiredFiles.filter((file) => !exists(file));

const placeholders = [];

for (const relativePath of launchConfigFiles) {
  const file = path.join(rootDir, relativePath);
  if (!fs.existsSync(file)) {
    continue;
  }

  const contents = fs.readFileSync(file, "utf8");
  for (const marker of placeholderMarkers) {
    if (contents.includes(marker)) {
      placeholders.push({
        file: relativePath,
        marker
      });
    }
  }
}

const builtPages = [
  "site/index.html",
  "site/support/index.html",
  "site/privacy/index.html",
  "site/terms/index.html",
  "site/changelog/index.html"
];

const missingBuiltPages = builtPages.filter((file) => !exists(file));

if (missingFiles.length) {
  console.error("Missing required launch files:");
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
}

if (placeholders.length) {
  console.warn("Placeholder values still present:");
  for (const item of placeholders) {
    console.warn(`- ${item.file}: ${item.marker}`);
  }
}

if (missingBuiltPages.length) {
  console.warn("Pages output has not been built yet:");
  for (const file of missingBuiltPages) {
    console.warn(`- ${file}`);
  }
}

if (!missingFiles.length && !placeholders.length && !missingBuiltPages.length) {
  console.log("Launch audit passed with no unresolved items.");
}

const shouldFail = missingFiles.length > 0 || (strictMode && (placeholders.length > 0 || missingBuiltPages.length > 0));

if (shouldFail) {
  process.exit(1);
}
