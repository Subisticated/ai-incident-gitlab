import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import axios from "axios";

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
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
});

// ---------------------------------------------
// CLIENTS
// ---------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function callGroq(prompt) {
  return groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are an API that must output STRICT JSON. No markdown. No ``` . No commentary. No explanations. No extra text. Only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  });
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const res = await axios.post(url, body);

  return res.data.candidates[0].content.parts[0].text;
}

// ---------------------------------------------
// JSON PARSER — AUTO FIXER
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
// PROMPTS
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
  "confidence": 0.0
}
`;
}

function patchPrompt(logs, config, metadata) {
  return `You are an AI DevOps Copilot generating FIXES for GitLab CI pipeline failures.

Your output MUST ALWAYS be a VALID UNIFIED DIFF PATCH.

RULES:
1. Always include BOTH headers exactly:
  --- a/<file_path>
  +++ b/<file_path>

2. Always include at least one real change.
  Never return an empty diff.

3. Never use /dev/null unless you are creating a new file.
  For new files:
    --- /dev/null
    +++ b/<file>

4. NEVER output plain text, explanation, markdown or JSON.
  ONLY output a unified diff.

5. Hunk must be formatted exactly:
  @@ -<old_line>,<old_count> +<new_line>,<new_count> @@

6. Your patch MUST PRODUCE VALID, WORKING CODE.

7. If the fix is unclear, create a safe fallback fix:
  - comment out the failing line
  - add a safe replacement line

8. Do not include triple-backticks.

9. Target use case:
  - fix shell script failures
  - fix missing directory
  - fix failing commands
  - fix CI YAML issues

Context (do not echo back, just use for reasoning):
LOGS:
${logs}

CI CONFIG:
${config}

META:
${JSON.stringify(metadata)}

Return ONLY the unified diff.
`;
}

// ---------------------------------------------
// GENERIC CALLER
// ---------------------------------------------
async function runAI(prompt) {
  try {
    const result = await callGroq(prompt);
    return result.choices[0].message.content;
  } catch (err) {
    console.log("Groq primary failed, falling back to Gemini");
    console.log("Groq error:", err?.response?.data || err.message);

    const gem = await callGemini(prompt);
    return gem;
  }
}

// ---------------------------------------------
// RCA ROUTE
// ---------------------------------------------
app.post("/ai/rca", async (req, res) => {
  try {
    const { incidentId, logs, gitlabCiConfig, metadata } = req.body;

    const raw = await runAI(rcaPrompt(logs, gitlabCiConfig, metadata));

    let parsed = safeJSON(raw);

    if (!parsed) {
      parsed = {
        summary: "Unable to parse response",
        rootCause: "Unknown",
        category: "other",
        confidence: 0.2,
      };
    }

    return res.json({ incidentId, ...parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// PATCH ROUTE
// ---------------------------------------------
app.post("/ai/generate-patch", async (req, res) => {
  try {
    const { incidentId, logs, gitlabCiConfig, files, metadata } = req.body;

    const raw = await runAI(patchPrompt(logs, gitlabCiConfig, metadata));
    const diff = (raw || "").trim();

    const cleanDiff = diff
      .replace(/```diff/gi, "")
      .replace(/```/g, "")
      .trim();

    if (!cleanDiff || cleanDiff.length < 10) {
      return res.json({
        incidentId,
        diff: "",
        description: "AI could not generate patch",
        risk: "high",
      });
    }

    return res.json({
      incidentId,
      diff: cleanDiff,
      description: "AI-generated patch",
      risk: "medium",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------
// BOOT
// ---------------------------------------------
app.listen(PORT, () =>
  console.log(`AI service running (GROQ -> GEMINI fallback) on ${PORT}`)
); 