// backend/src/services/ai.service.js
import axios from "axios";
import logger from "../utils/logger.js";
import { strictRcaPrompt, buildPatchPrompt } from "./prompts.js";

/**
 * AI service:
 * Primary: DeepSeek (if DEEPSEEK_API_KEY provided)
 * Fallback: Gemini (if GEMINI_API_KEY provided)
 * Safe-mode sentinel: "__SAFE_MODE__"
 */

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = process.env.DEEPSEEK_URL || "https://api.deepseek.com/v1";

async function callDeepseek(prompt, mode = "text") {
  if (!DEEPSEEK_KEY) throw new Error("Missing DEEPSEEK_API_KEY");
  try {
    const res = await axios.post(`${DEEPSEEK_URL}/chat/completions`, {
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "system", content: mode === "json" ? "OUTPUT_JSON" : "OUTPUT_TEXT" }, { role: "user", content: prompt }],
      temperature: 0
    }, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 120000 });
    return res.data?.choices?.[0]?.message?.content || "";
  } catch (err) {
    logger.error("[AI] DeepSeek request failed:", err.response?.data || err.message);
    throw err;
  }
}

// Gemini fallback (simple resolver)
async function listGeminiModels(apiKey) {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    return res.data.models || [];
  } catch (e) {
    return [];
  }
}
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  try {
    const models = await listGeminiModels(key);
    const prefer = ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro"];
    const found = models.find(m => prefer.some(p => m.name.endsWith("/" + p)));
    const model = found ? found.name.split("/").pop() : process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
    const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } });
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (err) {
    logger.error("[AI] Gemini request failed:", err.response?.data || err.message);
    throw err;
  }
}

async function runProvider(prompt, mode = "text") {
  // try DeepSeek
  if (DEEPSEEK_KEY) {
    try { return await callDeepseek(prompt, mode); } catch (e) { logger.warn("[AI] DeepSeek failed, trying Gemini"); }
  }
  // Gemini fallback
  try { return await callGemini(prompt); } catch (e) { logger.warn("[AI] Gemini failed"); }
  // safe-mode
  logger.error("[AI] All providers failed — entering SAFE_MODE");
  return "__SAFE_MODE__";
}

// API
export async function runRCA({ logs = "", gitlabCiConfig = "", metadata = {} }) {
  logger.info("[AI] runRCA with provider");
  const prompt = strictRcaPrompt(logs, gitlabCiConfig, metadata);
  const raw = await runProvider(prompt, "json");
  if (raw === "__SAFE_MODE__") return { summary: "AI unavailable", rootCause: "unavailable", category: "other", confidence: 0.0, usedModel: null, safeMode: true };
  try {
    return JSON.parse(raw);
  } catch {
    // try extract object
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { summary: "Unable to parse RCA", rootCause: "unknown", category: "other", confidence: 0.2, usedModel: null, safeMode: false };
  }
}

export async function runPatchGeneration({ logs = "", gitlabCiConfig = "", metadata = {}, files = [], targetFilesText = "" }) {
  logger.info("[AI] runPatchGeneration with provider");
  const prompt = buildPatchPrompt({
    logs,
    gitlabCiConfig,
    files,
    metadata,
    targetFiles: targetFilesText,
  });
  const raw = await runProvider(prompt, "diff");
  if (raw === "__SAFE_MODE__") return { diff: "", raw, usedModel: null, safeMode: true };
  // clean common wrappers
  let diff = String(raw).replace(/```diff|```/gi, "").trim();
  return { diff, raw, usedModel: null, safeMode: false };
}