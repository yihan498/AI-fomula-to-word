"use strict";

/**
 * copy-handler.js  (路径 B 版本)
 *
 * 拦截 ChatGPT 助手回复区的 Ctrl+C：
 *  - 无公式 → 放行浏览器原生复制（不拦截）
 *  - 有公式 → 阻断默认复制，把结构化内容 POST 给本地服务器，
 *              服务器返回 .docx，扩展自动触发文件下载。
 *
 * 依赖（由 manifest.json 在此脚本之前注入）：
 *   content-extractor.js → buildStructuredContent, countFormulas, exportToWord
 */

// ── 判断选区是否在助手回复内 ─────────────────────────────────────────────

function selectionTouchesResponse() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  for (const node of [sel.anchorNode, sel.focusNode]) {
    if (!node) continue;
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (!el.getAttribute) { el = el.parentElement; continue; }
      if (el.getAttribute("data-message-author-role") === "assistant") return true;
      if (el.classList && el.classList.contains("markdown"))            return true;
      if (el.classList && el.classList.contains("prose"))               return true;
      el = el.parentElement;
    }
  }
  return false;
}

// ── toast 提示 ────────────────────────────────────────────────────────────

function showToast(state, formulaCount, detail) {
  const existing = document.getElementById("cgw-toast");
  if (existing) existing.remove();

  const messages = {
    loading: `正在生成 Word 文件（含 ${formulaCount} 个公式）…`,
    success: `已下载 Word 文件（${formulaCount} 个公式）`,
    error:   `生成失败：${detail || "请检查本地服务器是否运行"}`,
    native:  "已复制（纯文本，无公式需转换）",
  };

  const colors = {
    loading: "#1e40af",
    success: "#166534",
    error:   "#991b1b",
    native:  "#1e293b",
  };

  const toast = document.createElement("div");
  toast.id = "cgw-toast";
  toast.textContent = messages[state] || state;

  Object.assign(toast.style, {
    position:     "fixed",
    top:          "16px",
    right:        "16px",
    zIndex:       "999999",
    background:   colors[state] || "#1e293b",
    color:        "#f8fafc",
    padding:      "10px 18px",
    borderRadius: "8px",
    fontSize:     "13px",
    fontFamily:   "system-ui, sans-serif",
    boxShadow:    "0 4px 14px rgba(0,0,0,0.35)",
    maxWidth:     "340px",
    lineHeight:   "1.4",
    opacity:      "1",
    transition:   "opacity 0.3s",
    pointerEvents:"none",
  });

  document.body.appendChild(toast);

  const delay = state === "loading" ? 60000 : 3000; // loading toast stays until replaced
  setTimeout(() => { toast.style.opacity = "0"; }, delay);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, delay + 400);
}

// ── main copy handler ─────────────────────────────────────────────────────

async function handleCopy(e) {
  if (!selectionTouchesResponse()) return; // not in assistant reply → native copy

  const structured = buildStructuredContent();
  if (!structured || structured.blocks.length === 0) return; // empty selection

  const formulaCount = countFormulas(structured);

  if (formulaCount === 0) {
    // No formulas – let the browser handle it, just log
    console.log("[ChatGPT->Word] no formulas, native copy");
    return;
  }

  // We have formulas: intercept and export via server
  e.preventDefault();
  e.stopImmediatePropagation();

  console.log(
    "[ChatGPT->Word] intercepted copy |",
    structured.blocks.length, "blocks |",
    formulaCount, "formulas"
  );

  showToast("loading", formulaCount);

  try {
    await exportToWord(structured);
    showToast("success", formulaCount);
    console.log("[ChatGPT->Word] .docx downloaded successfully");
  } catch (err) {
    console.error("[ChatGPT->Word] export failed:", err);
    showToast("error", 0, err.message);
  }
}

document.addEventListener("copy", handleCopy, true);
console.log("[ChatGPT->Word] copy listener registered (路径B: 服务器模式)");
