# AI 公式 → Word

在 ChatGPT、DeepSeek 等 AI 聊天页面，选中含数学公式的段落，按 **Ctrl+C**，浏览器自动下载一个 `.docx` 文件。用 Word 打开后，公式是**原生可编辑**的格式——不是图片，不是乱码，可以直接双击修改。

---

## 支持的网站

| 网站 | 网址 |
|------|------|
| ChatGPT | chatgpt.com |
| DeepSeek | chat.deepseek.com |

同时支持 **Chrome** 和 **Edge** 浏览器。

---

## 为什么不是直接 Ctrl+C → Ctrl+V 粘贴？

浏览器剪贴板无法可靠地把公式传给 Word——Word 收到的是网页渲染结果，会变成乱码或 LaTeX 原文。本工具的做法是：

1. 扩展从页面 KaTeX 结构中提取原始 LaTeX
2. 本地 Python 服务器把 LaTeX 转换为 OMML（Word 原生公式格式）
3. 直接生成 `.docx` 文件供下载

完全绕开剪贴板，公式格式由程序控制，结果稳定可靠。

---

## 前提条件

- **Chrome 或 Edge** 浏览器
- **Python 3.8 及以上**（[官网下载](https://www.python.org/downloads/)，Windows 安装时务必勾选 **"Add Python to PATH"**）
- **Microsoft Word**（用于打开生成的文件）

---

## 安装（只需做一次）

### 第一步：下载项目

点页面右上角 **Code → Download ZIP**，解压到任意位置（建议桌面）。

### 第二步：安装 Python 依赖

**Windows**：双击 `server/install.bat`，等窗口出现"安装成功"后关闭。

**macOS / Linux**：
```bash
cd server
chmod +x install.sh && ./install.sh
```

安装的依赖包括：`flask`、`flask-cors`、`python-docx`、`latex2mathml`、`lxml`。

### 第三步：加载浏览器扩展

**Chrome**：
1. 地址栏输入 `chrome://extensions/`
2. 右上角打开**开发者模式**
3. 点击**"加载已解压的扩展程序"**
4. 选择本项目的 `dist/` 文件夹

**Edge**：
1. 地址栏输入 `edge://extensions/`
2. 左下角打开**开发人员模式**
3. 点击**"加载解压缩的扩展"**
4. 选择本项目的 `dist/` 文件夹

工具栏出现扩展图标即安装成功。

---

## 每次使用

**第一步：启动本地服务器**（每次使用前需要运行，关闭窗口则停止）

- Windows：双击 `server/start.bat`，保持黑色窗口开着
- macOS/Linux：`cd server && ./start.sh`

**第二步：在 ChatGPT 或 DeepSeek 中选中含公式的段落**

**第三步：按 Ctrl+C**

浏览器弹出下载提示，保存文件后用 Word 打开，公式即可编辑。

> 纯文字段落（不含公式）不会被拦截，Ctrl+C 照常复制到剪贴板。

---

## 扩展图标状态说明

点击浏览器工具栏的扩展图标可查看当前状态：

| 圆点颜色 | 含义 |
|----------|------|
| 🟢 绿色 | 一切正常 |
| 🟡 黄色 | 当前不在支持的 AI 网站 |
| 🔴 红色 | 本地服务器未启动，请先运行 start.bat |

---

## 目录结构

```
dist/                   ← 直接加载的浏览器扩展（已构建完成）
src/
  content/
    content-extractor.js  # 从 KaTeX DOM 中提取 LaTeX 和段落结构
    copy-handler.js       # 拦截 Ctrl+C，调用本地服务器
  popup/
    popup.html/js/css     # 扩展图标弹出面板
server/
  server.py             # Flask 服务器，接收请求并返回 .docx
  latex_to_omml.py      # LaTeX → MathML → OMML 转换逻辑
  docx_builder.py       # 组装 .docx 文件
  requirements.txt      # Python 依赖列表
  install.bat / .sh     # 一键安装依赖
  start.bat / .sh       # 启动服务器
```

---

## 常见问题

**Q：双击 install.bat 窗口一闪而过？**
A：Python 未加入系统 PATH。重装 Python，安装时勾选 "Add Python to PATH"，重启电脑后再试。

**Q：start.bat 启动后，扩展图标仍显示红色？**
A：刷新 AI 网站页面，再点一次扩展图标查看状态。

**Q：下载的 .docx 里公式显示为斜体文字而不是公式？**
A：该公式的 LaTeX 语法较复杂，转换失败时会回退显示原始 LaTeX 文本。可在 [Issues](https://github.com/yihan498/AI-fomula-to-word/issues) 里提交公式样例，我会改进支持。

**Q：macOS 提示"无法验证开发者"？**
A：系统设置 → 隐私与安全性 → 点"仍要打开"。

---

## License

MIT
