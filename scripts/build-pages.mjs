import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "site-src");
const outputDir = path.join(rootDir, "site");
const siteConfigPath = path.join(sourceDir, "site.json");

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, contents) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function expandIncludes(text) {
  return text.replace(/{{include:([^}]+)}}/g, (_match, relativePath) => {
    const includePath = path.resolve(rootDir, relativePath.trim());
    if (!fs.existsSync(includePath)) {
      throw new Error(`Missing include file: ${relativePath.trim()}`);
    }
    return readText(includePath).trim();
  });
}

function paragraphToHtml(lines) {
  return `<p>${renderInline(lines.join(" "))}</p>`;
}

function listToHtml(lines, ordered) {
  const tag = ordered ? "ol" : "ul";
  const items = lines
    .map((line) => line.replace(ordered ? /^\d+\.\s+/ : /^-\s+/, ""))
    .map((line) => `<li>${renderInline(line)}</li>`)
    .join("\n");
  return `<${tag}>\n${items}\n</${tag}>`;
}

function codeBlockToHtml(lines) {
  return `<pre><code>${escapeHtml(lines.join("\n"))}</code></pre>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let codeBlock = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(paragraphToHtml(paragraph));
      paragraph = [];
    }
  }

  function flushLists() {
    if (list.length) {
      blocks.push(listToHtml(list, false));
      list = [];
    }
    if (orderedList.length) {
      blocks.push(listToHtml(orderedList, true));
      orderedList = [];
    }
  }

  function flushCodeBlock() {
    if (codeBlock.length) {
      blocks.push(codeBlockToHtml(codeBlock));
      codeBlock = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushLists();
      if (inCodeBlock) {
        flushCodeBlock();
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeBlock.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushLists();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      orderedList = [];
      list.push(line);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      list = [];
      orderedList.push(line);
      continue;
    }

    flushLists();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushLists();
  flushCodeBlock();

  return blocks.join("\n\n");
}

function buildPageHtml(siteConfig, title, bodyHtml, currentPath) {
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Support", href: "/support/" },
    { label: "Privacy", href: "/privacy/" },
    { label: "Terms", href: "/terms/" },
    { label: "Changelog", href: "/changelog/" }
  ];

  const navigation = navItems
    .map((item) => {
      const active = item.href === currentPath ? ' aria-current="page"' : "";
      return `<a href="${item.href}"${active}>${item.label}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | ${escapeHtml(siteConfig.productName)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f3ea;
        --panel: #fffdf6;
        --ink: #14213d;
        --muted: #5c677d;
        --line: #d9d3c3;
        --accent: #b5651d;
        --accent-strong: #8f4a10;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(181, 101, 29, 0.16), transparent 35%),
          linear-gradient(180deg, #fbfaf5 0%, var(--bg) 100%);
      }
      a { color: var(--accent-strong); }
      .shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 20px 80px;
      }
      .hero {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 32px;
        box-shadow: 0 20px 50px rgba(20, 33, 61, 0.08);
      }
      .eyebrow {
        margin: 0 0 12px;
        color: var(--accent-strong);
        font-size: 13px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1, h2, h3 { line-height: 1.15; }
      h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3.4rem); }
      h2 { margin-top: 32px; }
      .tagline {
        margin: 0;
        color: var(--muted);
        font-size: 1.05rem;
      }
      .nav {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 24px 0 0;
      }
      .nav a {
        text-decoration: none;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.72);
      }
      .nav a[aria-current="page"] {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }
      .content {
        margin-top: 24px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 32px;
      }
      p, li { font-size: 1rem; line-height: 1.75; }
      ul, ol { padding-left: 20px; }
      code, pre {
        font-family: "Courier New", Courier, monospace;
        background: rgba(20, 33, 61, 0.05);
        border-radius: 6px;
      }
      code { padding: 0.15rem 0.35rem; }
      pre {
        padding: 16px;
        overflow: auto;
      }
      .footer {
        margin-top: 16px;
        color: var(--muted);
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Public Docs</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="tagline">${escapeHtml(siteConfig.tagline || "")}</p>
        <nav class="nav">${navigation}</nav>
      </section>
      <section class="content">
        ${bodyHtml}
      </section>
      <p class="footer">
        Repository: <a href="${escapeHtml(siteConfig.repositoryUrl)}">${escapeHtml(siteConfig.repositoryUrl)}</a>
      </p>
    </main>
  </body>
</html>`;
}

function pagePathFor(filename) {
  const basename = path.basename(filename, ".md");
  if (basename === "index") {
    return "/";
  }
  return `/${basename}/`;
}

function outputPathFor(filename) {
  const basename = path.basename(filename, ".md");
  if (basename === "index") {
    return path.join(outputDir, "index.html");
  }
  return path.join(outputDir, basename, "index.html");
}

if (!fs.existsSync(siteConfigPath)) {
  throw new Error("Missing site-src/site.json");
}

const siteConfig = JSON.parse(readText(siteConfigPath));
ensureDirectory(outputDir);
writeText(path.join(outputDir, ".nojekyll"), "");

const pageFiles = fs.readdirSync(sourceDir)
  .filter((file) => file.endsWith(".md"));

for (const file of pageFiles) {
  const filePath = path.join(sourceDir, file);
  const raw = expandIncludes(readText(filePath));
  const bodyHtml = markdownToHtml(raw);
  const firstHeading = raw.match(/^#\s+(.+)$/m);
  const title = firstHeading ? firstHeading[1].trim() : siteConfig.productName;
  const pageHtml = buildPageHtml(siteConfig, title, bodyHtml, pagePathFor(file));
  writeText(outputPathFor(file), pageHtml);
}

console.log(`Built ${pageFiles.length} public pages into ${outputDir}`);
