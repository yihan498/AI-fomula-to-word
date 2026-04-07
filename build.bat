@echo off
echo ============================================
echo  同步 src → dist
echo ============================================
echo.
cd /d "%~dp0"
xcopy /E /Y /I src dist\src
copy /Y manifest.json dist\manifest.json
copy /Y icons\* dist\icons\
echo.
echo 同步完成！dist 目录已更新。
pause
