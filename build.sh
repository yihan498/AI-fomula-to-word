#!/bin/bash
cd "$(dirname "$0")"
echo "同步 src → dist ..."
mkdir -p dist/src dist/icons
cp -r src/* dist/src/
cp manifest.json dist/manifest.json
cp icons/* dist/icons/
echo "同步完成！dist 目录已更新。"
