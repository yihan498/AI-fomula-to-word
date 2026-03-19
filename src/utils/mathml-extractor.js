/**
 * mathml-extractor.js
 *
 * KaTeX 在页面中的渲染结构：
 *
 *   块级公式：
 *   <span class="katex-display">
 *     <span class="katex">
 *       <span class="katex-mathml">          ← 包裹 MathML
 *         <math xmlns="...">...</math>
 *       </span>
 *       <span class="katex-html" aria-hidden="true">...</span>  ← 视觉渲染，需丢弃
 *     </span>
 *   </span>
 *
 *   行内公式：
 *   <span class="katex">
 *     <span class="katex-mathml">
 *       <math xmlns="...">...</math>
 *     </span>
 *     <span class="katex-html" aria-hidden="true">...</span>
 *   </span>
 *
 * 注意：.katex-html 含视觉 span 文本；<annotation> 含 LaTeX 原文。
 * 两者都不应出现在最终剪贴板 HTML 里，否则 Word 会显示乱码文本。
 */

/**
 * 将 HTML 字符串中所有 KaTeX 公式替换为纯 <math> 元素
 *
 * @param {string} htmlString
 * @returns {string}
 */
function replaceKatexWithMathML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${htmlString}</body></html>`,
    "text/html"
  );

  // ── 1. 处理块级公式 .katex-display ───────────────────────────
  // 先收集再替换，避免 DOM 变更影响迭代
  const displayNodes = Array.from(doc.querySelectorAll(".katex-display"));
  displayNodes.forEach((node) => {
    const math = findMathElement(node);
    if (!math) return;
    const clean = cleanMathElement(math, "block");
    node.replaceWith(clean);
  });

  // ── 2. 处理行内公式 .katex（此时块级已处理完毕，不会重复） ──
  const inlineNodes = Array.from(doc.querySelectorAll(".katex"));
  inlineNodes.forEach((node) => {
    // 如果这个 .katex 已经被上面替换掉了则跳过（不在 doc 里了）
    if (!doc.body.contains(node)) return;
    const math = findMathElement(node);
    if (!math) return;
    const clean = cleanMathElement(math, "inline");
    node.replaceWith(clean);
  });

  // ── 3. 兜底清理：删除任何残余的 .katex-html（视觉渲染残骸）──
  doc.querySelectorAll(".katex-html").forEach(el => el.remove());
  doc.querySelectorAll(".katex-mathml").forEach(el => {
    // 如果 .katex-mathml 没被替换（理论上不应存在），把里面的 math 提出来
    const math = el.querySelector("math");
    if (math) el.replaceWith(cleanMathElement(math, "inline"));
    else el.remove();
  });
  doc.querySelectorAll(".katex-display, .katex").forEach(el => el.remove());

  const body = doc.body || doc.querySelector("body");
  return body ? body.innerHTML : htmlString;
}

/**
 * 在节点内查找 <math> 元素
 * 兼容 HTML namespace 和 MathML namespace 两种情况
 * @param {Element} container
 * @returns {Element|null}
 */
function findMathElement(container) {
  // 标准 querySelector 在大多数浏览器可以跨 namespace 查到 math
  let math = container.querySelector("math");
  if (math) return math;

  // 备用：手动遍历所有子孙，按 localName 匹配
  // 注意：必须用 container.ownerDocument，不能用全局 document（可能是不同文档）
  const ownerDoc = container.ownerDocument || (typeof document !== "undefined" ? document : null);
  const walker = ownerDoc && ownerDoc.createTreeWalker
    ? ownerDoc.createTreeWalker(container, 0x1 /* NodeFilter.SHOW_ELEMENT */)
    : null;

  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (node.localName === "math") return node;
      node = walker.nextNode();
    }
  } else {
    // 最终备用：递归查找
    for (const child of container.children) {
      if (child.localName === "math") return child;
      const found = findMathElement(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 克隆 <math> 元素，设置 display 属性，移除 <annotation> 避免文字泄漏
 * @param {Element} mathEl
 * @param {"block"|"inline"} displayMode
 * @returns {Element}
 */
function cleanMathElement(mathEl, displayMode) {
  const clone = mathEl.cloneNode(true);

  // 设置 display 和 xmlns
  clone.setAttribute("display", displayMode === "block" ? "block" : "inline");
  clone.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");

  // 移除 <annotation> 和 <annotation-xml>（含 LaTeX 原文，Word 会将其显示为可见文字）
  clone.querySelectorAll("annotation, annotation-xml").forEach(a => a.remove());

  // 如果只剩 <semantics> 包裹内容，展开 <semantics>
  const semantics = clone.querySelector("semantics");
  if (semantics) {
    // 把 semantics 的子节点提到 semantics 的父节点（math 本身）
    while (semantics.firstChild) {
      semantics.parentNode.insertBefore(semantics.firstChild, semantics);
    }
    semantics.remove();
  }

  return clone;
}

// 浏览器 content script 环境：挂载到 window
if (typeof window !== "undefined") {
  window.replaceKatexWithMathML = replaceKatexWithMathML;
}
// Node.js 测试环境
if (typeof module !== "undefined" && module.exports) {
  module.exports = { replaceKatexWithMathML, findMathElement, cleanMathElement };
}
