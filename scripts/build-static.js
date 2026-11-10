#!/usr/bin/env node
"use strict";

/**
 * Build the static deployment bundle for Vercel/Netlify.
 *
 * CandleScope AI has no framework and no dependencies. This script only copies
 * the three files the browser needs into public/ so the hosting provider does
 * not publish local tooling (server.js, .opencode, docs, etc.).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "public");
const FILES = ["index.html", "style.css", "app.js"];

function build() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalBytes = 0;

  for (const file of FILES) {
    const source = path.join(ROOT, file);
    const target = path.join(OUTPUT_DIR, file);

    if (!fs.existsSync(source)) {
      throw new Error(`Missing required file: ${file}`);
    }

    const stats = fs.statSync(source);
    if (stats.size === 0) {
      throw new Error(`Required file is empty: ${file}`);
    }

    fs.copyFileSync(source, target);
    totalBytes += fs.statSync(target).size;
  }

  console.log(`Built ${FILES.length} files into public/ (${totalBytes} bytes).`);
  for (const file of FILES) {
    console.log(`  public/${file}`);
  }
}

try {
  build();
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
