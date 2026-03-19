"use strict";

function ensureMathNamespace(html) {
  return html.replace(
    /<math(?![^>]*xmlns)/gi,
    '<math xmlns="http://www.w3.org/1998/Math/MathML"'
  );
}

function wrapBlockMathML(html) {
  return html.replace(
    /(^|>|\s)(<math[^>]*display="block"[^>]*>[\s\S]*?<\/math>)(?=$|<|\s)/gi,
    (match, prefix, mathTag) => `${prefix}<div class="cgw-equation-block">${mathTag}</div>`
  );
}

function normalizeOmmlBlocks(html) {
  return html.replace(
    /<p\b[^>]*>\s*(<m:oMathPara>[\s\S]*?<\/m:oMathPara>)\s*<\/p>/gi,
    "$1"
  );
}

function countMathML(html) {
  return (html.match(/<math\b/gi) || []).length;
}

function countOmml(html) {
  return (html.match(/<m:oMath(?=[\s>])/gi) || []).length;
}

function buildWordHtmlDocument(fragment) {
  return (
    "<!DOCTYPE html>\n" +
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
    '      xmlns:w="urn:schemas-microsoft-com:office:word"\n' +
    '      xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"\n' +
    '      xmlns="http://www.w3.org/TR/REC-html40">\n' +
    "<head>\n" +
    '  <meta charset="UTF-8"/>\n' +
    '  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n' +
    "  <!--[if gte mso 9]><xml>\n" +
    "    <w:WordDocument>\n" +
    "      <w:View>Print</w:View>\n" +
    "      <w:Zoom>100</w:Zoom>\n" +
    "    </w:WordDocument>\n" +
    "  </xml><![endif]-->\n" +
    "  <style>\n" +
    "    p { margin: 0 0 6pt; }\n" +
    "    li { margin: 0 0 3pt; }\n" +
    "    table { border-collapse: collapse; }\n" +
    "    th, td { border: 1px solid #d0d7de; padding: 4pt 6pt; }\n" +
    "    pre, code { font-family: Consolas, monospace; }\n" +
    "    .cgw-equation-block { margin: 6pt 0; text-align: center; }\n" +
    "    m\\:oMathPara { display: block; margin: 6pt 0; text-align: center; }\n" +
    "  </style>\n" +
    "</head>\n" +
    `<body><!--StartFragment-->${fragment}<!--EndFragment--></body>\n` +
    "</html>"
  );
}


function htmlToPlainText(html) {
  if (typeof DOMParser === "undefined") return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, "text/html");
  const body = doc.body;
  if (!body) return "";

  const mathNodes = Array.from(body.querySelectorAll("math"));
  const allElements = Array.from(body.getElementsByTagName("*"));
  const ommlNodes = allElements.filter((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    return tagName === "m:omath" || tagName === "m:omathpara";
  });

  [...mathNodes, ...ommlNodes].forEach((el) => {
    const textNode = doc.createTextNode(el.textContent || "");
    if (el.parentNode) {
      el.parentNode.replaceChild(textNode, el);
    }
  });

  return body.textContent.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function wrapForWordClipboard(htmlFragment) {
  const normalized = normalizeOmmlBlocks(wrapBlockMathML(ensureMathNamespace(htmlFragment)));
  return buildWordHtmlDocument(normalized);
}

function prepareWordClipboardPayload(mathmlHtml, ommlHtml) {
  const mathCount = countMathML(mathmlHtml);
  const ommlCount = countOmml(ommlHtml);
  const useOmml = mathCount > 0 && ommlCount >= mathCount;
  const fragment = useOmml ? ommlHtml : mathmlHtml;

  return {
    fragment,
    clipboardHTML: wrapForWordClipboard(fragment),
    plainText: htmlToPlainText(mathmlHtml),
    mode: useOmml ? "omml" : "mathml",
    mathCount,
    ommlCount,
  };
}

if (typeof window !== "undefined") {
  window.wrapForWordClipboard = wrapForWordClipboard;
  window.prepareWordClipboardPayload = prepareWordClipboardPayload;
}

if (typeof module !== "undefined" && module && module.exports) {
  module.exports = {
    buildWordHtmlDocument,
    countMathML,
    countOmml,
    ensureMathNamespace,
    htmlToPlainText,
    normalizeOmmlBlocks,
    prepareWordClipboardPayload,
    wrapBlockMathML,
    wrapForWordClipboard,
  };
}
