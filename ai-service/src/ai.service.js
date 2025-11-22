// ai-service/ai.service.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { log } from "../../backend/src/utils/logger.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.AI_PORT || 5001;
const API_TOKEN = process.env.AI_SERVICE_TOKEN || "dev-token";

// ---------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------
app.use((req, res, next) => {
  const token = req.header("x-ai-service-token");
  if (!token || token !== API_TOKEN) {
    log.warn("Unauthorized AI service request");
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
});

// ---------------------------------------------
// AI CALLS: DeepSeek -> OpenRouter fallback
// ---------------------------------------------

async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");

  log.ai("Calling DeepSeek (primary)...");
  log.ai("Prompt size:", prompt.length);

  const res = await axios.post(
    "https://api.deepseek.com/v1/chat/completions",
    {
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 40_000,
    }
  );

  const out = res.data.choices?.[0]?.message?.content;
  if (!out) throw new Error("Empty DeepSeek response");

  log.ai("DeepSeek responded.");
  return out;
}

async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  log.ai("Calling OpenRouter fallback...");
  log.ai("Prompt size:", prompt.length);

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model:
        process.env.OPENROUTER_MODEL ||
        "meta-llama/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 40_000,
    }
  );

  const out = res.data.choices?.[0]?.message?.content;
  if (!out) throw new Error("Empty OpenRouter response");

  log.ai("OpenRouter responded.");
  return out;
}

// MAIN AI RUNNER
async function runAI(prompt) {
  try {
    return await callDeepSeek(prompt);
  } catch (e) {
    log.warn("DeepSeek failed:", e?.response?.data || e.message);
  }

  try {
    return await callOpenRouter(prompt);
  } catch (e) {
    log.error("OpenRouter fallback also failed:", e?.response?.data || e.message);
  }

  log.error("Both DeepSeek and OpenRouter failed → safe mode");
  return "__SAFE_MODE__";
}

// ---------------------------------------------
// JSON RECOVERY
// ---------------------------------------------
function safeJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  return null;
}

// ---------------------------------------------
// PROMPTS (STRICT JSON + STRICT DIFFS)
// ---------------------------------------------
function rcaPrompt(logs, config, metadata) {
  return `
Analyze the CI/CD pipeline failure and respond ONLY with valid JSON.

INPUT:
LOGS:
${logs}

CI CONFIG:
${config}

META:
${JSON.stringify(metadata)}

Return JSON EXACTLY like this:
{
  "summary": "string",
  "rootCause": "string",
  "category": "dependency | test | config | infra | other",
  "failingFile": "string or null",
  "confidence": 0.0
}
`;
}

function patchPrompt(logs, config, metadata, files = [], targetFilesText = "") {
  const filesSection = (files || [])
    .slice(0, 10)
    .map((f, i) => `# FILE ${i + 1}: ${f.path}\n${f.content.slice(0, 6000)}`)
    .join("\n\n");

  return `
You are an AI DevOps Copilot. Generate ONLY a valid unified diff patch.

RULES:
- STRICT unified diff format (--- a/ | +++ b/ | @@ hunks)
- No markdown
- No code fences
- No explanation
- Must apply cleanly
- Modify only relevant files
- Fix ONLY the error causing the pipeline failure

CONTEXT:
LOGS:\n${logs.slice(0, 20000)}
CI CONFIG:\n${config.slice(0, 10000)}
META:\n${JSON.stringify(metadata).slice(0, 5000)}
TARGET FILES:\n${targetFilesText.slice(0, 5000)}
FILES:\n${filesSection}

Now output ONLY the patch.
`;
}

// ---------------------------------------------
// RCA ROUTE
// ---------------------------------------------
app.post("/ai/rca", async (req, res) => {
  try {
    const { incidentId, logs, gitlabCiConfig, metadata } = req.body;
    log.ai("RCA request for incident:", incidentId);

    const raw = await runAI(rcaPrompt(logs, gitlabCiConfig, metadata));

    if (raw === "__SAFE_MODE__")
      return res.json({
        incidentId,
        summary: "safe-mode",
        rootCause: "AI unavailable",
        category: "other",
        confidence: 0,
        safeMode: true,
      });

    let parsed = safeJSON(raw);
    if (!parsed)
      parsed = {
        summary: "Unable to parse",
        rootCause: "Unknown",
        category: "other",
        confidence: 0.2,
      };

    return res.json({ incidentId, ...parsed, safeMode: false });
  } catch (err) {
    log.error("RCA failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// PATCH ROUTE
// ---------------------------------------------
app.post("/ai/generate-patch", async (req, res) => {
  try {
    const { incidentId, logs, gitlabCiConfig, files, metadata, targetFiles } =
      req.body;

    log.ai("Patch request for incident:", incidentId);

    const raw = await runAI(
      patchPrompt(logs, gitlabCiConfig, metadata, files, targetFiles)
    );

    if (raw === "__SAFE_MODE__")
      return res.json({
        incidentId,
        diff: "",
        description: "safe mode",
        risk: "high",
        safeMode: true,
      });

    const diff = raw
      .replace(/```diff/gi, "")
      .replace(/```/g, "")
      .trim();

    if (!diff || diff.length < 10) {
      log.warn("Patch too small/empty");
      return res.json({
        incidentId,
        diff: "",
        description: "empty-patch",
        risk: "high",
      });
    }

    return res.json({
      incidentId,
      diff,
      description: "ai-patch",
      risk: "medium",
      safeMode: false,
    });
  } catch (err) {
    log.error("Patch generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// BOOT
// ---------------------------------------------
app.listen(PORT, () =>
  log.success(`AI service running with DeepSeek (fallback OpenRouter) on ${PORT}`)
);