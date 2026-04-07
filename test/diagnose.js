/**
 * diagnose.js - 在 AI 聊天页面（ChatGPT / DeepSeek）DevTools Console 里粘贴运行
 *
 * 注意：扩展函数在隔离环境中，console 里看不到是正常的，不代表扩展没运行。
 * 请在 **含有数学公式的对话页面** 运行此脚本。
 */
(function () {
  console.group("=== AI→Word 诊断 v2 ===");

  // ── 1. 确认扩展是否运行 ─────────────────────────────────────
  // content script 的 console.log 会出现在这里，搜索 "[AI→Word]" 字样
  console.log("1. 如果扩展正常运行，上方应该有 '[AI→Word] copy 拦截已注册' 日志");
  console.log("   （在 Console 过滤框输入 'AI→Word' 查找）");

  // ── 2. 检测当前页面的公式渲染方式 ───────────────────────────
  console.log("\n2. 公式渲染方式检测:");

  // KaTeX（旧版 / 部分版本）
  console.log("  KaTeX .katex:", document.querySelectorAll(".katex").length);
  console.log("  KaTeX .katex-display:", document.querySelectorAll(".katex-display").length);
  console.log("  原生 <math>:", document.querySelectorAll("math").length);

  // MathJax（另一种可能）
  console.log("  MathJax .MathJax:", document.querySelectorAll(".MathJax").length);
  console.log("  MathJax .mjx-container:", document.querySelectorAll(".mjx-container").length);

  // 自定义公式容器（部分版本可能使用）
  console.log("  [data-formula]:", document.querySelectorAll("[data-formula]").length);
  console.log("  .math-display:", document.querySelectorAll(".math-display").length);
  console.log("  .math-inline:", document.querySelectorAll(".math-inline").length);

  // ── 3. 找到 assistant 消息，检查其中的 HTML 结构 ──────────
  const assistantMsg = document.querySelector('[data-message-author-role="assistant"]');
  if (assistantMsg) {
    const html = assistantMsg.innerHTML;
    console.log("\n3. Assistant 消息区域内容（前300字）:");
    console.log("  ", html.slice(0, 300));

    // 找页面上所有 span 的 class，看看有没有特征类名
    const allSpans = assistantMsg.querySelectorAll("span[class]");
    const classes = new Set();
    allSpans.forEach(s => s.className.split(" ").forEach(c => c && classes.add(c)));
    const mathClasses = [...classes].filter(c =>
      c.toLowerCase().includes("math") ||
      c.toLowerCase().includes("katex") ||
      c.toLowerCase().includes("latex") ||
      c.toLowerCase().includes("formula") ||
      c.toLowerCase().includes("equation")
    );
    console.log("  含'math/katex/latex/formula'的 class:", mathClasses.length > 0 ? mathClasses : "无");

    // 检查是否有 LaTeX 原始文本（$$...$$）
    const rawLatex = html.match(/\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g);
    console.log("  原始 LaTeX 文本:", rawLatex ? rawLatex.length + " 处" : "无");
  } else {
    console.log("\n3. 未找到 assistant 消息区域（请在有 AI 回复的页面运行）");
  }

  // ── 4. 验证 copy 事件是否被拦截 ────────────────────────────
  console.log("\n4. 手动触发 copy 测试（选中一段文字后运行）:");
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    console.log("  当前选区文本:", sel.toString().slice(0, 80));
    console.log("  选区 rangeCount:", sel.rangeCount);
    const container = document.createElement("div");
    container.appendChild(sel.getRangeAt(0).cloneContents());
    console.log("  选区 HTML（前200字）:", container.innerHTML.slice(0, 200));
  } else {
    console.log("  无选区（请先选中一段文字再运行此脚本）");
  }

  console.groupEnd();
})();
