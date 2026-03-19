# ChatGPT → Word（含公式）

在 ChatGPT 页面选中任意段落（包含数学公式），按 **Ctrl+C**，浏览器自动下载一个 `.docx` 文件，用 Word 打开后公式是**原生可编辑**的格式，不是图片、不是乱码。

---

## 原理

| 环节 | 做了什么 |
|------|---------|
| Chrome 扩展 | 拦截复制事件，从 KaTeX 结构中提取原始 LaTeX |
| 本地 Python 服务器 | 接收 LaTeX → 转换为 OMML（Word 原生公式格式）→ 生成 .docx |
| 用户操作 | 下载 .docx，用 Word 打开，公式可直接编辑 |

浏览器剪贴板无法可靠传递 Word 公式对象，所以绕过剪贴板，改为本地生成文件。

---

## 前提条件

- **Chrome** 浏览器
- **Python 3.8+**（[下载地址](https://www.python.org/downloads/)，安装时勾选 "Add Python to PATH"）
- **Microsoft Word**（打开生成的 .docx）

---

## 安装步骤

### 第一步：下载项目

点右上角 **Code → Download ZIP**，解压到任意文件夹（例如桌面）。

### 第二步：安装 Python 依赖

**Windows**：双击 `server/install.bat`，等窗口显示"安装成功"后关闭。

**macOS / Linux**：
```bash
cd server
chmod +x install.sh && ./install.sh
```

### 第三步：加载 Chrome 扩展

1. Chrome 地址栏输入 `chrome://extensions/`
2. 右上角打开**开发者模式**
3. 点击**"加载已解压的扩展程序"**
4. 选择本项目的 `dist/` 文件夹
5. 扩展图标出现在工具栏即安装成功

---

## 每次使用

1. **启动服务器**
   - Windows：双击 `server/start.bat`，保持黑色窗口开着
   - macOS/Linux：`cd server && ./start.sh`

2. 打开 ChatGPT，**选中**含公式的段落

3. 按 **Ctrl+C**（选区含公式时自动拦截）

4. 浏览器弹出下载提示 → 用 Word 打开下载的文件，公式可编辑

> **纯文字段落**（无公式）不拦截，Ctrl+C 照常复制到剪贴板。

---

## 扩展 Popup 状态说明

点击 Chrome 工具栏里的扩展图标可查看状态：

| 圆点颜色 | 含义 |
|----------|------|
| 🟢 绿色 | 正常 |
| 🟡 黄色 | 不在 ChatGPT 页面 |
| 🔴 红色 | 本地服务器未启动，请先运行 start.bat |

---

## 目录结构

```
dist/          ← 可直接加载的 Chrome 扩展（已构建好，无需额外操作）
src/           ← 扩展源码
  content/
    content-extractor.js   # 从 KaTeX DOM 提取 LaTeX 结构
    copy-handler.js        # 拦截复制事件，调用本地服务器
server/
  server.py          # Flask 服务器入口
  latex_to_omml.py   # LaTeX → MathML → OMML 转换
  docx_builder.py    # 构建 .docx 文件
  requirements.txt   # Python 依赖列表
  install.bat        # Windows 一键安装
  install.sh         # macOS/Linux 一键安装
  start.bat          # Windows 启动服务器
  start.sh           # macOS/Linux 启动服务器
```

---

## 常见问题

**Q：双击 install.bat 闪退？**
A：Python 未加入 PATH。重装 Python，安装时勾选 "Add Python to PATH"。

**Q：下载的 .docx 公式显示为斜体文字而非公式？**
A：该公式 LaTeX 语法较复杂，转换失败时回退为原始 LaTeX 文本。可在 Issues 里提交样例。

**Q：服务器已启动，扩展 Popup 仍显示红色？**
A：刷新 ChatGPT 页面后再点扩展图标查看。

**Q：macOS 提示"无法验证开发者"？**
A：系统偏好设置 → 安全性与隐私 → 点"仍要打开"。

---

## License

MIT
