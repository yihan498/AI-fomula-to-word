"use strict";

/**
 * content-extractor.js
 *
 * Walk the current selection DOM and produce structured JSON:
 *
 *   { blocks: [ ...blockObjects ] }
 *
 * Block types:
 *   { type: "paragraph",    runs: [...] }
 *   { type: "formula_block", latex: "..." }
 *   { type: "heading",      level: 1-6, text: "..." }
 *   { type: "code",         text: "..." }
 *   { type: "list_item",    runs: [...] }
 *
 * Run types inside a paragraph/list_item:
 *   { type: "text",    content: "..." }
 *   { type: "formula", latex: "...", display: "inline" }
 */

const SERVER_URL = "http://127.0.0.1:5678";

// ── LaTeX extraction ──────────────────────────────────────────────────────

/**
 * Extract the original LaTeX string from a KaTeX container element.
 * KaTeX stores it in <annotation encoding="application/x-tex">.
 */
function extractLatex(katexEl) {
  const ann = katexEl.querySelector('annotation[encoding="application/x-tex"]');
  if (ann) return ann.textContent.trim();
  const anyAnn = katexEl.querySelector("annotation");
  if (anyAnn) return anyAnn.textContent.trim();
  return null;
}

// ── inline content extraction ─────────────────────────────────────────────

/**
 * Walk *el* and return an array of run objects representing inline content.
 * KaTeX spans are converted to formula runs; everything else becomes text.
 */
function extractInlineRuns(el) {
  const runs = [];

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) runs.push({ type: "text", content: text });
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const cls = node.classList;

    // Block formula embedded inline (unlikely but possible)
    if (cls.contains("katex-display")) {
      const latex = extractLatex(node);
      if (latex) runs.push({ type: "formula", latex, display: "block" });
      continue;
    }

    // Inline formula
    if (cls.contains("katex")) {
      const latex = extractLatex(node);
      if (latex) runs.push({ type: "formula", latex, display: "inline" });
      continue;
    }

    // KaTeX internals – skip entirely
    if (cls.contains("katex-html") || cls.contains("katex-mathml")) continue;

    // Recurse into any other element (strong, em, span, a, …)
    const childRuns = extractInlineRuns(node);
    runs.push(...childRuns);
  }

  return runs;
}

// ── block extraction ──────────────────────────────────────────────────────

const BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "pre", "blockquote", "table",
]);

/**
 * Process a single DOM node and push block(s) into *out*.
 */
function processNode(node, out) {
  // Plain text node at block level
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (text) out.push({ type: "paragraph", runs: [{ type: "text", content: node.textContent }] });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();
  const cls = node.classList;

  // ── standalone block formula ──────────────────────────────────────
  if (cls.contains("katex-display")) {
    const latex = extractLatex(node);
    if (latex) out.push({ type: "formula_block", latex });
    return;
  }

  // ── headings ──────────────────────────────────────────────────────
  if (/^h[1-6]$/.test(tag)) {
    out.push({ type: "heading", level: parseInt(tag[1], 10), text: node.textContent.trim() });
    return;
  }

  // ── code block ────────────────────────────────────────────────────
  if (tag === "pre") {
    const codeEl = node.querySelector("code");
    out.push({ type: "code", text: (codeEl || node).textContent });
    return;
  }

  // ── lists ─────────────────────────────────────────────────────────
  if (tag === "ul" || tag === "ol") {
    for (const li of node.querySelectorAll(":scope > li")) {
      out.push({ type: "list_item", runs: extractInlineRuns(li) });
    }
    return;
  }

  if (tag === "li") {
    out.push({ type: "list_item", runs: extractInlineRuns(node) });
    return;
  }

  // ── table ─────────────────────────────────────────────────────────
  if (tag === "table") {
    const rows = [];
    for (const tr of node.querySelectorAll("tr")) {
      const cells = [];
      for (const cell of tr.querySelectorAll("th, td")) {
        cells.push({
          isHeader: cell.tagName.toLowerCase() === "th",
          runs: extractInlineRuns(cell),
        });
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) out.push({ type: "table", rows });
    return;
  }

  // ── div / p / span / other: check children ────────────────────────
  // If it contains block-level children, recurse block-by-block.
  const hasBlockChild = Array.from(node.childNodes).some(
    (c) => c.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(c.tagName.toLowerCase())
  );

  if (hasBlockChild) {
    for (const child of node.childNodes) {
      processNode(child, out);
    }
    return;
  }

  // Otherwise treat as a paragraph with inline content
  const runs = extractInlineRuns(node);
  const nonEmpty = runs.filter((r) => r.type !== "text" || r.content.trim());
  if (nonEmpty.length > 0) {
    out.push({ type: "paragraph", runs });
  }
}

// ── public: build structured content ─────────────────────────────────────

/**
 * Build the full structured-content object from the current selection.
 * Returns null if there is no selection.
 */
function buildStructuredContent() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  // Clone selection into a temporary container
  const container = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) {
    container.appendChild(selection.getRangeAt(i).cloneContents());
  }

  const blocks = [];

  // Decide whether top-level children are block or inline
  const hasBlockChildren = Array.from(container.childNodes).some(
    (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(n.tagName.toLowerCase())
  );

  if (hasBlockChildren) {
    for (const child of container.childNodes) {
      processNode(child, blocks);
    }
  } else {
    // All inline – treat the whole selection as one paragraph
    const runs = extractInlineRuns(container);
    const nonEmpty = runs.filter((r) => r.type !== "text" || r.content.trim());
    if (nonEmpty.length > 0) {
      blocks.push({ type: "paragraph", runs });
    }
  }

  return { blocks };
}

// ── public: count formulas ────────────────────────────────────────────────

function countFormulas(structured) {
  if (!structured) return 0;
  return structured.blocks.reduce((n, b) => {
    if (b.type === "formula_block") return n + 1;
    if (b.runs) return n + b.runs.filter((r) => r.type === "formula").length;
    return n;
  }, 0);
}

// ── public: send to server + download ────────────────────────────────────

/**
 * POST structured content to the local server and trigger a .docx download.
 * Returns a Promise that resolves when the download has been triggered.
 */
async function exportToWord(structured) {
  const response = await fetch(`${SERVER_URL}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(structured),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const json = await response.json();
      msg = json.error || msg;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // 根据来源网站 + 日期动态命名
  const host = location.hostname || "";
  let siteName = "ai";
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) siteName = "chatgpt";
  else if (host.includes("chat.deepseek.com")) siteName = "deepseek";
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = new Date().toTimeString().slice(0, 5).replace(":", ""); // HHmm
  a.download = `${siteName}-${dateStr}-${timeStr}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── exports ───────────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.buildStructuredContent = buildStructuredContent;
  window.countFormulas          = countFormulas;
  window.exportToWord           = exportToWord;
  window.CGW_SERVER_URL         = SERVER_URL;
}
