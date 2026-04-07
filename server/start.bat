@echo off
echo ============================================
echo  AI 公式 → Word 转换服务器
echo  地址: http://127.0.0.1:5678
echo  关闭此窗口将停止服务器
echo ============================================
echo.
cd /d "%~dp0"
python server.py
pause
