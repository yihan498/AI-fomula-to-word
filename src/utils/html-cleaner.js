/**
 * html-cleaner.js
 *
 * 清理从 AI 聊天页面复制下来的 HTML：
 * - 去除 class、id、style、data-*、aria-* 等无关属性
 * - 保留语义结构标签（p、ul、ol、li、table、code 等）
 * - 保护 <math> 节点内部不被修改
 */

// 允许保留的 HTML 标签
const ALLOWED_HTML_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "sup", "sub",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "blockquote", "hr",
]);

// MathML 标签：完整保留，不做任何清理
const MATHML_TAGS = new Set([
  "math", "mrow", "mn", "mi", "mo", "msup", "msub", "msubsup",
  "mfrac", "msqrt", "mroot", "mtext", "mover", "munder", "munderover",
  "mtable", "mtr", "mtd", "mstyle", "merror", "mpadded", "mspace",
  "mfenced", "menclose", "semantics", "annotation", "annotation-xml",
]);

/**
 * 清理 HTML 字符串，去除无关属性，保留结构
 *
 * @param {string} htmlString
 * @returns {string}
 */
function cleanHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${htmlString}</body></html>`,
    "text/html"
  );
  const body = doc.body || doc.querySelector("body");
  if (!body) return htmlString;

  // 只清理 body 的子节点，body 本身不处理（否则会被当作不允许的标签移除）
  Array.from(body.childNodes).forEach(cleanNode);

  return body.innerHTML;
}

/**
 * 递归清理单个节点
 * @param {Node} node
 */
function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.remove();
    return;
  }

  const tag = node.tagName.toLowerCase();

  // MathML 节点：跳过，保持原样
  if (MATHML_TAGS.has(tag)) return;

  // 不在允许列表的标签：先递归处理子节点，再展开（保留子节点，去掉包装标签）
  if (!ALLOWED_HTML_TAGS.has(tag)) {
    Array.from(node.childNodes).forEach(cleanNode);
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    node.remove();
    return;
  }

  // 清理属性（<a> 保留 href）
  const attrsToRemove = [];
  for (const attr of node.attributes) {
    const name = attr.name;
    if (
      name.startsWith("data-") ||
      name.startsWith("aria-") ||
      name === "class" ||
      name === "id" ||
      name === "style" ||
      name === "tabindex" ||
      (name === "href" && tag !== "a") ||
      (tag === "a" && name !== "href")
    ) {
      attrsToRemove.push(name);
    }
  }
  attrsToRemove.forEach((a) => node.removeAttribute(a));

  // 递归处理子节点（先转为数组，防止 DOM 变更影响遍历）
  Array.from(node.childNodes).forEach(cleanNode);
}

if (typeof window !== "undefined") {
  window.cleanHTML = cleanHTML;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { cleanHTML };
}
