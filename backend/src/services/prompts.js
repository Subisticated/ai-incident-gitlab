// backend/src/services/prompts.js
export function strictRcaPrompt(logs, ciConfig, metadata = {}) {
  return `
You are a CI failure analysis engine. OUTPUT ONLY valid JSON matching:
{ "summary":"string", "rootCause":"string", "category":"config | dependency | test | infra | timeout | other", "confidence": 0.0 }
LOGS:
${logs}
CI:
${ciConfig}
META:
${JSON.stringify(metadata)}
`;
}

export function buildPatchPrompt({ logs, gitlabCiConfig, files, metadata, targetFiles }) {
  return `
You are an AI DevOps Engineer. Generate ONLY a valid unified diff patch.
NO explanations. NO markdown. NO code fences. ONLY the raw diff.

STRICT FORMAT RULES (read carefully):

1. The diff MUST start with:
   diff --git a/<path> b/<path>
   --- a/<path>
   +++ b/<path>

2. For each modified file:
   Provide ONE AND ONLY ONE hunk header:
   @@ -<old_start>,<old_count> +<new_start>,<new_count> @@

3. Allowed lines inside hunks:
   - Context lines (start with exactly ONE space): " <code>"
   - Additions: "+<code>"
   - Deletions: "-<code>"

4. NEVER produce lines that start with:
   "+++" without header, "---" without header, "exit 1", shell commands, JSON, prose, or comments.

5. NO explanations, no English sentences, no reasoning, no summary.
   ONLY the unified diff.

6. Patch MUST fix the actual error indicated in logs. NO hallucinated edits.

7. If unsure, DO NOT fabricate changes. Apply minimal fixes.

--------------------------
INPUT CONTEXT (DO NOT ECHO)
--------------------------
LOGS:
${logs.slice(0, 15000)}

CI CONFIG (.gitlab-ci.yml):
${gitlabCiConfig.slice(0, 10000)}

TARGET FILES:
${targetFiles}

FILE CONTENTS:
${files
    .slice(0, 12)
    .map(
      (f, i) => `
### FILE ${i + 1}: ${f.path}
${f.content.slice(0, 6000)}
`
    )
    .join("\n")}

METADATA:
${JSON.stringify(metadata).slice(0, 5000)}

--------------------------
NOW OUTPUT ONLY THE UNIFIED DIFF.
NO BACKTICKS. NO MARKDOWN. NO EXTRA TEXT.
--------------------------
`;
}
