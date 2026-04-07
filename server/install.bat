@echo off
echo ============================================
echo  安装 AI 公式 → Word 服务器依赖
echo ============================================
echo.
python -m pip install flask flask-cors python-docx latex2mathml lxml
echo.
if %errorlevel% == 0 (
    echo 安装成功！运行 start.bat 启动服务器。
) else (
    echo 安装失败，请确认 Python 已安装并在 PATH 中。
    echo 手动运行：python -m pip install flask flask-cors python-docx latex2mathml lxml
)
pause
