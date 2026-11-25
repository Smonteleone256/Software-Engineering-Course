require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");

const app = express();

const PORT = Number.parseInt(process.env.PORT || "4242", 10);
const SQUARE_ENV = String(process.env.SQUARE_ENV || "sandbox").trim().toLowerCase();
const SQUARE_ACCESS_TOKEN = String(process.env.SQUARE_ACCESS_TOKEN || "").trim();
const SQUARE_LOCATION_ID = String(process.env.SQUARE_LOCATION_ID || "").trim();
const SQUARE_APPLICATION_ID = String(process.env.SQUARE_APPLICATION_ID || "").trim();
const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || "http://localhost:4173").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
const OPENAI_MODEL_NANO = String(process.env.OPENAI_MODEL_NANO || "gpt-5-nano").trim();
const OPENAI_MODEL_MINI = String(process.env.OPENAI_MODEL_MINI || "gpt-5-mini").trim();
const OPENAI_MODEL_POWER = String(process.env.OPENAI_MODEL_POWER || "gpt-5").trim();
const AI_REQUEST_TIMEOUT_MS = Math.max(5000, Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "30000", 10) || 30000);
const AI_MAX_OUTPUT_TOKENS = Math.max(80, Number.parseInt(process.env.AI_MAX_OUTPUT_TOKENS || "220", 10) || 220);
const AI_FALLBACK_TO_MINI = String(process.env.AI_FALLBACK_TO_MINI || "false").trim().toLowerCase() === "true";
const JSON_BODY_LIMIT = String(process.env.JSON_BODY_LIMIT || "10mb").trim() || "10mb";
const AI_MAX_INPUT_IMAGES = Math.max(0, Math.min(6, Number.parseInt(process.env.AI_MAX_INPUT_IMAGES || "3", 10) || 3));
const AI_MAX_INPUT_DOCUMENTS = Math.max(0, Math.min(4, Number.parseInt(process.env.AI_MAX_INPUT_DOCUMENTS || "2", 10) || 2));
const AI_MAX_ATTACHMENT_CONTEXT_CHARS = Math.max(0, Number.parseInt(process.env.AI_MAX_ATTACHMENT_CONTEXT_CHARS || "12000", 10) || 12000);
const AI_MAX_IMAGE_DATA_URL_CHARS = Math.max(25000, Number.parseInt(process.env.AI_MAX_IMAGE_DATA_URL_CHARS || "400000", 10) || 400000);
const AI_MAX_DOCUMENT_DATA_URL_CHARS = Math.max(150000, Number.parseInt(process.env.AI_MAX_DOCUMENT_DATA_URL_CHARS || "1800000", 10) || 1800000);

if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID || !SQUARE_APPLICATION_ID) {
  console.error("Missing Square config. Set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APPLICATION_ID in .env.");
  process.exit(1);
}

const SQUARE_API_BASE = SQUARE_ENV === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";
const SQUARE_API_VERSION = "2026-01-22";

app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

function parseAmountCents(value) {
  const amount = Number.parseInt(value, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function buildMoney(amountCents) {
  return {
    amount: BigInt(amountCents),
    currency: "USD"
  };
}

function normalizeApiError(error, fallback = "Square request failed.") {
  if (error?.result?.errors?.length) {
    const first = error.result.errors[0];
    return `${first.code || "ERROR"}: ${first.detail || first.category || fallback}`;
  }
  return String(error?.message || fallback);
}

function shortIdempotencyKey(prefix, visitId = "", amountCents = 0) {
  const visitPart = String(visitId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "visit";
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}-${visitPart}-${Number(amountCents) || 0}-${randomPart}`;
}

async function squareRequest(path, { method = "GET", body = null } = {}) {
  const response = await fetch(`${SQUARE_API_BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${SQUARE_ACCESS_TOKEN}`,
      "Square-Version": SQUARE_API_VERSION,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const first = payload?.errors?.[0];
    const detail = first?.detail || first?.code || `Square request failed (${response.status})`;
    const error = new Error(detail);
    error.result = payload;
    throw error;
  }
  return payload;
}

function chooseAiModel(question = "", preference = "auto") {
  const route = String(preference || "auto").trim().toLowerCase();
  if (route === "nano") return OPENAI_MODEL_NANO;
  if (route === "mini") return OPENAI_MODEL_MINI;
  if (route === "power") return OPENAI_MODEL_POWER;

  const text = String(question || "").trim();
  const length = text.length;
  const hardKeywords = [
    "differential", "diagnosis", "triage", "protocol", "contraindication", "interaction",
    "anesthetic", "surgery", "dosage", "dose", "policy", "legal", "risk", "escalate",
    "multi-step", "step-by-step", "plan"
  ];
  const hasHardKeyword = hardKeywords.some((keyword) => text.toLowerCase().includes(keyword));
  const hasManyQuestions = (text.match(/\?/g) || []).length >= 2;
  const hasLongList = text.includes("\n") && text.split("\n").length >= 5;

  if (length <= 180 && !hasHardKeyword && !hasManyQuestions && !hasLongList) return OPENAI_MODEL_NANO;
  return OPENAI_MODEL_MINI;
}

function extractResponseText(payload = {}) {
  const normalize = (text) => String(text || "").replace(/\r/g, "").trim();
  const dedupeRepeatedBlock = (text) => {
    const value = normalize(text);
    if (!value) return "";
    const rawLines = value.split("\n");
    const comparable = rawLines.map((line) => line.trim()).filter(Boolean);
    if (comparable.length >= 2 && comparable.length % 2 === 0) {
      const half = comparable.length / 2;
      const firstComparable = comparable.slice(0, half).join("\n");
      const secondComparable = comparable.slice(half).join("\n");
      if (firstComparable && firstComparable === secondComparable) {
        return comparable.slice(0, half).join("\n").trim();
      }
    }
    return value;
  };

  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  if (Array.isArray(payload.output_text)) {
    const joined = dedupeRepeatedBlock(payload.output_text.filter((v) => typeof v === "string").join("\n"));
    if (joined) return joined;
  }
  const segments = [];
  for (const item of payload.output || []) {
    for (const part of item.content || []) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part.text === "string") {
        segments.push(part.text);
      } else if (typeof part?.text === "string") {
        segments.push(part.text);
      }
    }
    if (typeof item?.content === "string") segments.push(item.content);
  }
  return dedupeRepeatedBlock(segments.join("\n"));
}

function buildFallbackAnswer(question = "", clientContext = "") {
  const text = String(clientContext || "");
  const lines = text.split("\n").map((line) => line.trim());
  const clientLine = lines.find((line) => line.toLowerCase().startsWith("client:"));
  const clientName = clientLine ? clientLine.replace(/^client:\s*/i, "").trim() : "Unknown client";

  const patients = [];
  let current = null;
  for (const line of lines) {
    if (line.toLowerCase().startsWith("patient:")) {
      if (current) patients.push(current);
      current = { name: line.replace(/^patient:\s*/i, "").trim(), signalment: "", visits: [] };
      continue;
    }
    if (!current) continue;
    if (line.toLowerCase().startsWith("signalment:")) current.signalment = line.replace(/^signalment:\s*/i, "").trim();
    if (line.startsWith("- Visit ")) current.visits.push(line.replace(/^-+\s*/, "").trim());
  }
  if (current) patients.push(current);

  const questionText = String(question || "").toLowerCase();
  const mentioned = patients.find((patient) => questionText.includes(String(patient.name || "").toLowerCase()));
  const patient = mentioned || patients[0];

  if (!patient) {
    return `- Client: ${clientName}\n- No patient records were found in the current context.\n- Please open a patient and try again.`;
  }

  const visitSummary = patient.visits.length ? patient.visits[0] : "No visits on file";
  return [
    `- Client: ${clientName}`,
    `- Patient: ${patient.name || "Unknown patient"}`,
    `- Signalment: ${patient.signalment || "Unknown"}`,
    `- Most recent visit: ${visitSummary}`
  ].join("\n");
}

function clampAiText(value = "", maxChars = 0) {
  const text = String(value || "").trim();
  if (!maxChars || maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}\n[truncated]`;
}

function sanitizeAttachmentContext(rawAttachmentContext) {
  return clampAiText(rawAttachmentContext, AI_MAX_ATTACHMENT_CONTEXT_CHARS);
}

function sanitizeAttachmentImages(rawAttachmentImages) {
  if (!Array.isArray(rawAttachmentImages)) return [];
  return rawAttachmentImages
    .slice(0, AI_MAX_INPUT_IMAGES)
    .map((image, index) => {
      const name = String(image?.name || `image-${index + 1}`).trim().slice(0, 120) || `image-${index + 1}`;
      const dataUrl = String(image?.dataUrl || "").trim();
      if (!dataUrl) return null;
      if (!dataUrl.startsWith("data:image/")) return null;
      if (!dataUrl.includes(";base64,")) return null;
      if (dataUrl.length > AI_MAX_IMAGE_DATA_URL_CHARS) return null;
      return {
        name,
        dataUrl
      };
    })
    .filter(Boolean);
}

function sanitizeAttachmentDocuments(rawAttachmentDocuments) {
  if (!Array.isArray(rawAttachmentDocuments)) return [];
  return rawAttachmentDocuments
    .slice(0, AI_MAX_INPUT_DOCUMENTS)
    .map((document, index) => {
      const name = String(document?.name || `attachment-${index + 1}.pdf`).trim().slice(0, 120) || `attachment-${index + 1}.pdf`;
      const dataUrl = String(document?.dataUrl || "").trim();
      if (!dataUrl) return null;
      if (!dataUrl.startsWith("data:application/pdf;base64,")) return null;
      if (dataUrl.length > AI_MAX_DOCUMENT_DATA_URL_CHARS) return null;
      return {
        name: name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`,
        dataUrl
      };
    })
    .filter(Boolean);
}

function buildAiUserContentParts({ clientContext, question, attachmentContext = "", attachmentImages = [], attachmentDocuments = [] }) {
  const parts = [];
  let text = `Client records:\n${clientContext}\n\nQuestion:\n${question}\n\nReturn a direct answer with bullet points when useful.`;
  if (attachmentContext) {
    text += `\n\nAttachment excerpts (truncated):\n${attachmentContext}`;
  }
  parts.push({ type: "input_text", text });
  attachmentImages.forEach((image, index) => {
    parts.push({ type: "input_text", text: `Attachment image ${index + 1}: ${image.name}` });
    parts.push({ type: "input_image", image_url: image.dataUrl });
  });
  attachmentDocuments.forEach((document, index) => {
    parts.push({ type: "input_text", text: `Attachment document ${index + 1}: ${document.name}` });
    parts.push({
      type: "input_file",
      filename: document.name,
      file_data: document.dataUrl
    });
  });
  return parts;
}

async function openAiResponsesRequest({ model, systemPrompt, userContentParts }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_output_tokens: AI_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "minimal" },
        text: { verbosity: "low", format: { type: "text" } },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: userContentParts
          }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(payload?.error?.message || `OpenAI request failed (${response.status}).`);
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

app.post("/api/ai/client-ask", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(503).json({ error: "OpenAI is not configured on the server." });

    const question = String(req.body?.question || "").trim();
    const clientContext = String(req.body?.clientContext || "").trim();
    const modelPreference = String(req.body?.modelPreference || "auto").trim().toLowerCase();
    const attachmentContext = sanitizeAttachmentContext(req.body?.attachmentContext);
    const attachmentImages = sanitizeAttachmentImages(req.body?.attachmentImages);
    const attachmentDocuments = sanitizeAttachmentDocuments(req.body?.attachmentDocuments);
    if (!question) return res.status(400).json({ error: "question is required." });
    if (!clientContext) return res.status(400).json({ error: "clientContext is required." });

    let model = chooseAiModel(question, modelPreference);
    if ((attachmentImages.length || attachmentDocuments.length) && model === OPENAI_MODEL_NANO) model = OPENAI_MODEL_MINI;
    const systemPrompt = "You are a veterinary clinic assistant. Answer only from provided records and attachments (including PDF documents and images). If unknown, say unknown. Be concise and clinically clear.";
    const userContentParts = buildAiUserContentParts({ clientContext, question, attachmentContext, attachmentImages, attachmentDocuments });
    const payload = await openAiResponsesRequest({ model, systemPrompt, userContentParts });
    let answer = extractResponseText(payload);
    let resolvedModel = model;
    if (!answer && AI_FALLBACK_TO_MINI && model !== OPENAI_MODEL_MINI) {
      const retryPayload = await openAiResponsesRequest({ model: OPENAI_MODEL_MINI, systemPrompt, userContentParts });
      answer = extractResponseText(retryPayload);
      resolvedModel = OPENAI_MODEL_MINI;
    }
    if (!answer) {
      answer = buildFallbackAnswer(question, clientContext);
      resolvedModel = `${resolvedModel}+fallback`;
    }

    return res.json({
      answer,
      model: resolvedModel,
      routedBy: modelPreference === "auto" ? "auto" : "manual"
    });
  } catch (error) {
    const question = String(req.body?.question || "").trim();
    const clientContext = String(req.body?.clientContext || "").trim();
    const fallbackAnswer = buildFallbackAnswer(question, clientContext);
    return res.json({
      answer: fallbackAnswer,
      model: "fallback-local",
      routedBy: "fallback"
    });
  }
});

app.get("/api/square/config", (_req, res) => {
  res.json({
    applicationId: SQUARE_APPLICATION_ID,
    locationId: SQUARE_LOCATION_ID,
    environment: SQUARE_ENV
  });
});

app.post("/api/square/payments/web", async (req, res) => {
  try {
    const sourceId = String(req.body?.sourceId || "").trim();
    const visitId = String(req.body?.visitId || "").trim();
    const amountCents = parseAmountCents(req.body?.amountCents);

    if (!sourceId) return res.status(400).json({ error: "sourceId is required." });
    if (!visitId) return res.status(400).json({ error: "visitId is required." });
    if (!amountCents) return res.status(400).json({ error: "amountCents must be a positive integer." });

    const idempotencyKey = shortIdempotencyKey("ocweb", visitId, amountCents);
    const paymentRequest = {
      sourceId,
      idempotencyKey,
      locationId: SQUARE_LOCATION_ID,
      amountMoney: buildMoney(amountCents),
      note: `OneClick visit ${visitId}`,
      autocomplete: true,
      referenceId: visitId
    };

    const result = await squareRequest("/v2/payments", { method: "POST", body: paymentRequest });
    const payment = result?.payment || {};

    return res.json({
      squarePaymentId: String(payment.id || ""),
      status: String(payment.status || "").toLowerCase() || "completed",
      receiptUrl: String(payment.receiptUrl || "")
    });
  } catch (error) {
    return res.status(500).json({ error: normalizeApiError(error, "Could not create Square web payment.") });
  }
});

app.post("/api/square/payments/terminal", async (req, res) => {
  try {
    const visitId = String(req.body?.visitId || "").trim();
    const deviceId = String(req.body?.deviceId || "").trim();
    const amountCents = parseAmountCents(req.body?.amountCents);

    if (!visitId) return res.status(400).json({ error: "visitId is required." });
    if (!deviceId) return res.status(400).json({ error: "deviceId is required." });
    if (!amountCents) return res.status(400).json({ error: "amountCents must be a positive integer." });

    const idempotencyKey = shortIdempotencyKey("octerm", visitId, amountCents);
    const checkoutRequest = {
      idempotencyKey,
      checkout: {
        amountMoney: buildMoney(amountCents),
        referenceId: visitId,
        note: `OneClick visit ${visitId}`,
        deviceOptions: {
          deviceId,
          skipReceiptScreen: false
        }
      }
    };

    const result = await squareRequest("/v2/terminals/checkouts", { method: "POST", body: checkoutRequest });
    const checkout = result?.checkout || {};

    return res.json({
      checkoutId: String(checkout.id || ""),
      status: String(checkout.status || "PENDING")
    });
  } catch (error) {
    return res.status(500).json({ error: normalizeApiError(error, "Could not create terminal checkout.") });
  }
});

app.get("/api/square/terminal/:checkoutId", async (req, res) => {
  try {
    const checkoutId = String(req.params?.checkoutId || "").trim();
    if (!checkoutId) return res.status(400).json({ error: "checkoutId is required." });

    const result = await squareRequest(`/v2/terminals/checkouts/${encodeURIComponent(checkoutId)}`);
    const checkout = result?.checkout || {};
    const paymentIds = Array.isArray(checkout.paymentIds) ? checkout.paymentIds : [];

    return res.json({
      checkoutId: String(checkout.id || checkoutId),
      status: String(checkout.status || "UNKNOWN"),
      squarePaymentId: String(paymentIds[0] || "")
    });
  } catch (error) {
    return res.status(500).json({ error: normalizeApiError(error, "Could not fetch terminal checkout.") });
  }
});

app.listen(PORT, () => {
  console.log(`OneClick Square server listening on http://localhost:${PORT}`);
});
