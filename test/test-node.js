/**
 * Node.js 测试：验证 MathML 抽取、HTML 清理、OMML 转换与 Word 包装。
 */
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!DOCTYPE html><body></body>");
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const { replaceKatexWithMathML } = require("../src/utils/mathml-extractor");
const { cleanHTML } = require("../src/utils/html-cleaner");
const { convertMathInHTML } = require("../src/utils/mathml-to-omml");
const { prepareWordClipboardPayload } = require("../src/utils/word-html");

const INLINE_KATEX = `<span class="katex">
  <span class="katex-html" aria-hidden="true"><span class="mord">visual</span></span>
  <math xmlns="http://www.w3.org/1998/Math/MathML">
    <semantics>
      <mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>
      <annotation encoding="application/x-tex">E = mc^2</annotation>
    </semantics>
  </math>
</span>`;

const DISPLAY_KATEX = `<span class="katex-display">
  <span class="katex">
    <span class="katex-html" aria-hidden="true"><span>visual</span></span>
    <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
      <semantics>
        <mrow>
          <mi>x</mi><mo>=</mo>
          <mfrac>
            <mrow><mo>-</mo><mi>b</mi><mo>±</mo><msqrt><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></msqrt></mrow>
            <mrow><mn>2</mn><mi>a</mi></mrow>
          </mfrac>
        </mrow>
        <annotation encoding="application/x-tex">x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}</annotation>
      </semantics>
    </math>
  </span>
</span>`;

const TEST_INPUT = `
<div class="markdown" data-message-id="abc" style="color:black">
  <p class="para">质能方程 ${INLINE_KATEX} 是著名公式。</p>
  ${DISPLAY_KATEX}
  <ul>
    <li class="li-item">项目一：${INLINE_KATEX}</li>
    <li class="li-item">项目二</li>
  </ul>
  <table class="tbl" data-rows="1">
    <thead><tr><th class="th-cell">公式</th><th>说明</th></tr></thead>
    <tbody><tr><td>${INLINE_KATEX}</td><td>质能方程</td></tr></tbody>
  </table>
</div>
`;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      console.log(`  ✓ ${name}`);
      passed += 1;
    } else {
      console.log(`  ✗ ${name}\n     -> ${result}`);
      failed += 1;
    }
  } catch (error) {
    console.log(`  ✗ ${name}\n     -> 异常: ${error.message}`);
    failed += 1;
  }
}

function parseHTML(html) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document.body;
}

console.log("\n═══════════════════════════════════════");
console.log("  ChatGPT→Word 扩展测试");
console.log("═══════════════════════════════════════");

const step1 = replaceKatexWithMathML(TEST_INPUT);
const step2 = cleanHTML(step1);
const step3 = convertMathInHTML(step2);
const payload = prepareWordClipboardPayload(step2, step3);
const out = parseHTML(step2);

console.log("\n【A】KaTeX → MathML 替换");
test("原始输入含 .katex 节点", () => {
  const count = parseHTML(TEST_INPUT).querySelectorAll(".katex").length;
  return count > 0 ? true : `期望 > 0，实际 ${count}`;
});
test("处理后无残留 .katex 节点", () => {
  const count = out.querySelectorAll(".katex").length;
  return count === 0 ? true : `仍有 ${count} 个`;
});
test("<math> 已提取", () => {
  const count = out.querySelectorAll("math").length;
  return count > 0 ? true : `找到 ${count} 个`;
});
test("块级公式 display=block", () => {
  const count = out.querySelectorAll("math[display='block']").length;
  return count > 0 ? true : `找到 ${count} 个`;
});
test("行内公式 display=inline", () => {
  const count = out.querySelectorAll("math[display='inline']").length;
  return count > 0 ? true : `找到 ${count} 个`;
});

console.log("\n【B】Word 包装");
test("payload 优先使用 OMML", () => {
  return payload.mode === "omml" ? true : `当前模式为 ${payload.mode}`;
});
test("Word HTML 含命名空间声明", () => {
  return payload.clipboardHTML.includes("urn:schemas-microsoft-com:office:word")
    ? true
    : "缺少 Word xmlns";
});
test("Word HTML 含 StartFragment 标记", () => {
  return payload.clipboardHTML.includes("<!--StartFragment-->")
    ? true
    : "缺少 StartFragment";
});
test("Word HTML 含 OMML 节点", () => {
  return payload.clipboardHTML.includes("<m:oMath")
    ? true
    : "缺少 <m:oMath>";
});

console.log("\n【C】HTML 清理");
test("class 已清除（HTML 层）", () => {
  const elements = Array.from(out.querySelectorAll("[class]")).filter((el) => !el.closest("math"));
  return elements.length === 0 ? true : `仍有 ${elements.length} 个`;
});
test("data-* 已清除", () => {
  const found = out.querySelector("[data-message-id],[data-rows]");
  return !found ? true : `仍存在 ${found.tagName}`;
});

console.log("\n【D】内容结构保留");
test("段落 <p>", () => {
  const count = out.querySelectorAll("p").length;
  return count > 0 ? true : "未找到段落";
});
test("列表 <ul><li>", () => {
  const count = out.querySelectorAll("ul li").length;
  return count > 0 ? true : "未找到列表项";
});
test("表格 <table><td>", () => {
  const count = out.querySelectorAll("table td").length;
  return count > 0 ? true : "未找到表格单元格";
});
test("annotation 已移除", () => {
  const count = out.querySelectorAll("annotation").length;
  return count === 0 ? true : `仍有 ${count} 个 <annotation>`;
});

console.log("\n【E】OMML 转换");
test("step3 中无残留 <math>", () => {
  const count = (step3.match(/<math\b/gi) || []).length;
  return count === 0 ? true : `仍有 ${count} 个 <math>`;
});
test("step3 已生成 OMML", () => {
  const count = (step3.match(/<m:oMath(?=[\\s>])/gi) || []).length;
  return count > 0 ? true : `找到 ${count} 个 <m:oMath>`;
});
test("OMML 数量覆盖公式数", () => {
  return payload.ommlCount >= payload.mathCount
    ? true
    : `OMML 数 ${payload.ommlCount} < 公式数 ${payload.mathCount}`;
});
test("plain text 不包含 LaTeX 命令", () => {
  return /\\(frac|sqrt|quad|ne|pm)\b/.test(payload.plainText)
    ? `plain text 仍含 LaTeX: ${payload.plainText}`
    : true;
});

console.log("\n═══════════════════════════════════════");
console.log(`  总计 ${passed + failed} 项  |  ✓ ${passed}  |  ✗ ${failed}`);
console.log("═══════════════════════════════════════\n");

if (failed > 0) process.exit(1);
