"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const COPY_TARGETS = ["manifest.json", "src", "icons"];

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function buildOnce() {
  removeDir(DIST);
  ensureDir(DIST);

  for (const target of COPY_TARGETS) {
    copyRecursive(path.join(ROOT, target), path.join(DIST, target));
  }

  console.log(`[build] Extension files copied to ${DIST}`);
}

function watch() {
  buildOnce();
  console.log("[build] Watching manifest.json, src/, icons/ ...");

  const watchers = [
    fs.watch(path.join(ROOT, "src"), { recursive: true }, buildOnce),
    fs.watch(path.join(ROOT, "icons"), { recursive: true }, buildOnce),
    fs.watch(ROOT, { recursive: false }, (eventType, filename) => {
      if (filename === "manifest.json") buildOnce();
    }),
  ];

  process.on("SIGINT", () => {
    watchers.forEach((watcher) => watcher.close());
    process.exit(0);
  });
}

if (process.argv.includes("--watch")) {
  watch();
} else {
  buildOnce();
}
