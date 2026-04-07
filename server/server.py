"""
server.py  –  AI 公式 → Word 本地转换服务器

监听 http://127.0.0.1:5678
  GET  /health    → 存活检查（扩展 popup 使用）
  POST /convert   → 接收 JSON，返回 .docx 文件
"""

import io
import logging
import sys

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from docx_builder import build_docx

# ── app setup ──────────────────────────────────────────────────────────────

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB

CORS(
    app,
    origins=[
        "https://chatgpt.com",
        "https://chat.openai.com",
        "https://chat.deepseek.com",
    ],
    supports_credentials=False,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── routes ────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "0.6.0"})


@app.route("/convert", methods=["POST", "OPTIONS"])
def convert():
    # Pre-flight CORS request
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(force=True, silent=True)
    if not data:
        logger.warning("No JSON body received")
        return jsonify({"error": "请求体必须是 JSON"}), 400

    blocks = data.get("blocks", [])
    formula_count = sum(
        1 for b in blocks
        if b.get("type") == "formula_block"
        or any(r.get("type") == "formula" for r in b.get("runs", []))
    )
    logger.info("收到转换请求：%d 个块，%d 个公式", len(blocks), formula_count)

    try:
        docx_bytes = build_docx(data)
    except Exception as exc:
        logger.error("生成 .docx 失败：%s", exc, exc_info=True)
        return jsonify({"error": str(exc)}), 500

    return send_file(
        io.BytesIO(docx_bytes),
        mimetype=(
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
        as_attachment=True,
        download_name="ai-export.docx",
    )


# ── entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 52)
    print("  AI 公式 → Word 转换服务器")
    print("  地址：http://127.0.0.1:5678")
    print("  保持此窗口开启，然后在浏览器中使用扩展")
    print("=" * 52)
    app.run(host="127.0.0.1", port=5678, debug=False)
