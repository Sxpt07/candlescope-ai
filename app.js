/* =========================================================
   CandleScope AI — app.js
   Gemini 3.5 Flash-Lite vision analysis for candlestick charts
   ========================================================= */

"use strict";

/* =========================================================
   1. Configuration
   ========================================================= */

// Model Lite stabil: free tier 500 RPD (vs 20 RPD Flash), mendukung image + JSON.
// Alternatif jika key belum punya akses: "gemini-3.1-flash-lite".
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const CONFIG = Object.freeze({
  model: GEMINI_MODEL,
  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
  maxFileSize: 5 * 1024 * 1024,
  allowedTypes: ["image/png", "image/jpeg", "image/webp"],
  allowedExtension: /\.(png|jpe?g|webp)$/i,
  historyLimit: 5,
  minScanMs: 1300,
  requestTimeoutMs: 180000,
  analysisTotalTimeoutMs: 300000,
  analysisMaxAttempts: 3,
  analysisRetryBaseDelayMs: 1200,
  analysisRetryMaxDelayMs: 6000,
  analysisImageMaxWidth: 1600,
  analysisImageMaxHeight: 1600,
  analysisImageQuality: 0.85,
  analysisImageTargetBytes: 1.5 * 1024 * 1024,
  chatTimeoutMs: 150000,
  chatHistoryLimit: 12,
  chatMaxChars: 2000,
  chatSnapshotMaxWidth: 1100,
  chatSnapshotMaxHeight: 820,
  chatSnapshotQuality: 0.84,
  statusIntervalMs: 1900,
  statusSteps: [
    "Uploading chart…",
    "Reading candlestick patterns…",
    "Calculating support & resistance…",
    "Scoring market sentiment…",
    "Generating trade setup…"
  ],
  storageKeys: {
    history: "candlescope.history.v1",
    apiKey: "candlescope.apiKey.v1",
    sessionApiKey: "candlescope.apiKey.session.v1"
  }
});

const SYSTEM_PROMPT = `You are an elite technical analyst and price-action specialist. Analyze the candlestick chart screenshot provided.

Focus only on information that is visible in the image: trend structure, candlestick patterns, support and resistance, momentum clues, and price levels. Do not invent indicators or values that are not visible. If the image is not a financial chart, return sentiment "Sideways", confidence 0, empty arrays, and explain briefly in the summary.

Return ONLY a single valid JSON object. No markdown fences, no preamble, no commentary. Use exactly this shape:
{
  "asset": "string, e.g. BTC/USDT or BBCA.JK; use 'Unknown chart' if unclear",
  "timeframe": "string, e.g. 15m, 1H, 4H, 1D; use 'Unknown' if unclear",
  "sentiment": "Bullish" | "Bearish" | "Sideways",
  "confidence": 78,
  "patterns": [
    { "name": "string", "type": "bullish" | "bearish" | "neutral", "description": "one concise sentence" }
  ],
  "support": [
    { "price": "string or number", "note": "short context" }
  ],
  "resistance": [
    { "price": "string or number", "note": "short context" }
  ],
  "tradeSetup": {
    "entry": "string",
    "stopLoss": "string",
    "takeProfit": ["string"],
    "riskReward": "string, e.g. 1:2.5"
  },
  "summary": "string in Bahasa Indonesia"
}

Rules:
- Provide 1-6 high-quality patterns, 1-5 support levels, and 1-5 resistance levels when visible.
- Order support from nearest-to-price downward, and resistance from nearest-to-price upward when possible.
- confidence must be an integer from 0 to 100. It should reflect chart clarity and agreement between signals, not certainty of profit.
- summary MUST be written in natural Bahasa Indonesia, 120-220 words. Use Markdown with 2-4 short paragraphs and a few bullet points. Mention the trend, key levels, the trade idea, invalidation, and risk.
- tradeSetup must be practical and consistent with the levels. If no valid setup exists, use "No clear setup" for values and explain why in the summary.
- Do not include financial advice disclaimers inside the summary.`;

const CHAT_SYSTEM_PROMPT = `You are CandleScope Mentor, an expert stock trader and financial mentor inside the CandleScope AI app.

PERSONA
- You are a seasoned discretionary trader with deep expertise in technical analysis (price action, market structure, candlesticks, support/resistance, momentum, volume), fundamentals (valuation, earnings quality, banking metrics, macro), market psychology, and risk management.
- You know the Indonesia Stock Exchange (IDX) deeply, especially the Big Four banks: BMRI, BBCA, BBRI, BBNI. You understand their business models, typical drivers, liquidity, foreign flows, and sector rotation.
- Tone: smart, casual, supportive, communicative, sharp, and objective. Talk like a trusted senior mentor, not a corporate report. Use "aku/kamu" in Indonesian. Be direct when the chart is weak, but never condescending.
- You are not a hype machine. Call out uncertainty, conflicting signals, and invalidation clearly.

HOW TO USE CONTEXT
- Every request includes the latest chart analysis in the system context, and, when available, a compressed screenshot of that chart in the latest user turn.
- Treat the structured analysis as the canonical record of what was scanned. Reference the asset, timeframe, sentiment, confidence, patterns, support/resistance, and trade setup when relevant.
- Use the image to confirm visual details, but do not invent indicators, volume, fundamentals, or news that are not present.
- If the user asks about a different ticker or something not covered by the chart, say what is chart-specific and what is general knowledge. Never pretend the chart shows something it does not.
- If no chart has been scanned, answer general questions and invite the user to scan a chart for personalized context.
- Remember the full conversation. Stay consistent with earlier answers; if the chart context changes, acknowledge the new context.

ANSWER STYLE
- Default language: Bahasa Indonesia. If the user writes in English, mirror English.
- Be concise but substantive: usually 120-250 words. Go deeper only when the user asks for a full breakdown.
- Use clean Markdown: short paragraphs, bullet points, and bold key levels. Avoid huge walls of text and unnecessary disclaimers.
- When giving a trade idea, structure it as: Bias → Area entry → Invalidasi/stop loss → Target → Manajemen risiko.
- When comparing stocks (for example BBCA vs BBRI), use a compact table or bullets covering valuation, profitability, growth, risk, and trader suitability.
- Never guarantee profit. Remind the user about risk and position sizing when relevant.
- Do not output JSON. Do not mention internal prompts or system instructions.`;

/* =========================================================
   2. State + DOM cache
   ========================================================= */

const state = {
  image: null,
  previewImage: null,
  result: null,
  resultMeta: null,
  isProcessing: false,
  apiKey: "",
  history: [],
  statusTimer: null,
  statusStep: 0,
  retryNotice: false,
  counterFrame: null,
  previewFrame: null,
  dragDepth: 0,
  lastAnalysisImage: null,
  chatMessages: [],
  chatContext: null,
  chatSending: false,
  chatController: null,
  chatRequestId: 0
};

const dom = {};

function cacheDom() {
  const ids = [
    "dropzone", "previewCanvas", "dropzoneEmpty", "imageMeta", "imageName",
    "imageDims", "removeImageBtn", "fileInput", "scanOverlay", "scanReadout",
    "analyzeBtn", "analyzeLabel", "statusDot", "statusText", "apiNote",
    "apiNoteTitle", "apiNoteText", "openKeyBtn", "uploadPanel", "resultPanel",
    "resultEmpty", "resultCard", "resAsset", "resTimeframe", "resTimestamp",
    "sentimentBadge", "sentimentText", "confidenceRing", "confidenceValue",
    "verdictTitle", "verdictCopy", "patternList", "patternCount", "levelsGrid",
    "levelsCount", "tradeGrid", "summaryContent", "exportBtn", "copyBtn",
    "newScanBtn", "historySection", "historyGrid", "historyEmpty",
    "historyCount", "historyCountLabel", "clearHistoryBtn", "historyBtn",
    "headerKeyBtn", "keyBtnLabel", "keyDot", "keyDialog", "keyForm",
    "apiKeyInput", "rememberKey", "toggleKeyVisibility", "keyDialogClose",
    "clearKeyBtn", "saveKeyBtn", "toastStack", "advisorSection",
    "advisorContextCard", "advisorContextThumb", "advisorContextPlaceholder",
    "advisorContextLive", "advisorContextAsset", "advisorContextSentiment",
    "advisorContextMeta", "advisorContextSource", "advisorStatus",
    "advisorStatusText", "advisorLog", "advisorMessages", "advisorTyping",
    "advisorTypingLabel", "advisorSuggestions", "advisorForm", "advisorInput",
    "advisorSendBtn", "advisorSendLabel", "advisorCounter", "advisorResetBtn"
  ];

  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
}

/* =========================================================
   3. Small utilities
   ========================================================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function formatTimeout(ms) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = seconds / 60;
  const minuteText = Number.isInteger(minutes)
    ? `${minutes} minute${minutes === 1 ? "" : "s"}`
    : `${minutes.toFixed(1)} minutes`;
  return `${seconds} seconds (${minuteText})`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

function formatPriceValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    const maximumFractionDigits = Math.abs(value) < 1 ? 6 : Math.abs(value) < 100 ? 3 : 2;
    return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
  }
  return String(value).trim() || "—";
}

function slugify(value) {
  return String(value ?? "chart")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "chart";
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setStatus(message, tone = "idle") {
  if (dom.statusText) dom.statusText.textContent = message;
  if (dom.statusDot) dom.statusDot.dataset.tone = tone;
  if (dom.scanReadout) dom.scanReadout.textContent = String(message).toUpperCase();
}

class AppError extends Error {
  constructor(message, code = "UNKNOWN", cause = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

/* =========================================================
   4. Toasts
   ========================================================= */

const TOAST_META = {
  success: { icon: "✓", title: "Success" },
  error: { icon: "!", title: "Something went wrong" },
  warning: { icon: "!", title: "Heads up" },
  info: { icon: "i", title: "Info" }
};

function showToast(message, type = "info", title = "") {
  if (!dom.toastStack) return;
  const safeType = TOAST_META[type] ? type : "info";
  const meta = TOAST_META[safeType];

  const toast = document.createElement("div");
  toast.className = `toast toast--${safeType}`;
  toast.setAttribute("role", safeType === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = meta.icon;

  const body = document.createElement("div");
  body.className = "toast__body";
  const heading = document.createElement("strong");
  heading.className = "toast__title";
  heading.textContent = title || meta.title;
  const copy = document.createElement("p");
  copy.className = "toast__message";
  copy.textContent = message;
  body.append(heading, copy);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  close.addEventListener("click", () => dismissToast(toast));

  const progress = document.createElement("span");
  progress.className = "toast__progress";
  progress.setAttribute("aria-hidden", "true");

  toast.append(icon, body, close, progress);
  dom.toastStack.appendChild(toast);

  while (dom.toastStack.children.length > 3) {
    dom.toastStack.firstElementChild?.remove();
  }

  toast._dismissTimer = window.setTimeout(() => dismissToast(toast), 6000);
  toast.addEventListener("mouseenter", () => window.clearTimeout(toast._dismissTimer));
  toast.addEventListener("mouseleave", () => {
    toast._dismissTimer = window.setTimeout(() => dismissToast(toast), 2500);
  });
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains("is-leaving")) return;
  window.clearTimeout(toast._dismissTimer);
  toast.classList.add("is-leaving");
  window.setTimeout(() => toast.remove(), 260);
}

function clearToasts() {
  if (!dom.toastStack) return;
  dom.toastStack.replaceChildren();
}

/* =========================================================
   5. API key management
   ========================================================= */

function loadApiKey() {
  try {
    state.apiKey =
      localStorage.getItem(CONFIG.storageKeys.apiKey) ||
      sessionStorage.getItem(CONFIG.storageKeys.sessionApiKey) ||
      "";
  } catch {
    state.apiKey = "";
  }
}

function persistApiKey(key, remember) {
  const cleanKey = String(key ?? "").trim();
  state.apiKey = cleanKey;
  let saved = true;

  try {
    localStorage.removeItem(CONFIG.storageKeys.apiKey);
    sessionStorage.removeItem(CONFIG.storageKeys.sessionApiKey);
    if (cleanKey) {
      const storage = remember ? localStorage : sessionStorage;
      const storageKey = remember ? CONFIG.storageKeys.apiKey : CONFIG.storageKeys.sessionApiKey;
      storage.setItem(storageKey, cleanKey);
    }
  } catch {
    saved = false;
    showToast("The key could not be saved in this browser, but it will work for this session.", "warning");
  }

  updateApiKeyUI();
  return saved;
}

function clearApiKey() {
  state.apiKey = "";
  try {
    localStorage.removeItem(CONFIG.storageKeys.apiKey);
    sessionStorage.removeItem(CONFIG.storageKeys.sessionApiKey);
  } catch {
    /* Storage can be unavailable in private modes. */
  }
  updateApiKeyUI();
}

function updateApiKeyUI() {
  const connected = Boolean(state.apiKey);
  if (dom.apiNote) dom.apiNote.dataset.state = connected ? "connected" : "missing";
  if (dom.apiNoteTitle) {
    dom.apiNoteTitle.textContent = connected ? "Vision engine connected" : "Gemini API key required";
  }
  if (dom.apiNoteText) {
    dom.apiNoteText.textContent = connected
      ? "Gemini 3.5 Flash-Lite is ready to read charts."
      : "Add a key to enable chart vision.";
  }
  if (dom.openKeyBtn) dom.openKeyBtn.textContent = connected ? "Manage" : "Add key";
  if (dom.headerKeyBtn) {
    dom.headerKeyBtn.classList.toggle("is-connected", connected);
    dom.headerKeyBtn.setAttribute(
      "aria-label",
      connected ? "Gemini API key connected. Manage key." : "Configure Gemini API key"
    );
  }
  if (dom.keyBtnLabel) dom.keyBtnLabel.textContent = connected ? "Key ready" : "API key";
}

function openKeyDialog() {
  if (!dom.keyDialog) return;
  if (dom.apiKeyInput) {
    dom.apiKeyInput.value = state.apiKey;
    dom.apiKeyInput.type = "password";
  }
  if (dom.toggleKeyVisibility) dom.toggleKeyVisibility.textContent = "Show";
  if (dom.rememberKey) {
    let storedRemember = false;
    try {
      storedRemember = Boolean(localStorage.getItem(CONFIG.storageKeys.apiKey));
    } catch {
      storedRemember = false;
    }
    dom.rememberKey.checked = storedRemember || !state.apiKey;
  }
  if (typeof dom.keyDialog.showModal === "function") {
    if (!dom.keyDialog.open) dom.keyDialog.showModal();
  } else {
    dom.keyDialog.setAttribute("open", "");
  }
  window.setTimeout(() => dom.apiKeyInput?.focus(), 60);
}

function closeKeyDialog() {
  if (!dom.keyDialog) return;
  if (typeof dom.keyDialog.close === "function" && dom.keyDialog.open) {
    dom.keyDialog.close();
  } else {
    dom.keyDialog.removeAttribute("open");
  }
}

function handleKeySubmit(event) {
  event.preventDefault();
  const key = String(dom.apiKeyInput?.value ?? "").trim();
  if (!key) {
    showToast("Paste a Gemini API key before saving.", "error", "API key required");
    dom.apiKeyInput?.focus();
    return;
  }
  const saved = persistApiKey(key, Boolean(dom.rememberKey?.checked));
  closeKeyDialog();
  if (saved) {
    showToast("Gemini API key saved for this browser.", "success", "Connected");
  }
}

function toggleKeyVisibility() {
  if (!dom.apiKeyInput || !dom.toggleKeyVisibility) return;
  const isPassword = dom.apiKeyInput.type === "password";
  dom.apiKeyInput.type = isPassword ? "text" : "password";
  dom.toggleKeyVisibility.textContent = isPassword ? "Hide" : "Show";
}

/* =========================================================
   6. Image input + validation
   ========================================================= */

const EXTENSION_MIME_MAP = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

function normalizeMimeType(value) {
  const type = String(value || "").toLowerCase();
  return type === "image/jpg" ? "image/jpeg" : type;
}

function validateImageFile(file) {
  if (!file || typeof file !== "object" || typeof file.size !== "number") {
    return { ok: false, message: "That file could not be read. Please choose a PNG, JPG, or WEBP image." };
  }

  if (file.size <= 0) {
    return { ok: false, message: "This file is empty. Choose a valid chart screenshot." };
  }

  if (file.size > CONFIG.maxFileSize) {
    return {
      ok: false,
      message: `This image is ${formatBytes(file.size)}. The maximum size is 5MB — compress it and try again.`
    };
  }

  const type = normalizeMimeType(file.type);
  const name = String(file.name || "");
  const hasAllowedExtension = CONFIG.allowedExtension.test(name);

  if (type && !CONFIG.allowedTypes.includes(type)) {
    if (type === "image/svg+xml") {
      return { ok: false, message: "SVG files are not supported. Use a PNG, JPG, or WEBP screenshot." };
    }
    if (type.startsWith("image/")) {
      return { ok: false, message: "Unsupported image format. Please use PNG, JPG, or WEBP." };
    }
    return { ok: false, message: "That file is not an image. Please upload a chart screenshot." };
  }

  if (!type && name && !hasAllowedExtension) {
    return { ok: false, message: "Unsupported file type. Please use a PNG, JPG, or WEBP image." };
  }

  return { ok: true, message: "" };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:")) {
        reject(new AppError("The image could not be converted to Base64.", "IMAGE_READ"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new AppError("The browser could not read this image.", "IMAGE_READ", reader.error));
    reader.onabort = () => reject(new AppError("Image reading was cancelled.", "IMAGE_READ"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl) {
  if (typeof dataUrl !== "string") return "";
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return "";
  return dataUrl.slice(commaIndex + 1);
}

function estimateBase64Bytes(base64) {
  const length = String(base64 || "").replace(/\s+/g, "").length;
  return Math.floor((length * 3) / 4);
}

function sniffImageMime(dataUrl) {
  try {
    const base64 = dataUrlToBase64(dataUrl);
    if (!base64) return "";
    const header = atob(base64.slice(0, 32));
    const bytes = Array.from(header, (char) => char.charCodeAt(0));

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return "image/png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      header.slice(0, 4) === "RIFF" &&
      header.slice(8, 12) === "WEBP"
    ) {
      return "image/webp";
    }
  } catch {
    return "";
  }
  return "";
}

function resolveMimeType(file, dataUrl) {
  const declaredType = normalizeMimeType(file?.type);
  if (CONFIG.allowedTypes.includes(declaredType)) return declaredType;

  const sniffed = sniffImageMime(dataUrl);
  if (sniffed) return sniffed;

  const dataUrlMatch = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(String(dataUrl || ""));
  const dataUrlType = normalizeMimeType(dataUrlMatch ? dataUrlMatch[1] : "");
  if (CONFIG.allowedTypes.includes(dataUrlType)) return dataUrlType;

  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  return EXTENSION_MIME_MAP[extension] || "";
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AppError("The image could not be decoded. Try a different screenshot.", "IMAGE_DECODE"));
    image.src = src;
  });
}

async function handleFile(file) {
  if (state.isProcessing) {
    showToast("Analysis is still running. Wait for it to finish before adding a new chart.", "warning");
    return;
  }

  const validation = validateImageFile(file);
  if (!validation.ok) {
    showToast(validation.message, "error", "Invalid image");
    return;
  }

  const previousImage = state.image;
  const previousPreview = state.previewImage;
  setStatus("Processing image…", "ready");

  try {
    const dataUrl = await fileToDataUrl(file);
    const mimeType = resolveMimeType(file, dataUrl);

    if (!CONFIG.allowedTypes.includes(mimeType)) {
      throw new AppError("Unsupported image format. Please use PNG, JPG, or WEBP.", "IMAGE_TYPE");
    }

    const base64 = dataUrlToBase64(dataUrl);
    if (!base64) {
      throw new AppError("The image could not be converted to Base64.", "IMAGE_BASE64");
    }

    const image = await loadImageElement(dataUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new AppError("The image appears to be empty or corrupted.", "IMAGE_DECODE");
    }

    const fileName = file.name || `pasted-chart-${Date.now()}.${mimeType.split("/")[1]}`;

    state.image = {
      file,
      name: fileName,
      size: file.size,
      mimeType,
      dataUrl,
      base64,
      width: image.naturalWidth,
      height: image.naturalHeight
    };
    state.previewImage = image;
    state.result = null;
    state.resultMeta = null;
    state.lastAnalysisImage = null;

    hideResultCard();
    dom.dropzone.classList.add("has-image");
    dom.removeImageBtn.hidden = false;
    dom.imageMeta.hidden = false;
    updateImageUI();
    updateAnalyzeState();
    schedulePreviewDraw();
    setStatus("Chart loaded. Ready to scan.", "ready");

    if (image.naturalWidth < 420 || image.naturalHeight < 260) {
      showToast("The chart is quite small. Higher-resolution screenshots produce better analysis.", "warning", "Low resolution");
    } else {
      showToast("Chart loaded and ready to scan.", "success", "Image ready");
    }
  } catch (error) {
    console.error("[CandleScope] Image load failed:", error);
    state.image = previousImage;
    state.previewImage = previousPreview;
    updateAnalyzeState();
    updateImageUI();
    schedulePreviewDraw();
    setStatus(
      previousImage ? "Chart loaded. Ready to scan." : "Image could not be loaded.",
      previousImage ? "ready" : "error"
    );
    showToast(
      error instanceof AppError ? error.message : "We couldn't read that image. Try another screenshot.",
      "error",
      "Image error"
    );
  }
}

function updateImageUI() {
  if (!dom.imageMeta || !dom.removeImageBtn) return;

  if (!state.image) {
    dom.imageMeta.hidden = true;
    dom.removeImageBtn.hidden = true;
    dom.dropzone.classList.remove("has-image");
    dom.dropzone.setAttribute(
      "aria-label",
      "Upload a chart screenshot. Drag and drop, click to browse, or paste from clipboard."
    );
    return;
  }

  dom.imageMeta.hidden = false;
  dom.removeImageBtn.hidden = false;
  dom.imageName.textContent = state.image.name;
  dom.imageName.title = state.image.name;
  dom.imageDims.textContent = `${state.image.width} × ${state.image.height} · ${formatBytes(state.image.size)}`;
  dom.dropzone.setAttribute(
    "aria-label",
    `Selected chart: ${state.image.name}. Click to replace it.`
  );
}

function clearSelectedImage() {
  if (state.isProcessing) {
    showToast("Wait for the current scan to finish first.", "warning");
    return;
  }

  state.image = null;
  state.previewImage = null;
  state.lastAnalysisImage = null;
  if (dom.fileInput) dom.fileInput.value = "";
  if (dom.previewCanvas) {
    const context = dom.previewCanvas.getContext("2d");
    context?.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
  }

  updateImageUI();
  updateAnalyzeState();

  if (state.result) {
    setStatus("Chart removed. Previous analysis is still below.", "idle");
  } else {
    setStatus("Waiting for a chart…", "idle");
  }
}

function updateAnalyzeState() {
  if (!dom.analyzeBtn) return;
  dom.analyzeBtn.disabled = !state.image || state.isProcessing;
  dom.analyzeBtn.title = !state.image ? "Upload a chart first" : "";
}

/* =========================================================
   7. Canvas preview
   ========================================================= */

function schedulePreviewDraw() {
  if (state.previewFrame) cancelAnimationFrame(state.previewFrame);
  state.previewFrame = requestAnimationFrame(() => {
    state.previewFrame = null;
    drawPreviewCanvas();
  });
}

function drawPreviewCanvas() {
  const canvas = dom.previewCanvas;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, width, height);
  const image = state.previewImage;
  if (!image) return;

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function createThumbnail(image) {
  if (!image || !image.naturalWidth || !image.naturalHeight) return "";
  try {
    const maxWidth = 420;
    const maxHeight = 260;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return "";

    context.fillStyle = "#040912";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return "";
  }
}

/**
 * Prepares the image that is actually sent to Gemini.
 * The original file stays untouched for the preview and history thumbnail.
 * Large screenshots are resized and re-encoded as JPEG, while small files that
 * are already efficient (for example a compact PNG) are kept as-is.
 */
function createAnalysisSnapshot(image, source = {}) {
  const original = {
    base64: String(source.base64 || ""),
    mimeType: String(source.mimeType || "image/png"),
    dataUrl: String(source.dataUrl || ""),
    bytes: Number(source.size) || estimateBase64Bytes(source.base64),
    width: Number(source.width) || image?.naturalWidth || 0,
    height: Number(source.height) || image?.naturalHeight || 0
  };

  if (!image || !image.naturalWidth || !image.naturalHeight || !original.base64) {
    return { ...original, compressed: false, originalBytes: original.bytes };
  }

  try {
    const scale = Math.min(
      CONFIG.analysisImageMaxWidth / image.naturalWidth,
      CONFIG.analysisImageMaxHeight / image.naturalHeight,
      1
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return { ...original, compressed: false, originalBytes: original.bytes };
    }

    context.fillStyle = "#040912";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const qualities = [CONFIG.analysisImageQuality, 0.78, 0.7];
    let best = null;

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrlToBase64(dataUrl);
      if (!base64) continue;
      const bytes = estimateBase64Bytes(base64);
      if (!best || bytes < best.bytes) {
        best = { dataUrl, base64, bytes, quality };
      }
      if (bytes <= CONFIG.analysisImageTargetBytes) break;
    }

    if (!best) {
      return { ...original, compressed: false, originalBytes: original.bytes };
    }

    const originalBytes = original.bytes || estimateBase64Bytes(original.base64);
    const meaningfulSaving = best.bytes <= originalBytes * 0.9;
    const needsResize = scale < 1;
    const overTarget = originalBytes > CONFIG.analysisImageTargetBytes;

    if (!needsResize && !overTarget && !meaningfulSaving) {
      return {
        ...original,
        bytes: originalBytes,
        originalBytes,
        compressed: false
      };
    }

    return {
      base64: best.base64,
      mimeType: "image/jpeg",
      dataUrl: best.dataUrl,
      bytes: best.bytes,
      originalBytes,
      width,
      height,
      quality: best.quality,
      compressed: true
    };
  } catch (error) {
    console.warn("[CandleScope] Could not optimize the analysis image:", error);
    return { ...original, compressed: false, originalBytes: original.bytes };
  }
}

/* =========================================================
   8. Drag & drop
   ========================================================= */

function hasDraggedFiles(event) {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

function handleDragEnter(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  state.dragDepth += 1;
  if (!state.isProcessing) dom.dropzone.classList.add("is-dragging");
}

function handleDragOver(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = state.isProcessing ? "none" : "copy";
  }
  if (!state.isProcessing) dom.dropzone.classList.add("is-dragging");
}

function handleDragLeave(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) {
    dom.dropzone.classList.remove("is-dragging");
  }
}

function handleDrop(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  state.dragDepth = 0;
  dom.dropzone.classList.remove("is-dragging");

  if (state.isProcessing) {
    showToast("Analysis is still running. Wait for it to finish first.", "warning");
    return;
  }

  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) {
    showToast("No image was found in that drop.", "error", "Nothing to scan");
    return;
  }

  const imageFile = files.find(
    (file) => String(file.type || "").startsWith("image/") || CONFIG.allowedExtension.test(file.name || "")
  );

  if (!imageFile) {
    showToast("Drop a PNG, JPG, or WEBP chart screenshot.", "error", "Unsupported file");
    return;
  }

  handleFile(imageFile);
}

function resetDragState() {
  state.dragDepth = 0;
  dom.dropzone?.classList.remove("is-dragging");
}

/* =========================================================
   9. Clipboard paste
   ========================================================= */

function handlePaste(event) {
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) {
    return;
  }

  const clipboard = event.clipboardData;
  if (!clipboard) return;

  let file = null;

  if (clipboard.files && clipboard.files.length) {
    file = Array.from(clipboard.files).find((item) => String(item.type || "").startsWith("image/")) || null;
  }

  if (!file && clipboard.items) {
    for (const item of Array.from(clipboard.items)) {
      if (item.kind === "file" && String(item.type || "").startsWith("image/")) {
        file = item.getAsFile();
        break;
      }
    }
  }

  if (!file) return;
  event.preventDefault();

  if (state.isProcessing) {
    showToast("Analysis is still running. Wait for it to finish before pasting another chart.", "warning");
    return;
  }

  if (!file.name) {
    try {
      const extension = (file.type || "image/png").split("/")[1] || "png";
      file = new File([file], `pasted-chart-${Date.now()}.${extension}`, { type: file.type || "image/png" });
    } catch {
      /* Older browsers can still read the original clipboard blob. */
    }
  }

  handleFile(file);
}

/* =========================================================
   10. Scanner animation + status sequence
   ========================================================= */

function startScanningAnimation() {
  state.statusStep = 0;
  state.retryNotice = false;
  stopStatusCycle();
  clearToasts();

  dom.dropzone?.classList.add("is-scanning");
  dom.uploadPanel?.classList.add("is-scanning");
  dom.uploadPanel?.setAttribute("aria-busy", "true");
  dom.scanOverlay?.setAttribute("aria-hidden", "false");

  if (dom.analyzeBtn) {
    dom.analyzeBtn.disabled = true;
    dom.analyzeBtn.classList.add("is-loading");
    dom.analyzeBtn.setAttribute("aria-busy", "true");
  }
  if (dom.analyzeLabel) dom.analyzeLabel.textContent = "Scanning chart…";
  if (dom.removeImageBtn) dom.removeImageBtn.disabled = true;
  if (dom.fileInput) dom.fileInput.disabled = true;
  dom.dropzone?.setAttribute("aria-disabled", "true");

  setStatus(CONFIG.statusSteps[0], "scanning");

  state.statusTimer = window.setInterval(() => {
    if (state.retryNotice) return;
    if (state.statusStep >= CONFIG.statusSteps.length - 1) return;
    state.statusStep += 1;
    setStatus(CONFIG.statusSteps[state.statusStep], "scanning");
  }, CONFIG.statusIntervalMs);
}

function stopStatusCycle() {
  if (state.statusTimer) {
    window.clearInterval(state.statusTimer);
    state.statusTimer = null;
  }
}

function stopScanningAnimation(reveal = false) {
  stopStatusCycle();
  state.retryNotice = false;

  dom.dropzone?.classList.remove("is-scanning", "is-dragging");
  dom.uploadPanel?.classList.remove("is-scanning");
  dom.uploadPanel?.removeAttribute("aria-busy");
  dom.scanOverlay?.setAttribute("aria-hidden", "true");

  if (dom.analyzeBtn) {
    dom.analyzeBtn.classList.remove("is-loading");
    dom.analyzeBtn.removeAttribute("aria-busy");
  }
  if (dom.analyzeLabel) dom.analyzeLabel.textContent = "Analyze chart";
  if (dom.removeImageBtn) dom.removeImageBtn.disabled = false;
  if (dom.fileInput) dom.fileInput.disabled = false;
  dom.dropzone?.removeAttribute("aria-disabled");
  state.dragDepth = 0;

  updateAnalyzeState();

  if (reveal && state.result) {
    revealResultCard();
  }
}

/* =========================================================
   11. Analyze flow
   ========================================================= */

async function handleAnalyze() {
  if (state.isProcessing) return;

  if (!state.image) {
    showToast("Upload, drop, or paste a chart screenshot first.", "warning", "No chart selected");
    dom.dropzone?.focus();
    return;
  }

  if (!state.apiKey) {
    openKeyDialog();
    showToast("Add your Gemini API key to start the vision scan.", "warning", "API key required");
    return;
  }

  state.isProcessing = true;
  state.result = null;
  state.resultMeta = null;
  hideResultCard();
  startScanningAnimation();

  const startedAt = Date.now();

  try {
    const analysisImage = createAnalysisSnapshot(state.previewImage, state.image);
    state.lastAnalysisImage = analysisImage;

    if (analysisImage.compressed) {
      setStatus(
        `Optimized chart: ${formatBytes(analysisImage.originalBytes)} → ${formatBytes(analysisImage.bytes)}`,
        "scanning"
      );
    }

    const analysis = await requestGeminiAnalysis({
      base64: analysisImage.base64,
      mimeType: analysisImage.mimeType,
      apiKey: state.apiKey,
      onAttempt: ({ attempt, maxAttempts }) => {
        state.retryNotice = false;
        if (attempt > 1) {
          setStatus(`Retrying analysis (${attempt}/${maxAttempts})…`, "scanning");
        }
      },
      onRetry: ({ nextAttempt, maxAttempts, delayMs }) => {
        state.retryNotice = true;
        const seconds = Math.max(1, Math.ceil(delayMs / 1000));
        setStatus(
          `Gemini is busy. Retry ${nextAttempt}/${maxAttempts} in ${seconds}s…`,
          "scanning"
        );
      }
    });

    const elapsed = Date.now() - startedAt;
    if (elapsed < CONFIG.minScanMs) {
      await delay(CONFIG.minScanMs - elapsed);
    }

    setStatus(CONFIG.statusSteps[CONFIG.statusSteps.length - 1], "scanning");
    await delay(180);

    const meta = {
      analyzedAt: new Date().toISOString(),
      fileName: state.image?.name || "Chart screenshot",
      thumbnail: createThumbnail(state.previewImage),
      imageInfo: {
        mimeType: analysisImage.mimeType,
        width: analysisImage.width,
        height: analysisImage.height,
        bytes: analysisImage.bytes,
        originalBytes: analysisImage.originalBytes,
        compressed: analysisImage.compressed
      }
    };

    renderAnalysis(analysis, { reveal: false, meta });
    stopScanningAnimation(true);
    setStatus(
      `Scan complete — ${analysis.sentiment.toLowerCase()} bias at ${analysis.confidence}% confidence.`,
      "success"
    );
    addToHistory(analysis, state.resultMeta);
    setChatContext({
      analysis,
      meta: state.resultMeta,
      image: createChatSnapshot(state.previewImage)
    });
    showToast("Chart decoded. Your analysis is ready.", "success", "Scan complete");

    if (window.matchMedia("(max-width: 1120px)").matches) {
      dom.resultCard?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    }
  } catch (error) {
    handleAnalysisError(error);
  } finally {
    state.isProcessing = false;
    updateAnalyzeState();
  }
}

function handleAnalysisError(error) {
  stopScanningAnimation(false);
  console.error("[CandleScope] Analysis failed:", error);

  let message = "We couldn't analyze this chart. Check your connection and try again.";
  if (error instanceof AppError && error.message) {
    message = error.message;
  } else if (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    message = "Network request failed. Check your internet connection and try again.";
  }

  setStatus("Scan failed. Please try again.", "error");
  showToast(message, "error", "Analysis failed");
}

/* =========================================================
   12. Gemini 3.5 Flash-Lite Vision API
   ========================================================= */

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ANALYSIS_CODES = new Set([
  "TIMEOUT",
  "NETWORK",
  "API_RESPONSE",
  "EMPTY_RESPONSE",
  "NO_CANDIDATE",
  "PARSE",
  "NORMALIZE"
]);

function isRetryableAnalysisError(error) {
  if (!(error instanceof AppError)) return false;
  if (error.code === "API_ERROR") return error.retryable === true;
  return RETRYABLE_ANALYSIS_CODES.has(error.code);
}

async function requestGeminiAnalysis({ base64, mimeType, apiKey, onRetry, onAttempt }) {
  if (!base64) {
    throw new AppError("The image data is missing. Please upload the chart again.", "IMAGE_BASE64");
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          },
          { text: "Analyze this candlestick chart screenshot and return the JSON object exactly as specified." }
        ]
      }
    ],
    generationConfig: {
      // Gemini 3.x tidak lagi mendukung temperature/topP/topK.
      // thinkingLevel "medium" didukung Gemini 3.5 Flash-Lite (default: minimal).
      // Token thinking ikut dihitung, jadi beri headroom yang cukup.
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      thinkingConfig: {
        thinkingLevel: "medium"
      }
    }
  };

  const maxAttempts = Math.max(1, CONFIG.analysisMaxAttempts);
  const deadline = Date.now() + CONFIG.analysisTotalTimeoutMs;
  let lastError = null;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 1000) break;

    const timeoutMs = Math.min(CONFIG.requestTimeoutMs, remaining);
    attemptsMade = attempt;
    onAttempt?.({ attempt, maxAttempts, timeoutMs });

    try {
      return await requestGeminiAnalysisAttempt({ payload, apiKey, timeoutMs });
    } catch (error) {
      lastError = error;

      const canRetry =
        attempt < maxAttempts &&
        isRetryableAnalysisError(error) &&
        Date.now() < deadline - 1000;

      if (!canRetry) break;

      const delayMs = Math.min(
        CONFIG.analysisRetryBaseDelayMs * Math.pow(2, attempt - 1),
        CONFIG.analysisRetryMaxDelayMs
      );
      onRetry?.({ nextAttempt: attempt + 1, maxAttempts, delayMs, error });
      await delay(delayMs);
    }
  }

  if (lastError instanceof AppError) {
    if (attemptsMade > 1 && isRetryableAnalysisError(lastError)) {
      lastError.message = `${lastError.message} (tried ${attemptsMade} times)`;
    }
    throw lastError;
  }

  throw new AppError("The analysis could not be started. Please try again.", "UNKNOWN");
}

async function requestGeminiAnalysisAttempt({ payload, apiKey, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) {
        throw new AppError(
          `The analysis timed out after ${formatTimeout(timeoutMs)}. Try a smaller screenshot or retry.`,
          "TIMEOUT",
          error
        );
      }
      throw new AppError("Network request failed. Check your internet connection and try again.", "NETWORK", error);
    }

    let data = null;
    let parseError = null;
    try {
      data = await response.json();
    } catch (error) {
      parseError = error;
      if (error?.name === "AbortError" || controller.signal.aborted) {
        throw new AppError(
          `The analysis timed out after ${formatTimeout(timeoutMs)}. Try a smaller screenshot or retry.`,
          "TIMEOUT",
          error
        );
      }
    }

    if (!response.ok) {
      console.error("[CandleScope] Gemini API error:", response.status, data);
      const apiError = new AppError(mapApiError(response.status, data), "API_ERROR");
      apiError.status = response.status;
      apiError.retryable = RETRYABLE_HTTP_STATUS.has(response.status);
      throw apiError;
    }

    if (parseError) {
      throw new AppError(
        "Gemini returned an unreadable response. Please run the scan again.",
        "API_RESPONSE",
        parseError
      );
    }

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new AppError(
        `Gemini blocked this image (${blockReason}). Try a clean chart screenshot without extra content.`,
        "BLOCKED"
      );
    }

    const candidate = data?.candidates?.[0];
    if (!candidate) {
      throw new AppError("Gemini did not return an analysis. Please try again.", "NO_CANDIDATE");
    }

    if (["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"].includes(candidate.finishReason)) {
      throw new AppError(
        `Gemini stopped the analysis (${candidate.finishReason}). Try a cleaner chart screenshot.`,
        "BLOCKED"
      );
    }

    const text = (candidate.content?.parts || [])
      .filter((part) => part?.text && part.thought !== true)
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new AppError("Gemini returned an empty analysis. Please retry the scan.", "EMPTY_RESPONSE");
    }

    const parsed = parseGeminiJson(text);
    return normalizeAnalysis(parsed);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mapApiError(status, data) {
  const detail = String(data?.error?.message || "");

  if (/api key not valid|api_key_invalid|invalid api key/i.test(detail)) {
    return "Your Gemini API key is invalid. Update the key and try again.";
  }

  switch (status) {
    case 400:
      return "Gemini rejected the request. Check your API key and the image, then try again.";
    case 401:
    case 403:
      return "Access denied. Your API key may not have permission to use the Gemini API.";
    case 404:
      return "Gemini 3.5 Flash-Lite is not available for this API key. Check your region or Google AI Studio project.";
    case 413:
      return "The image is too large for the API. Compress it below 5MB and try again.";
    case 429:
      return "Rate limit or quota reached. Wait a moment or check your Gemini API quota.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Gemini is temporarily unavailable. Please try again in a moment.";
    default:
      return `Gemini request failed (${status}). Please try again.`;
  }
}

/* =========================================================
   13. Safe JSON parsing
   ========================================================= */

function parseGeminiJson(raw) {
  if (raw && typeof raw === "object") return raw;

  let text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new AppError("Gemini returned an empty response. Please retry.", "PARSE");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  }

  const attempts = [text];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = text.slice(firstBrace, lastBrace + 1).trim();
    if (sliced !== text) attempts.push(sliced);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* Try the trailing-comma repair below. */
    }

    try {
      const repaired = attempt.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* Move on to the next candidate string. */
    }
  }

  throw new AppError("Gemini returned an unexpected format. Please run the scan again.", "PARSE");
}

/* =========================================================
   14. Normalize the model response
   ========================================================= */

function normalizeSentiment(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "Sideways";
  if (/bull|long|buy|upward|uptrend/.test(text)) return "Bullish";
  if (/bear|short|sell|downward|downtrend/.test(text)) return "Bearish";
  return "Sideways";
}

function normalizePatternType(rawType, name) {
  const type = String(rawType ?? "").trim().toLowerCase();
  if (type === "bullish" || /bull|long|buy|up/.test(type)) return "bullish";
  if (type === "bearish" || /bear|short|sell|down/.test(type)) return "bearish";
  if (type === "neutral" || /neutral|side|range/.test(type)) return "neutral";

  const patternName = String(name ?? "").toLowerCase();
  if (/inverse head|morning star|hammer|piercing|bullish|three white|tweezer bottom|cup and handle/.test(patternName)) {
    return "bullish";
  }
  if (/shooting star|evening star|dark cloud|hanging man|bearish|three black|tweezer top/.test(patternName)) {
    return "bearish";
  }
  return "neutral";
}

function normalizePatterns(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim();
        if (!name) return null;
        return { name: name.slice(0, 90), type: normalizePatternType("", name), description: "" };
      }

      if (!item || typeof item !== "object") return null;

      const name = String(item.name ?? item.title ?? item.pattern ?? item.label ?? "").trim();
      if (!name) return null;

      const description = String(
        item.description ?? item.meaning ?? item.note ?? item.detail ?? ""
      ).trim();

      return {
        name: name.slice(0, 90),
        type: normalizePatternType(item.type ?? item.direction ?? item.bias, name),
        description: description.slice(0, 240)
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizePriceCandidate(value) {
  if (value && typeof value === "object") {
    const min = value.min ?? value.low ?? value.from ?? value.start;
    const max = value.max ?? value.high ?? value.to ?? value.end;
    if (min !== undefined && max !== undefined) {
      return `${formatPriceValue(min)} – ${formatPriceValue(max)}`;
    }
    return formatPriceValue(value.price ?? value.level ?? value.value);
  }
  return formatPriceValue(value);
}

function normalizeLevels(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        const price = formatPriceValue(item);
        return price === "—" ? null : { price, note: "" };
      }

      if (!item || typeof item !== "object") return null;

      const price = normalizePriceCandidate(
        item.price ?? item.level ?? item.value ?? item.zone ?? item.range ?? item.area
      );

      if (!price || price === "—") return null;

      const note = String(
        item.note ?? item.description ?? item.reason ?? item.label ?? ""
      ).trim();

      return { price, note: note.slice(0, 180) };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function toDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((item) => toDisplayValue(item)).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") {
    return Object.values(value).map((item) => toDisplayValue(item)).filter(Boolean).join(" · ");
  }
  return formatPriceValue(value);
}

function normalizeTradeSetup(value) {
  const source = value && typeof value === "object" ? value : {};
  const takeProfitRaw =
    source.takeProfit ?? source.take_profit ?? source.targets ?? source.tp ?? source.target;

  return {
    entry: toDisplayValue(source.entry ?? source.entryPrice ?? source.entry_price ?? source.buyZone ?? source.buy_zone),
    stopLoss: toDisplayValue(source.stopLoss ?? source.stop_loss ?? source.sl ?? source.invalidation),
    takeProfit: toDisplayValue(takeProfitRaw),
    riskReward: toDisplayValue(source.riskReward ?? source.risk_reward ?? source.rr ?? source.rMultiple ?? source.r_multiple)
  };
}

function normalizeAnalysis(raw) {
  const source = Array.isArray(raw) ? raw[0] : raw;

  if (!source || typeof source !== "object") {
    throw new AppError("Gemini's analysis was not a valid object. Please retry the scan.", "NORMALIZE");
  }

  const sentiment = normalizeSentiment(
    source.sentiment ?? source.bias ?? source.marketBias ?? source.market_bias
  );

  let confidenceRaw = Number(
    String(source.confidence ?? source.confidenceScore ?? source.confidence_score ?? 0)
      .replace(/%/g, "")
      .trim()
  );
  if (!Number.isFinite(confidenceRaw)) confidenceRaw = 0;
  if (confidenceRaw > 0 && confidenceRaw <= 1) confidenceRaw *= 100;
  const confidence = Math.round(clamp(confidenceRaw, 0, 100));

  let summary = source.summary ?? source.indonesianSummary ?? source.indonesian_summary ?? source.summary_id ?? source.analysis ?? "";
  if (Array.isArray(summary)) summary = summary.join("\n\n");
  summary = String(summary || "").trim();

  return {
    asset: String(source.asset ?? source.symbol ?? source.pair ?? source.market ?? "Unknown chart").trim().slice(0, 60) || "Unknown chart",
    timeframe: String(source.timeframe ?? source.interval ?? source.timeFrame ?? "Unknown").trim().slice(0, 24) || "Unknown",
    sentiment,
    confidence,
    patterns: normalizePatterns(source.patterns ?? source.candlestickPatterns ?? source.candlestick_patterns),
    support: normalizeLevels(source.support ?? source.supportLevels ?? source.support_levels),
    resistance: normalizeLevels(source.resistance ?? source.resistanceLevels ?? source.resistance_levels),
    tradeSetup: normalizeTradeSetup(source.tradeSetup ?? source.trade_setup ?? source.setup),
    summary: summary || "Ringkasan analisis tidak tersedia dari model. Silakan jalankan pemindaian ulang."
  };
}

/* =========================================================
   15. Result dashboard rendering
   ========================================================= */

function renderAnalysis(analysis, options = {}) {
  state.result = analysis;
  state.resultMeta = {
    analyzedAt: options.meta?.analyzedAt || new Date().toISOString(),
    fileName: options.meta?.fileName || state.image?.name || "Chart screenshot",
    thumbnail: options.meta?.thumbnail || "",
    imageInfo: options.meta?.imageInfo || null
  };

  const sentimentKey = analysis.sentiment.toLowerCase();

  if (dom.resultCard) dom.resultCard.dataset.sentiment = sentimentKey;
  if (dom.sentimentBadge) dom.sentimentBadge.dataset.sentiment = sentimentKey;
  if (dom.sentimentText) dom.sentimentText.textContent = analysis.sentiment;
  if (dom.resAsset) dom.resAsset.textContent = analysis.asset;
  if (dom.resTimeframe) dom.resTimeframe.textContent = analysis.timeframe;
  if (dom.resTimestamp) {
    dom.resTimestamp.textContent = `Analyzed ${formatDateTime(state.resultMeta.analyzedAt)} · ${state.resultMeta.fileName}`;
    dom.resTimestamp.title = state.resultMeta.fileName;
  }

  const verdict = getVerdictCopy(analysis.sentiment, analysis.confidence);
  if (dom.verdictTitle) dom.verdictTitle.textContent = verdict.title;
  if (dom.verdictCopy) dom.verdictCopy.textContent = verdict.copy;

  if (dom.confidenceValue) dom.confidenceValue.textContent = "0";
  if (dom.confidenceRing) {
    dom.confidenceRing.style.transition = "none";
    dom.confidenceRing.style.strokeDashoffset = "100";
    void dom.confidenceRing.getBoundingClientRect();
    dom.confidenceRing.style.transition = "";
  }

  renderPatterns(analysis.patterns);
  renderLevels(analysis.support, analysis.resistance);
  renderTradeSetup(analysis.tradeSetup);

  if (dom.patternCount) dom.patternCount.textContent = `${analysis.patterns.length}`;
  if (dom.levelsCount) {
    dom.levelsCount.textContent = `${analysis.support.length + analysis.resistance.length} levels`;
  }

  if (dom.summaryContent) {
    dom.summaryContent.innerHTML = renderMarkdown(analysis.summary);
  }

  if (dom.exportBtn) dom.exportBtn.disabled = false;
  if (dom.copyBtn) dom.copyBtn.disabled = false;

  window.clearTimeout(state.confidenceTimer);
  state.confidenceTimer = window.setTimeout(() => animateConfidence(analysis.confidence), 220);

  if (options.reveal !== false) {
    revealResultCard();
  }
}

function revealResultCard() {
  if (!dom.resultCard) return;
  if (dom.resultEmpty) dom.resultEmpty.hidden = true;

  dom.resultCard.hidden = false;
  dom.resultCard.setAttribute("aria-hidden", "false");
  dom.resultCard.classList.remove("is-visible");
  void dom.resultCard.offsetWidth;
  dom.resultCard.classList.add("is-visible");
}

function hideResultCard() {
  if (state.counterFrame) {
    cancelAnimationFrame(state.counterFrame);
    state.counterFrame = null;
  }
  window.clearTimeout(state.confidenceTimer);

  if (dom.resultCard) {
    dom.resultCard.classList.remove("is-visible");
    dom.resultCard.setAttribute("aria-hidden", "true");
    dom.resultCard.hidden = true;
  }
  if (dom.resultEmpty) dom.resultEmpty.hidden = false;
}

function getVerdictCopy(sentiment, confidence) {
  const verdicts = {
    Bullish: {
      title: "Buyers hold the edge",
      copy: "Structure favors the upside while price holds above the nearest support. Look for continuation or a controlled pullback entry."
    },
    Bearish: {
      title: "Sellers are in control",
      copy: "Momentum favors the downside while price stays below the nearest resistance. Favor short setups or capital preservation."
    },
    Sideways: {
      title: "Price is range-bound",
      copy: "The chart lacks directional conviction. Trade the boundaries with tight risk or wait for a clean breakout with volume."
    }
  };

  const base = verdicts[sentiment] || verdicts.Sideways;
  let copy = base.copy;

  if (confidence >= 80) {
    copy += " Signal alignment is strong, but risk still belongs at invalidation.";
  } else if (confidence < 45) {
    copy += " Clarity is low — reduce position size and wait for confirmation.";
  }

  return { title: base.title, copy };
}

function animateConfidence(target) {
  const value = clamp(Math.round(Number(target) || 0), 0, 100);
  const numberElement = dom.confidenceValue;
  const ring = dom.confidenceRing;
  if (!numberElement) return;

  if (state.counterFrame) {
    cancelAnimationFrame(state.counterFrame);
    state.counterFrame = null;
  }

  if (ring) {
    ring.style.strokeDashoffset = "100";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = String(100 - value);
      });
    });
  }

  if (prefersReducedMotion()) {
    numberElement.textContent = String(value);
    return;
  }

  const duration = 1150;
  const start = performance.now();

  const tick = (now) => {
    const progress = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    numberElement.textContent = String(Math.round(value * eased));

    if (progress < 1) {
      state.counterFrame = requestAnimationFrame(tick);
    } else {
      numberElement.textContent = String(value);
      state.counterFrame = null;
    }
  };

  state.counterFrame = requestAnimationFrame(tick);
}

function renderPatterns(patterns) {
  const container = dom.patternList;
  if (!container) return;
  container.replaceChildren();

  if (!patterns || !patterns.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No high-conviction candlestick patterns detected in this chart.";
    container.appendChild(empty);
    return;
  }

  for (const pattern of patterns) {
    const pill = document.createElement("span");
    pill.className = "pattern-pill";
    pill.dataset.type = pattern.type;
    if (pattern.description) {
      pill.title = pattern.description;
      pill.setAttribute("aria-label", `${pattern.name}: ${pattern.description}`);
    }

    const dot = document.createElement("span");
    dot.className = "pattern-pill__dot";
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = pattern.name;

    pill.append(dot, label);
    container.appendChild(pill);
  }
}

function buildLevelColumn(label, levels, kind) {
  const column = document.createElement("div");
  column.className = `level-column level-column--${kind}`;

  const head = document.createElement("div");
  head.className = "level-column__head";

  const heading = document.createElement("span");
  heading.textContent = label;

  const count = document.createElement("span");
  count.className = "level-column__count";
  count.textContent = `${levels.length}`;

  head.append(heading, count);
  column.appendChild(head);

  if (!levels.length) {
    const empty = document.createElement("div");
    empty.className = "level-empty";
    empty.textContent = "No clear level detected.";
    column.appendChild(empty);
    return column;
  }

  const list = document.createElement("ul");
  list.className = "level-list";

  levels.forEach((level, index) => {
    const item = document.createElement("li");
    item.className = "level-item";

    const tag = document.createElement("span");
    tag.className = "level-tag";
    tag.textContent = `${kind === "support" ? "S" : "R"}${index + 1}`;

    const body = document.createElement("div");
    body.className = "level-body";

    const price = document.createElement("strong");
    price.className = "level-price";
    price.textContent = level.price;
    body.appendChild(price);

    if (level.note) {
      const note = document.createElement("span");
      note.className = "level-note";
      note.textContent = level.note;
      body.appendChild(note);
    }

    item.append(tag, body);
    list.appendChild(item);
  });

  column.appendChild(list);
  return column;
}

function renderLevels(support, resistance) {
  const container = dom.levelsGrid;
  if (!container) return;
  container.replaceChildren();

  container.append(
    buildLevelColumn("Support", support || [], "support"),
    buildLevelColumn("Resistance", resistance || [], "resistance")
  );
}

function renderTradeSetup(setup) {
  const container = dom.tradeGrid;
  if (!container) return;
  container.replaceChildren();

  const safeSetup = setup || {};
  const items = [
    { label: "Entry", value: safeSetup.entry, tone: "neutral" },
    { label: "Stop loss", value: safeSetup.stopLoss, tone: "loss" },
    { label: "Take profit", value: safeSetup.takeProfit, tone: "profit" },
    { label: "Risk / reward", value: safeSetup.riskReward, tone: "accent" }
  ];

  const hasValues = items.some((item) => item.value);

  if (!hasValues) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No clear trade setup was generated for this chart.";
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "trade-item";
    if (item.tone !== "neutral") card.dataset.tone = item.tone;

    const label = document.createElement("span");
    label.className = "trade-label";
    label.textContent = item.label;

    const value = document.createElement("span");
    value.className = "trade-value";
    value.textContent = item.value || "—";

    card.append(label, value);
    container.appendChild(card);
  }
}

/* =========================================================
   16. Safe mini Markdown renderer
   ========================================================= */

function formatInlineMarkdown(text) {
  const codeSpans = [];
  let value = String(text ?? "");

  value = value.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeSpans.length}\u0000`;
    codeSpans.push(code);
    return token;
  });

  value = value
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");

  value = value.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => {
    const code = codeSpans[Number(index)] ?? "";
    return `<code>${code}</code>`;
  });

  return value;
}

function renderMarkdown(markdown) {
  const source = String(markdown ?? "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "<p>—</p>";

  const lines = source.split("\n");
  const html = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.map((line) => formatInlineMarkdown(escapeHtml(line))).join(" ");
    html.push(`<p>${content}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const content = list.items
      .map((item) => `<li>${formatInlineMarkdown(escapeHtml(item))}</li>`)
      .join("");
    html.push(`<${list.type}>${content}</${list.type}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line.replace(/\s+/g, ""))) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      continue;
    }

    const unordered = /^[-*+]\s+(.*)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${formatInlineMarkdown(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return html.join("") || "<p>—</p>";
}

/* =========================================================
   17. LocalStorage history (last 5 analyses)
   ========================================================= */

function loadHistory() {
  state.history = [];
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.history);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    state.history = parsed
      .map((item) => {
        if (!item || typeof item !== "object" || !item.analysis) return null;
        try {
          return {
            id: String(item.id || generateId()),
            createdAt: item.createdAt || new Date().toISOString(),
            fileName: String(item.fileName || "Chart screenshot"),
            thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : "",
            analysis: normalizeAnalysis(item.analysis)
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(0, CONFIG.historyLimit);
  } catch (error) {
    console.warn("[CandleScope] Could not read saved history:", error);
    state.history = [];
  }
}

function persistHistory(items) {
  const attempt = (payload) => {
    localStorage.setItem(CONFIG.storageKeys.history, JSON.stringify(payload));
  };

  try {
    attempt(items);
    return true;
  } catch {
    /* Retry without thumbnails if storage is full. */
  }

  try {
    const lightItems = items.map((item) => ({ ...item, thumbnail: "" }));
    attempt(lightItems);
    state.history = lightItems;
    return true;
  } catch {
    /* Last attempt: keep only the two newest analyses. */
  }

  try {
    const minimalItems = items.slice(0, 2).map((item) => ({ ...item, thumbnail: "" }));
    attempt(minimalItems);
    state.history = minimalItems;
    return true;
  } catch {
    return false;
  }
}

function addToHistory(analysis, meta = {}) {
  let safeAnalysis;
  try {
    safeAnalysis = normalizeAnalysis(analysis);
  } catch {
    return;
  }

  const item = {
    id: generateId(),
    createdAt: meta.analyzedAt || new Date().toISOString(),
    fileName: meta.fileName || state.image?.name || "Chart screenshot",
    thumbnail: meta.thumbnail || "",
    analysis: safeAnalysis
  };

  state.history = [item, ...state.history].slice(0, CONFIG.historyLimit);
  const saved = persistHistory(state.history);
  renderHistory();

  if (!saved && !state.storageWarningShown) {
    state.storageWarningShown = true;
    showToast(
      "Browser storage is full, so this scan could not be saved permanently.",
      "warning",
      "History not saved"
    );
  }
}

function buildHistoryCard(item) {
  const analysis = item.analysis;
  const sentimentKey = analysis.sentiment.toLowerCase();
  const sentimentColor = sentimentKey === "bullish"
    ? "var(--bull)"
    : sentimentKey === "bearish"
      ? "var(--bear)"
      : "var(--side)";

  const card = document.createElement("article");
  card.className = "history-card";
  card.dataset.id = item.id;
  card.style.setProperty("--sentiment", sentimentColor);

  const main = document.createElement("button");
  main.type = "button";
  main.className = "history-main";
  main.dataset.action = "open";
  main.dataset.id = item.id;
  main.setAttribute("aria-label", `Open saved analysis for ${analysis.asset}`);

  const thumb = document.createElement("div");
  thumb.className = "history-thumb";

  if (item.thumbnail) {
    const image = document.createElement("img");
    image.src = item.thumbnail;
    image.alt = `${analysis.asset} ${analysis.timeframe} chart preview`;
    image.loading = "lazy";
    thumb.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "history-thumb-placeholder";
    placeholder.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 18V9m5 9V5m5 13v-6m5 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
    thumb.appendChild(placeholder);
  }

  const badge = document.createElement("span");
  badge.className = "history-thumb-badge";
  badge.textContent = analysis.sentiment;
  thumb.appendChild(badge);

  const body = document.createElement("div");
  body.className = "history-body";

  const assetRow = document.createElement("div");
  assetRow.className = "history-asset-row";

  const asset = document.createElement("span");
  asset.className = "history-asset";
  asset.textContent = analysis.asset;

  const timeframe = document.createElement("span");
  timeframe.className = "history-tf";
  timeframe.textContent = analysis.timeframe;

  assetRow.append(asset, timeframe);

  const metaRow = document.createElement("div");
  metaRow.className = "history-meta-row";

  const time = document.createElement("span");
  time.textContent = formatRelativeTime(item.createdAt);
  time.title = formatDateTime(item.createdAt);

  const confidence = document.createElement("span");
  confidence.className = "history-confidence";
  confidence.innerHTML = `<b>${analysis.confidence}%</b> confidence`;

  metaRow.append(time, confidence);
  body.append(assetRow, metaRow);
  main.append(thumb, body);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "history-delete";
  remove.dataset.action = "delete";
  remove.dataset.id = item.id;
  remove.setAttribute("aria-label", `Delete saved analysis for ${analysis.asset}`);
  remove.innerHTML = `
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.5 5h11M7 5V3.5h4V5m-6 0 .6 9.5h6.8L13 5M7.5 8v4M10.5 8v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  card.append(main, remove);
  return card;
}

function renderHistory() {
  if (!dom.historyGrid) return;

  const items = state.history;
  dom.historyGrid.replaceChildren();

  if (dom.historyCount) dom.historyCount.textContent = String(items.length);
  if (dom.historyCountLabel) dom.historyCountLabel.textContent = `${items.length} / ${CONFIG.historyLimit}`;
  if (dom.clearHistoryBtn) dom.clearHistoryBtn.hidden = items.length === 0;
  if (dom.historyEmpty) dom.historyEmpty.hidden = items.length > 0;
  dom.historyGrid.hidden = items.length === 0;

  for (const item of items) {
    dom.historyGrid.appendChild(buildHistoryCard(item));
  }
}

function loadHistoryItem(id) {
  if (state.isProcessing) {
    showToast("Wait for the current scan to finish before opening a saved analysis.", "warning");
    return;
  }

  const item = state.history.find((entry) => entry.id === id);
  if (!item) return;

  try {
    const analysis = normalizeAnalysis(item.analysis);
    const meta = {
      analyzedAt: item.createdAt,
      fileName: item.fileName,
      thumbnail: item.thumbnail
    };

    renderAnalysis(analysis, {
      reveal: true,
      meta
    });

    setChatContext({
      analysis,
      meta,
      image: dataUrlToChatImage(item.thumbnail)
    });

    setStatus(`Loaded saved scan from ${formatDateTime(item.createdAt)}.`, "ready");
    showToast("Previous analysis loaded from your archive.", "info", "History");
    dom.resultCard?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start"
    });
  } catch (error) {
    console.error("[CandleScope] Could not load history item:", error);
    showToast("This saved analysis is corrupted and cannot be opened.", "error", "History error");
  }
}

function deleteHistoryItem(id) {
  const item = state.history.find((entry) => entry.id === id);
  state.history = state.history.filter((entry) => entry.id !== id);
  persistHistory(state.history);
  renderHistory();

  if (item) {
    showToast(`Removed ${item.analysis.asset} from your archive.`, "info", "History updated");
  }
}

function clearHistory() {
  if (!state.history.length) return;
  if (!window.confirm("Clear all saved analyses? This cannot be undone.")) return;

  state.history = [];
  try {
    localStorage.removeItem(CONFIG.storageKeys.history);
  } catch {
    /* Ignore storage errors when clearing. */
  }
  renderHistory();
  showToast("All saved analyses were cleared.", "info", "History cleared");
}

/* =========================================================
   18. Export / download report
   ========================================================= */

function buildReportMarkdown(analysis, meta = {}) {
  const timestamp = formatDateTime(meta.analyzedAt || new Date().toISOString());
  const setup = analysis.tradeSetup || {};

  const patternLines = analysis.patterns.length
    ? analysis.patterns.map((pattern) => {
        const description = pattern.description ? ` — ${pattern.description}` : "";
        return `- **${pattern.name}** (${pattern.type})${description}`;
      })
    : ["- No high-conviction patterns detected."];

  const levelLines = (levels) => {
    if (!levels.length) return ["- No clear level detected."];
    return levels.map((level) => `- **${level.price}**${level.note ? ` — ${level.note}` : ""}`);
  };

  return [
    `# ${analysis.asset} — Technical Analysis`,
    "",
    `> CandleScope AI · Gemini 3.5 Flash-Lite · ${timestamp}`,
    "",
    `- **Timeframe:** ${analysis.timeframe}`,
    `- **Sentiment:** ${analysis.sentiment}`,
    `- **Confidence:** ${analysis.confidence}%`,
    `- **Source:** ${meta.fileName || "Chart screenshot"}`,
    "",
    "## Candlestick patterns",
    ...patternLines,
    "",
    "## Support levels",
    ...levelLines(analysis.support),
    "",
    "## Resistance levels",
    ...levelLines(analysis.resistance),
    "",
    "## Trade setup",
    `- **Entry:** ${setup.entry || "—"}`,
    `- **Stop loss:** ${setup.stopLoss || "—"}`,
    `- **Take profit:** ${setup.takeProfit || "—"}`,
    `- **Risk / reward:** ${setup.riskReward || "—"}`,
    "",
    "## Analisis teknikal (Bahasa Indonesia)",
    "",
    analysis.summary,
    "",
    "---",
    "_Generated by CandleScope AI for educational purposes only. This is not financial advice. Always verify levels and manage risk._"
  ].join("\n");
}

function downloadReport() {
  if (!state.result) {
    showToast("Run an analysis before downloading a report.", "warning", "No report yet");
    return;
  }

  try {
    const markdown = buildReportMarkdown(state.result, state.resultMeta || {});
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const analyzedDate = new Date(state.resultMeta?.analyzedAt || Date.now());
    const dateStamp = Number.isNaN(analyzedDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : analyzedDate.toISOString().slice(0, 10);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `candlescope-${slugify(state.result.asset)}-${dateStamp}.md`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    showToast("Markdown report downloaded.", "success", "Report exported");
  } catch (error) {
    console.error("[CandleScope] Export failed:", error);
    showToast("The report could not be downloaded. Please try again.", "error", "Export failed");
  }
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }
  textarea.remove();
  return succeeded;
}

async function copySummary() {
  if (!state.result) {
    showToast("Run an analysis before copying a summary.", "warning", "No summary yet");
    return;
  }

  const text = `# ${state.result.asset} — ${state.result.sentiment} (${state.result.confidence}%)\n\n${state.result.summary}`;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else if (!copyTextFallback(text)) {
      throw new Error("Clipboard unavailable");
    }
    showToast("Technical summary copied to your clipboard.", "success", "Copied");
  } catch (error) {
    console.error("[CandleScope] Copy failed:", error);
    if (copyTextFallback(text)) {
      showToast("Technical summary copied to your clipboard.", "success", "Copied");
    } else {
      showToast("Clipboard access was blocked by the browser.", "error", "Copy failed");
    }
  }
}

/* =========================================================
   19. AI Financial Advisor chat
   ========================================================= */

function formatChatClock(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function dataUrlToChatImage(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  const base64 = match[2].replace(/\s+/g, "");
  if (!base64) return null;

  const declared = match[1].toLowerCase();
  return {
    mimeType: declared === "image/jpg" ? "image/jpeg" : declared,
    base64,
    dataUrl
  };
}

function createChatSnapshot(image) {
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;

  try {
    const scale = Math.min(
      CONFIG.chatSnapshotMaxWidth / image.naturalWidth,
      CONFIG.chatSnapshotMaxHeight / image.naturalHeight,
      1
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#040912";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return dataUrlToChatImage(canvas.toDataURL("image/jpeg", CONFIG.chatSnapshotQuality));
  } catch (error) {
    console.warn("[CandleScope] Could not prepare the chat image:", error);
    return null;
  }
}

function buildChatContextText(context) {
  const header = [
    "=== LATEST CHART CONTEXT (authoritative for this conversation) ===",
    "This block is refreshed on every request and describes the latest chart the user scanned or opened from history."
  ];

  if (!context?.analysis) {
    return [
      ...header,
      "No chart has been analyzed yet in this session.",
      "Do not pretend to see a chart. Answer general questions with your expertise and invite the user to scan a chart for chart-specific guidance.",
      "=== END CHART CONTEXT ==="
    ].join("\n");
  }

  const analysis = context.analysis;
  const setup = analysis.tradeSetup || {};
  const imageLine = context.image?.base64
    ? "A compressed screenshot of this chart is attached to the latest user turn. Use it as visual evidence, but treat the structured fields below as the canonical analysis."
    : "No chart image is attached for this context; rely on the structured fields below.";

  const patternLines = analysis.patterns.length
    ? analysis.patterns.map((pattern) => {
        const description = pattern.description ? ` — ${pattern.description}` : "";
        return `- ${pattern.name} (${pattern.type})${description}`;
      })
    : ["- No high-conviction patterns detected."];

  const levelLines = (levels) => {
    if (!levels.length) return ["- No clear level detected."];
    return levels.map((level) => `- ${level.price}${level.note ? ` — ${level.note}` : ""}`);
  };

  return [
    ...header,
    imageLine,
    "",
    `Asset: ${analysis.asset}`,
    `Timeframe: ${analysis.timeframe}`,
    `Sentiment: ${analysis.sentiment}`,
    `Confidence: ${analysis.confidence}%`,
    `Analyzed at: ${formatDateTime(context.meta?.analyzedAt || new Date().toISOString())}`,
    `Source file: ${context.meta?.fileName || "Chart screenshot"}`,
    "",
    "Candlestick patterns:",
    ...patternLines,
    "",
    "Support levels:",
    ...levelLines(analysis.support),
    "",
    "Resistance levels:",
    ...levelLines(analysis.resistance),
    "",
    "Trade setup:",
    `- Entry: ${setup.entry || "—"}`,
    `- Stop loss: ${setup.stopLoss || "—"}`,
    `- Take profit: ${setup.takeProfit || "—"}`,
    `- Risk / reward: ${setup.riskReward || "—"}`,
    "",
    "Technical summary (Bahasa Indonesia):",
    analysis.summary,
    "=== END CHART CONTEXT ==="
  ].join("\n");
}

async function requestGeminiChat({ message, history, context, apiKey, signal }) {
  const trimmedMessage = String(message || "").trim();
  if (!trimmedMessage) {
    throw new AppError("Write a question before sending.", "CHAT_EMPTY");
  }

  const contents = [];
  const recent = Array.isArray(history) ? history.slice(-CONFIG.chatHistoryLimit) : [];

  for (const item of recent) {
    if (item?.error) continue;
    const text = String(item?.content || "").trim();
    if (!text) continue;

    const role = item.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  const imagePart = context?.image?.base64
    ? {
        inline_data: {
          mime_type: context.image.mimeType,
          data: context.image.base64
        }
      }
    : null;

  const last = contents[contents.length - 1];
  if (last?.role === "user") {
    if (imagePart) last.parts.push(imagePart);
    last.parts.push({ text: trimmedMessage });
  } else {
    const parts = [];
    if (imagePart) parts.push(imagePart);
    parts.push({ text: trimmedMessage });
    contents.push({ role: "user", parts });
  }

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: `${CHAT_SYSTEM_PROMPT}\n\n${buildChatContextText(context)}`
        }
      ]
    },
    contents,
    generationConfig: {
      maxOutputTokens: 16384,
      thinkingConfig: {
        thinkingLevel: "medium"
      }
    }
  };

  let response;
  try {
    response = await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(payload),
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AppError("The chat request was cancelled.", "CHAT_ABORTED", error);
    }
    throw new AppError("Could not reach Gemini. Check your connection and try again.", "NETWORK", error);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new AppError("Gemini returned an unreadable chat response. Please try again.", "API_RESPONSE", error);
  }

  if (!response.ok) {
    console.error("[CandleScope] Gemini chat error:", response.status, data);
    throw new AppError(mapApiError(response.status, data), "API_ERROR");
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new AppError(`Gemini blocked this request (${blockReason}). Try rephrasing your question.`, "BLOCKED");
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new AppError("Gemini did not return a chat response. Please try again.", "NO_CANDIDATE");
  }

  if (["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"].includes(candidate.finishReason)) {
    throw new AppError(`Gemini stopped this answer (${candidate.finishReason}). Try another question.`, "BLOCKED");
  }

  const text = (candidate.content?.parts || [])
    .filter((part) => part?.text && part.thought !== true)
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new AppError("Gemini returned an empty chat response. Please send your question again.", "EMPTY_RESPONSE");
  }

  return text;
}

function buildAdvisorGreeting() {
  const context = state.chatContext;

  if (!context?.analysis) {
    return [
      "Halo, aku **CandleScope Mentor** — trader dan mentor keuangan kamu di sini.",
      "",
      "Belum ada chart yang di-scan, jadi kita mulai dari mode umum dulu. Tanya apa saja soal teknikal, fundamental, psikologi market, atau saham IDX — terutama **BMRI, BBCA, BBRI, BBNI**.",
      "",
      "Kalau mau jawaban yang benar-benar nyambung dengan chart kamu, scan chart dulu. Nanti aku otomatis baca konteksnya."
    ].join("\n");
  }

  const { analysis, meta } = context;
  const imageNote = context.image
    ? " Gambar chart-nya juga aku simpan sebagai konteks visual."
    : "";
  const timeNote = meta?.analyzedAt ? ` Konteks ini dari scan ${formatRelativeTime(meta.analyzedAt)}.` : "";

  return [
    `Halo, aku **CandleScope Mentor**. Aku sudah membaca chart **${analysis.asset}** (${analysis.timeframe}) — bias **${analysis.sentiment}** dengan confidence **${analysis.confidence}%**.${imageNote}${timeNote}`,
    "",
    `Kita bisa bedah pola, level support/resistance, setup trading, atau psikologi market di balik pergerakan **${analysis.asset}**. Mau mulai dari mana?`
  ].join("\n");
}

function updateAdvisorContextCard() {
  const card = dom.advisorContextCard;
  if (!card) return;

  const context = state.chatContext;
  const analysis = context?.analysis || null;
  const meta = context?.meta || {};
  const imageDataUrl = context?.image?.dataUrl || meta.thumbnail || "";

  card.dataset.state = analysis ? "active" : "empty";

  if (dom.advisorContextThumb) {
    if (imageDataUrl) {
      dom.advisorContextThumb.src = imageDataUrl;
      dom.advisorContextThumb.alt = analysis ? `Chart context for ${analysis.asset}` : "Chart context";
      dom.advisorContextThumb.hidden = false;
    } else {
      dom.advisorContextThumb.removeAttribute("src");
      dom.advisorContextThumb.alt = "";
      dom.advisorContextThumb.hidden = true;
    }
  }

  if (dom.advisorContextPlaceholder) {
    dom.advisorContextPlaceholder.hidden = Boolean(imageDataUrl);
  }
  if (dom.advisorContextLive) {
    dom.advisorContextLive.hidden = !imageDataUrl;
  }

  if (!analysis) {
    if (dom.advisorContextAsset) dom.advisorContextAsset.textContent = "Belum ada chart";
    if (dom.advisorContextMeta) dom.advisorContextMeta.textContent = "Scan chart untuk mengaktifkan konteks visual.";
    if (dom.advisorContextSource) {
      dom.advisorContextSource.textContent = "";
      dom.advisorContextSource.hidden = true;
    }
    if (dom.advisorContextSentiment) {
      dom.advisorContextSentiment.hidden = true;
      dom.advisorContextSentiment.textContent = "—";
      dom.advisorContextSentiment.removeAttribute("data-sentiment");
    }
    if (dom.advisorStatus) dom.advisorStatus.dataset.state = "general";
    if (dom.advisorStatusText) dom.advisorStatusText.textContent = "Mode umum";
    return;
  }

  if (dom.advisorContextAsset) {
    dom.advisorContextAsset.textContent = analysis.asset;
    dom.advisorContextAsset.title = analysis.asset;
  }
  if (dom.advisorContextMeta) {
    dom.advisorContextMeta.textContent = `${analysis.timeframe} · ${analysis.confidence}% confidence`;
  }
  if (dom.advisorContextSource) {
    const when = formatRelativeTime(meta.analyzedAt);
    const file = meta.fileName || "Chart screenshot";
    dom.advisorContextSource.textContent = [file, when].filter(Boolean).join(" · ");
    dom.advisorContextSource.title = meta.analyzedAt
      ? `${file} · ${formatDateTime(meta.analyzedAt)}`
      : file;
    dom.advisorContextSource.hidden = false;
  }
  if (dom.advisorContextSentiment) {
    dom.advisorContextSentiment.textContent = analysis.sentiment;
    dom.advisorContextSentiment.dataset.sentiment = analysis.sentiment.toLowerCase();
    dom.advisorContextSentiment.hidden = false;
  }
  if (dom.advisorStatus) dom.advisorStatus.dataset.state = "active";
  if (dom.advisorStatusText) dom.advisorStatusText.textContent = "Chart context aktif";
}

function renderAdvisorSuggestions() {
  if (!dom.advisorSuggestions) return;

  dom.advisorSuggestions.replaceChildren();

  const asset = state.chatContext?.analysis?.asset;
  const hasChart = Boolean(asset) && asset !== "Unknown chart";
  const prompts = hasChart
    ? [
        `Bedah setup ${asset} ini`,
        "Di mana area stop loss paling aman?",
        "Apa risiko utama dari chart ini?"
      ]
    : [
        "Cara membaca support & resistance?",
        "Bedanya BBCA vs BBRI?",
        "Kapan sebaiknya cut loss?"
      ];

  for (const prompt of prompts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "advisor-suggestion";
    button.dataset.prompt = prompt;
    button.textContent = prompt;
    button.disabled = state.chatSending;
    dom.advisorSuggestions.appendChild(button);
  }
}

function buildAdvisorMessageElement(message) {
  const isUser = message.role === "user";
  const wrapper = document.createElement("div");
  wrapper.className = `chat-msg chat-msg--${isUser ? "user" : "assistant"}`;
  if (message.error) wrapper.classList.add("chat-msg--error");
  wrapper.dataset.messageId = message.id;

  const avatar = document.createElement("span");
  avatar.className = "chat-msg-avatar";
  avatar.setAttribute("aria-hidden", "true");
  if (isUser) {
    avatar.textContent = "K";
  } else {
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 17.5 8.5 12l3.5 3 3.5-5 4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 20h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>
      </svg>`;
  }

  const body = document.createElement("div");
  body.className = "chat-msg-body";

  const meta = document.createElement("span");
  meta.className = "chat-msg-meta";
  const time = message.greeting ? "baru saja" : formatChatClock(message.createdAt);
  meta.textContent = `${isUser ? "Kamu" : "CandleScope Mentor"} · ${time}`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  if (message.error) bubble.classList.add("is-error");

  if (isUser) {
    bubble.textContent = message.content;
  } else {
    bubble.innerHTML = renderMarkdown(message.content);
  }

  body.append(meta, bubble);
  wrapper.append(avatar, body);
  return wrapper;
}

function scrollAdvisorToBottom() {
  if (!dom.advisorLog) return;
  window.requestAnimationFrame(() => {
    dom.advisorLog.scrollTo({
      top: dom.advisorLog.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  });
}

function renderAdvisorMessages() {
  if (!dom.advisorMessages) return;

  dom.advisorMessages.replaceChildren();
  dom.advisorMessages.appendChild(
    buildAdvisorMessageElement({
      id: "advisor-greeting",
      role: "assistant",
      content: buildAdvisorGreeting(),
      createdAt: new Date().toISOString(),
      greeting: true
    })
  );

  for (const message of state.chatMessages) {
    dom.advisorMessages.appendChild(buildAdvisorMessageElement(message));
  }

  scrollAdvisorToBottom();
}

function appendAdvisorMessage(message) {
  if (!dom.advisorMessages) return;
  dom.advisorMessages.appendChild(buildAdvisorMessageElement(message));
  scrollAdvisorToBottom();
}

function setAdvisorTyping(visible) {
  if (dom.advisorTyping) dom.advisorTyping.hidden = !visible;
  if (dom.advisorTypingLabel) {
    dom.advisorTypingLabel.textContent = state.chatContext?.analysis
      ? "Mentor sedang membaca chart dan menyusun jawaban…"
      : "Mentor sedang menyusun jawaban…";
  }
  if (visible) scrollAdvisorToBottom();
}

function updateAdvisorComposerState() {
  const value = dom.advisorInput?.value || "";
  const length = value.length;
  const hasText = value.trim().length > 0;

  if (dom.advisorCounter) {
    dom.advisorCounter.textContent = `${length} / ${CONFIG.chatMaxChars}`;
    dom.advisorCounter.classList.toggle("is-near-limit", length >= CONFIG.chatMaxChars * 0.9);
  }

  if (dom.advisorSendBtn) {
    dom.advisorSendBtn.disabled = state.chatSending || !hasText;
    dom.advisorSendBtn.classList.toggle("is-loading", state.chatSending);
    dom.advisorSendBtn.setAttribute("aria-busy", state.chatSending ? "true" : "false");
  }
  if (dom.advisorSendLabel) {
    dom.advisorSendLabel.textContent = state.chatSending ? "Membaca…" : "Kirim";
  }

  dom.advisorSuggestions?.querySelectorAll(".advisor-suggestion").forEach((button) => {
    button.disabled = state.chatSending;
  });
}

function resizeAdvisorInput() {
  if (!dom.advisorInput) return;
  dom.advisorInput.style.height = "auto";
  const nextHeight = Math.min(dom.advisorInput.scrollHeight || 38, 132);
  dom.advisorInput.style.height = `${nextHeight}px`;
}

function resetAdvisorChat({ silent = false } = {}) {
  state.chatRequestId += 1;
  if (state.chatController) {
    state.chatController.abort();
    state.chatController = null;
  }

  state.chatSending = false;
  state.chatMessages = [];

  if (dom.advisorInput) dom.advisorInput.value = "";
  setAdvisorTyping(false);
  resizeAdvisorInput();
  updateAdvisorComposerState();
  renderAdvisorMessages();
  renderAdvisorSuggestions();

  if (!silent) {
    showToast("Chat dengan mentor sudah direset.", "info", "Chat reset");
  }
}

function setChatContext({ analysis, meta, image } = {}) {
  let normalized = null;
  if (analysis) {
    try {
      normalized = normalizeAnalysis(analysis);
    } catch (error) {
      console.warn("[CandleScope] Could not set the advisor context:", error);
    }
  }

  state.chatContext = normalized
    ? {
        analysis: normalized,
        meta: {
          analyzedAt: meta?.analyzedAt || new Date().toISOString(),
          fileName: meta?.fileName || "Chart screenshot",
          thumbnail: meta?.thumbnail || ""
        },
        image: image || null
      }
    : null;

  resetAdvisorChat({ silent: true });
  updateAdvisorContextCard();
}

function initializeAdvisor() {
  const latest = state.history[0];

  if (latest) {
    setChatContext({
      analysis: latest.analysis,
      meta: {
        analyzedAt: latest.createdAt,
        fileName: latest.fileName,
        thumbnail: latest.thumbnail
      },
      image: dataUrlToChatImage(latest.thumbnail)
    });
  } else {
    state.chatContext = null;
    updateAdvisorContextCard();
    renderAdvisorMessages();
    renderAdvisorSuggestions();
  }

  resizeAdvisorInput();
  updateAdvisorComposerState();
}

async function sendAdvisorMessage(textOverride) {
  if (state.chatSending) {
    showToast("Wait for the mentor to finish answering first.", "warning");
    return;
  }

  if (state.isProcessing) {
    showToast("Wait for the chart scan to finish before asking the mentor.", "warning");
    return;
  }

  const raw = typeof textOverride === "string" ? textOverride : dom.advisorInput?.value || "";
  const message = raw.trim().slice(0, CONFIG.chatMaxChars);

  if (!message) {
    dom.advisorInput?.focus();
    return;
  }

  if (!state.apiKey) {
    openKeyDialog();
    showToast("Add your Gemini API key to start chatting with the mentor.", "warning", "API key required");
    return;
  }

  const history = state.chatMessages.slice();
  const userMessage = {
    id: generateId(),
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  };

  state.chatMessages.push(userMessage);
  appendAdvisorMessage(userMessage);

  state.chatSending = true;
  const requestId = ++state.chatRequestId;

  if (dom.advisorInput) {
    dom.advisorInput.value = "";
    resizeAdvisorInput();
  }
  updateAdvisorComposerState();
  setAdvisorTyping(true);

  const controller = new AbortController();
  state.chatController = controller;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CONFIG.chatTimeoutMs);

  try {
    const reply = await requestGeminiChat({
      message,
      history,
      context: state.chatContext,
      apiKey: state.apiKey,
      signal: controller.signal
    });

    if (requestId !== state.chatRequestId) return;

    setAdvisorTyping(false);
    const assistantMessage = {
      id: generateId(),
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString()
    };
    state.chatMessages.push(assistantMessage);
    appendAdvisorMessage(assistantMessage);
  } catch (error) {
    if (requestId !== state.chatRequestId) return;
    if (error?.code === "CHAT_ABORTED" && !timedOut) return;

    console.error("[CandleScope] Advisor chat failed:", error);
    const failureText = timedOut
      ? `Waktu tunggu habis (${Math.round(CONFIG.chatTimeoutMs / 1000)} detik) sebelum mentor selesai menjawab. Coba kirim ulang pertanyaanmu.`
      : error instanceof AppError
        ? error.message
        : "Maaf, mentor belum bisa menjawab sekarang. Coba lagi sebentar.";

    setAdvisorTyping(false);
    const errorMessage = {
      id: generateId(),
      role: "assistant",
      content: failureText,
      createdAt: new Date().toISOString(),
      error: true
    };
    state.chatMessages.push(errorMessage);
    appendAdvisorMessage(errorMessage);
    showToast("The mentor's answer could not be loaded. Please send again.", "error", "Chat error");
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === state.chatRequestId) {
      state.chatSending = false;
      state.chatController = null;
      setAdvisorTyping(false);
      updateAdvisorComposerState();
      dom.advisorInput?.focus();
    }
  }
}

/* =========================================================
   20. New scan
   ========================================================= */

function startNewScan() {
  if (state.isProcessing) {
    showToast("Wait for the current scan to finish first.", "warning");
    return;
  }

  state.result = null;
  state.resultMeta = null;
  clearSelectedImage();
  hideResultCard();
  setStatus("Waiting for a chart…", "idle");

  dom.dropzone?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center"
  });
  window.setTimeout(() => dom.dropzone?.focus({ preventScroll: true }), 350);
}

/* =========================================================
   21. Event wiring
   ========================================================= */

function openFilePicker() {
  if (state.isProcessing) {
    showToast("Analysis is still running. Wait for it to finish first.", "warning");
    return;
  }
  dom.fileInput?.click();
}

function preventWindowFileNavigation(event) {
  if (hasDraggedFiles(event)) event.preventDefault();
}

function handleOutsideDrop(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();

  const target = event.target;
  if (target instanceof Node && dom.dropzone?.contains(target)) return;

  showToast("Drop the chart image inside the scan zone.", "info", "Missed the dropzone");
}

function handleHistoryClick(event) {
  if (!(event.target instanceof Element)) return;
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton || !dom.historyGrid?.contains(actionButton)) return;

  const { action, id } = actionButton.dataset;
  if (!id) return;

  if (action === "open") {
    loadHistoryItem(id);
  } else if (action === "delete") {
    event.stopPropagation();
    deleteHistoryItem(id);
  }
}

function setupPreviewObserver() {
  if (!dom.dropzone) return;

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => schedulePreviewDraw());
    observer.observe(dom.dropzone);
  } else {
    window.addEventListener("resize", schedulePreviewDraw);
  }
}

function bindEvents() {
  const dropzone = dom.dropzone;

  if (dropzone) {
    dropzone.addEventListener("click", () => openFilePicker());

    dropzone.addEventListener("keydown", (event) => {
      if (event.target !== dropzone) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilePicker();
      }
    });

    dropzone.addEventListener("dragenter", handleDragEnter);
    dropzone.addEventListener("dragover", handleDragOver);
    dropzone.addEventListener("dragleave", handleDragLeave);
    dropzone.addEventListener("drop", handleDrop);
  }

  window.addEventListener("dragover", preventWindowFileNavigation);
  window.addEventListener("drop", handleOutsideDrop);
  window.addEventListener("dragend", resetDragState);
  window.addEventListener("blur", resetDragState);

  dom.fileInput?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (file) handleFile(file);
  });

  dom.removeImageBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    clearSelectedImage();
  });

  dom.analyzeBtn?.addEventListener("click", handleAnalyze);
  dom.exportBtn?.addEventListener("click", downloadReport);
  dom.copyBtn?.addEventListener("click", copySummary);
  dom.newScanBtn?.addEventListener("click", startNewScan);

  dom.openKeyBtn?.addEventListener("click", openKeyDialog);
  dom.headerKeyBtn?.addEventListener("click", openKeyDialog);
  dom.keyForm?.addEventListener("submit", handleKeySubmit);
  dom.keyDialogClose?.addEventListener("click", closeKeyDialog);
  dom.toggleKeyVisibility?.addEventListener("click", toggleKeyVisibility);

  dom.clearKeyBtn?.addEventListener("click", () => {
    clearApiKey();
    if (dom.apiKeyInput) {
      dom.apiKeyInput.value = "";
      dom.apiKeyInput.focus();
    }
    showToast("The Gemini API key was removed from this browser.", "info", "Disconnected");
  });

  dom.keyDialog?.addEventListener("click", (event) => {
    if (event.target === dom.keyDialog) closeKeyDialog();
  });

  dom.historyBtn?.addEventListener("click", () => {
    dom.historySection?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start"
    });
  });

  dom.historyGrid?.addEventListener("click", handleHistoryClick);
  dom.clearHistoryBtn?.addEventListener("click", clearHistory);

  dom.advisorForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendAdvisorMessage();
  });

  dom.advisorInput?.addEventListener("input", () => {
    if (dom.advisorInput.value.length > CONFIG.chatMaxChars) {
      dom.advisorInput.value = dom.advisorInput.value.slice(0, CONFIG.chatMaxChars);
    }
    resizeAdvisorInput();
    updateAdvisorComposerState();
  });

  dom.advisorInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!state.chatSending) sendAdvisorMessage();
  });

  dom.advisorSuggestions?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(".advisor-suggestion");
    if (!button || button.disabled) return;
    sendAdvisorMessage(button.dataset.prompt || button.textContent || "");
  });

  dom.advisorResetBtn?.addEventListener("click", () => resetAdvisorChat());

  document.addEventListener("paste", handlePaste);

  setupPreviewObserver();
}

/* =========================================================
   22. Boot
   ========================================================= */

function init() {
  cacheDom();
  loadApiKey();
  loadHistory();
  bindEvents();

  updateApiKeyUI();
  updateImageUI();
  updateAnalyzeState();
  renderHistory();
  initializeAdvisor();
  setStatus("Waiting for a chart…", "idle");

  if (dom.confidenceRing) {
    dom.confidenceRing.style.strokeDashoffset = "100";
  }

  schedulePreviewDraw();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}





