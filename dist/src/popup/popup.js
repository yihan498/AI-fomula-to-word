// popup.js  –  检查当前页面 + 本地服务器状态

const SERVER_URL = "http://127.0.0.1:5678";

// ── 检查当前标签页是否是 ChatGPT ─────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";
  const isGPT = url.includes("chatgpt.com") || url.includes("chat.openai.com");

  const dot  = document.getElementById("dot-page");
  const text = document.getElementById("text-page");

  if (isGPT) {
    dot.classList.add("active");
    text.textContent = "ChatGPT 页面已就绪";
  } else {
    dot.classList.add("warn");
    text.textContent = "请切换到 ChatGPT 页面";
  }
});

// ── 检查本地服务器 ────────────────────────────────────────────────────────
const dot  = document.getElementById("dot-server");
const text = document.getElementById("text-server");

fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(2000) })
  .then((r) => r.json())
  .then(() => {
    dot.classList.add("active");
    text.textContent = "本地服务器运行中";
  })
  .catch(() => {
    dot.classList.add("error");
    text.textContent = "服务器未启动 → 运行 start.bat";
  });
