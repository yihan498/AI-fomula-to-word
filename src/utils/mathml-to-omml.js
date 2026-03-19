/**
 * mathml-to-omml.js
 *
 * 将 MathML DOM 元素转换为 OMML (Office Math Markup Language)
 * OMML 是 Microsoft Word 的原生公式格式，粘贴后直接显示为可编辑公式。
 *
 * 常见 MathML → OMML 对照：
 *   <mrow>           → (透明，直接展开子节点)
 *   <mi>x</mi>       → <m:r><m:rPr><m:sty m:val="i"/></m:rPr><m:t>x</m:t></m:r>
 *   <mn>2</mn>       → <m:r><m:t>2</m:t></m:r>
 *   <mo>+</mo>       → <m:r><m:t>+</m:t></m:r>
 *   <msup>           → <m:sSup><m:e>底</m:e><m:sup>指数</m:sup></m:sSup>
 *   <mfrac>          → <m:f><m:num>分子</m:num><m:den>分母</m:den></m:f>
 *   <msqrt>          → <m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>内容</m:e></m:rad>
 */

"use strict";

// ── XML 字符转义 ──────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── 只取元素子节点（忽略文本/注释节点） ──────────────────────
function elChildren(el) {
  return Array.from(el.childNodes).filter((n) => n.nodeType === 1);
}

// ── 递归转换单个 MathML 节点 ──────────────────────────────────
function convertNode(node) {
  if (!node) return "";
  // 文本节点（通常是空白）
  if (node.nodeType === 3) return "";
  if (node.nodeType !== 1) return "";

  const name = (node.localName || node.tagName || "").toLowerCase();

  switch (name) {
    // ── 透明容器 ────────────────────────────────────────────
    case "math":
    case "mrow":
    case "mstyle":
    case "mpadded":
    case "mphantom":
      return convertChildren(node);

    case "semantics": {
      // 只转第一个子元素（数学内容），跳过 annotation
      const first = elChildren(node)[0];
      return first ? convertNode(first) : "";
    }

    case "annotation":
    case "annotation-xml":
      return ""; // 已在提取阶段删除，双重保障

    // ── 基础符号 ─────────────────────────────────────────────
    case "mi": {
      const text = node.textContent;
      // 单字母变量用斜体（italic），多字母用正体（plain）
      const sty = text.length === 1 ? "i" : "p";
      return `<m:r><m:rPr><m:sty m:val="${sty}"/></m:rPr><m:t>${esc(text)}</m:t></m:r>`;
    }
    case "mn":
      return `<m:r><m:t>${esc(node.textContent)}</m:t></m:r>`;

    case "mo":
      return `<m:r><m:t>${esc(node.textContent.trim())}</m:t></m:r>`;

    case "mtext":
      return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>${esc(node.textContent)}</m:t></m:r>`;

    case "ms":
      return `<m:r><m:t>&quot;${esc(node.textContent)}&quot;</m:t></m:r>`;

    case "mspace":
      return `<m:r><m:t xml:space="preserve"> </m:t></m:r>`;

    // ── 上下标 ───────────────────────────────────────────────
    case "msup": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      return `<m:sSup><m:e>${convertNode(kids[0])}</m:e><m:sup>${convertNode(kids[1])}</m:sup></m:sSup>`;
    }
    case "msub": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      return `<m:sSub><m:e>${convertNode(kids[0])}</m:e><m:sub>${convertNode(kids[1])}</m:sub></m:sSub>`;
    }
    case "msubsup": {
      const kids = elChildren(node);
      if (kids.length < 3) return convertChildren(node);
      return (
        `<m:sSubSup>` +
        `<m:e>${convertNode(kids[0])}</m:e>` +
        `<m:sub>${convertNode(kids[1])}</m:sub>` +
        `<m:sup>${convertNode(kids[2])}</m:sup>` +
        `</m:sSubSup>`
      );
    }

    // ── 分数 ─────────────────────────────────────────────────
    case "mfrac": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      return `<m:f><m:num>${convertNode(kids[0])}</m:num><m:den>${convertNode(kids[1])}</m:den></m:f>`;
    }

    // ── 根号 ─────────────────────────────────────────────────
    case "msqrt":
      return (
        `<m:rad>` +
        `<m:radPr><m:degHide m:val="1"/></m:radPr>` +
        `<m:deg/>` +
        `<m:e>${convertChildren(node)}</m:e>` +
        `</m:rad>`
      );

    case "mroot": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      return (
        `<m:rad>` +
        `<m:deg>${convertNode(kids[1])}</m:deg>` +
        `<m:e>${convertNode(kids[0])}</m:e>` +
        `</m:rad>`
      );
    }

    // ── 上划线/帽子/波浪 ─────────────────────────────────────
    case "mover": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      const base = convertNode(kids[0]);
      const overText = kids[1].textContent;
      // 上划线
      if (["\u00AF", "\u203E", "\u2015"].includes(overText)) {
        return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${base}</m:e></m:bar>`;
      }
      return `<m:acc><m:accPr><m:chr m:val="${esc(overText)}"/></m:accPr><m:e>${base}</m:e></m:acc>`;
    }

    // ── 下标极限 ─────────────────────────────────────────────
    case "munder": {
      const kids = elChildren(node);
      if (kids.length < 2) return convertChildren(node);
      const base = convertNode(kids[0]);
      const under = convertNode(kids[1]);
      return `<m:limLow><m:e>${base}</m:e><m:lim>${under}</m:lim></m:limLow>`;
    }

    // ── 求和/积分（上下限） ───────────────────────────────────
    case "munderover": {
      const kids = elChildren(node);
      if (kids.length < 3) return convertChildren(node);
      const base  = convertNode(kids[0]);
      const under = convertNode(kids[1]);
      const over  = convertNode(kids[2]);
      return (
        `<m:nary>` +
        `<m:naryPr><m:limLoc m:val="undOvr"/></m:naryPr>` +
        `<m:sub>${under}</m:sub>` +
        `<m:sup>${over}</m:sup>` +
        `<m:e>${base}</m:e>` +
        `</m:nary>`
      );
    }

    // ── 括号/围栏 ─────────────────────────────────────────────
    case "mfenced": {
      const open  = node.hasAttribute("open")  ? node.getAttribute("open")  : "(";
      const close = node.hasAttribute("close") ? node.getAttribute("close") : ")";
      const sep   = node.hasAttribute("separators") ? node.getAttribute("separators") : ",";
      const inner = convertChildren(node);
      return (
        `<m:d>` +
        `<m:dPr>` +
        `<m:begChr m:val="${esc(open)}"/>` +
        `<m:sepChr m:val="${esc(sep[0] || ",")}"/>` +
        `<m:endChr m:val="${esc(close)}"/>` +
        `</m:dPr>` +
        `<m:e>${inner}</m:e>` +
        `</m:d>`
      );
    }

    // ── 矩阵 ─────────────────────────────────────────────────
    case "mtable": {
      const rows = elChildren(node).filter((c) => c.localName === "mtr");
      const cols = rows[0]
        ? elChildren(rows[0]).filter((c) => c.localName === "mtd").length
        : 1;
      const rowsOmml = rows
        .map((row) => {
          const cells = elChildren(row).filter((c) => c.localName === "mtd");
          const cellsOmml = cells.map((c) => `<m:e>${convertChildren(c)}</m:e>`).join("");
          return `<m:mr>${cellsOmml}</m:mr>`;
        })
        .join("");
      return (
        `<m:m>` +
        `<m:mPr><m:mcs><m:mc><m:mcPr>` +
        `<m:count m:val="${cols}"/><m:mcJc m:val="center"/>` +
        `</m:mcPr></m:mc></m:mcs></m:mPr>` +
        rowsOmml +
        `</m:m>`
      );
    }

    default:
      return convertChildren(node);
  }
}

function convertChildren(el) {
  return Array.from(el.childNodes).map(convertNode).join("");
}

// ── 公开 API ─────────────────────────────────────────────────

/**
 * 将单个 <math> DOM 元素转为 OMML 字符串
 * @param {Element} mathEl
 * @returns {string}
 */
function mathmlToOmml(mathEl) {
  const isBlock = mathEl.getAttribute("display") === "block";
  const inner = convertChildren(mathEl);
  return isBlock
    ? `<m:oMathPara><m:oMath>${inner}</m:oMath></m:oMathPara>`
    : `<m:oMath>${inner}</m:oMath>`;
}

/**
 * 处理 HTML 字符串：把其中所有 <math> 替换为 OMML
 * @param {string} htmlString
 * @returns {string}
 */
function convertMathInHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${htmlString}</body></html>`,
    "text/html"
  );

  const mathEls = Array.from(doc.querySelectorAll("math"));
  if (mathEls.length === 0) return htmlString;

  // 用带特殊属性的空 span 占位，避免序列化时 MathML namespace 丢失
  // 属性值形如 data-omml-id="0"，不含特殊字符，替换时精确匹配
  const placeholders = {};
  mathEls.forEach((mathEl, i) => {
    const id = String(i);
    placeholders[id] = mathmlToOmml(mathEl);
    const span = doc.createElement("span");
    span.setAttribute("data-omml-id", id);
    mathEl.replaceWith(span);
  });

  // 序列化 HTML（math 已替换为空 span 占位符）
  let result = doc.body.innerHTML;

  // 把 <span data-omml-id="N"></span> 替换为 OMML 字符串（去掉 span 包装）
  Object.entries(placeholders).forEach(([id, omml]) => {
    result = result.split(`<span data-omml-id="${id}"></span>`).join(omml);
  });

  return result;
}

if (typeof window !== "undefined") {
  window.mathmlToOmml    = mathmlToOmml;
  window.convertMathInHTML = convertMathInHTML;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { mathmlToOmml, convertMathInHTML };
}
