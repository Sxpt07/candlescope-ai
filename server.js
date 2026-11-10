#!/usr/bin/env node
"use strict";

/**
 * CandleScope AI - local static server.
 *
 * Server kecil tanpa dependency (tanpa npm install), dipakai oleh
 * start-server.bat. Hanya melayani file dari folder proyek dan hanya
 * bisa diakses dari komputer ini (127.0.0.1).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const PORT = parsePort(process.argv[2] || process.env.PORT);
const LAST_PORT = Math.min(PORT + 20, 65535);
const OPEN_BROWSER = process.env.NO_OPEN !== "1" && !process.argv.includes("--no-open");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8"
};

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_PORT;
  }
  return port;
}

function sendText(res, statusCode, message, extraHeaders) {
  const body = Buffer.from(message, "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(extraHeaders || {})
  });
  res.end(body);
}

function resolveFilePath(requestUrl) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) segments.push("index.html");

  const unsafe = segments.some(
    (segment) =>
      segment === ".." ||
      segment.includes("\\") ||
      segment.includes(":") ||
      segment.includes("\0")
  );

  if (unsafe) return null;

  return path.join(ROOT, ...segments);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
    return;
  }

  const filePath = resolveFilePath(req.url || "/");
  if (!filePath) {
    sendText(res, 400, "Bad Request");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(res, 404, "File not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    };

    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);

    stream.on("error", () => {
      if (!res.headersSent) {
        sendText(res, 500, "Failed to read file");
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  });
});

server.on("clientError", (error, socket) => {
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  }
});

function announce(port) {
  const url = `http://${HOST}:${port}/`;

  console.log("");
  console.log("  ============================================");
  console.log("   CandleScope AI - local server is running");
  console.log("  ============================================");
  console.log(`   URL    : ${url}`);
  console.log(`   Folder : ${ROOT}`);
  console.log("");
  console.log("   Press Ctrl+C to stop the server.");
  console.log("");

  if (OPEN_BROWSER) openBrowser(url);
}

function openBrowser(url) {
  let command;
  let args;

  if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });

    child.on("error", () => {
      console.log(`   Could not open the browser. Open this URL manually: ${url}`);
    });

    child.unref();
  } catch {
    console.log(`   Could not open the browser. Open this URL manually: ${url}`);
  }
}

function startListening(port) {
  const onError = (error) => {
    server.removeListener("listening", onListening);

    if (error.code === "EADDRINUSE" && port < LAST_PORT) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startListening(port + 1);
      return;
    }

    console.error("");
    console.error(`  Could not start the server on ${HOST}:${port}.`);
    console.error(`  ${error.message}`);
    console.error("");
    process.exitCode = 1;
  };

  const onListening = () => {
    server.removeListener("error", onError);
    announce(port);
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(port, HOST);
}

process.on("SIGINT", () => {
  console.log("\n  Stopping server...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
});

startListening(PORT);
