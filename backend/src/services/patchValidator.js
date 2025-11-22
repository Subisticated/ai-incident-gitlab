// backend/src/services/patchValidator.js
import { info, warn, error } from "../utils/logger.js";

/**
 * Validate unified diff syntax strictly.
 * Ensures:
 * - correct diff headers
 * - correct hunk headers
 * - correct context/add/remove lines
 * - no hallucinated garbage
 * - minimal structural correctness
 */

export function validateUnifiedDiff(diff, originalFile = "") {
  info("[VALIDATOR] Validating diff...");

  if (!diff || typeof diff !== "string" || diff.trim().length < 10) {
    warn("[VALIDATOR] FAIL: Empty or invalid diff input");
    return { ok: false, error: "Empty or invalid diff" };
  }

  const lines = diff.split("\n");

  // -----------------------------------------------------
  // 1. Must start with a diff header
  // -----------------------------------------------------
  if (!lines[0].startsWith("diff --git")) {
    warn(`[VALIDATOR] FAIL: Missing 'diff --git' header`);
    return { ok: false, error: "Missing diff header" };
  }

  let inHunk = false;
  let expectedOldCount = 0;
  let expectedNewCount = 0;
  let oldSeen = 0;
  let newSeen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // -----------------------------------------------------
    // diff headers
    // -----------------------------------------------------
    if (line.startsWith("diff --git")) {
      inHunk = false;
      continue;
    }

    if (line.startsWith("--- ")) continue;
    if (line.startsWith("+++ ")) continue;

    // -----------------------------------------------------
    // Hunk header
    // @@ -a,b +c,d @@
    // -----------------------------------------------------
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);

      if (!match) {
        warn(`[VALIDATOR] FAIL: Malformed hunk header '${line}'`);
        return { ok: false, error: "Malformed hunk header" };
      }

      inHunk = true;

      expectedOldCount = Number(match[2] || 1);
      expectedNewCount = Number(match[4] || 1);

      oldSeen = 0;
      newSeen = 0;

      continue;
    }

    // -----------------------------------------------------
    // If inside a hunk, validate line types
    // -----------------------------------------------------
    if (inHunk) {
      // ADDITION
      if (line.startsWith("+") && !line.startsWith("+++")) {
        newSeen++;
        continue;
      }

      // DELETION
      if (line.startsWith("-") && !line.startsWith("---")) {
        oldSeen++;
        continue;
      }

      // CONTEXT LINE (ONE leading space)
      if (line.startsWith(" ")) {
        oldSeen++;
        newSeen++;
        continue;
      }

      // EMPTY ADDITION (rare but allowed)
      if (line === "+") {
        newSeen++;
        continue;
      }

      // Invalid line inside hunk
      warn(`[VALIDATOR] FAIL: Invalid diff line inside hunk: "${line}"`);
      return { ok: false, error: `Invalid diff line inside hunk: "${line}"` };
    }

    // -----------------------------------------------------
    // Outside hunk → unknown junk line
    // -----------------------------------------------------
    if (!line.trim().length) continue; // allow empty lines

    if (line.startsWith("index ")) continue;
    if (line.startsWith("new file mode")) continue;
    if (line.startsWith("deleted file mode")) continue;

    // Something weird
    warn(`[VALIDATOR] FAIL: Unexpected line outside hunk: "${line}"`);
    return { ok: false, error: `Unexpected line outside hunk: "${line}"` };
  }

  // -----------------------------------------------------
  // Hunk line count validation
  // -----------------------------------------------------
  if (inHunk) {
    if (expectedOldCount && oldSeen < expectedOldCount) {
      return {
        ok: false,
        error: `Hunk old_count mismatch: expected ${expectedOldCount}, saw ${oldSeen}`
      };
    }

    if (expectedNewCount && newSeen < expectedNewCount) {
      return {
        ok: false,
        error: `Hunk new_count mismatch: expected ${expectedNewCount}, saw ${newSeen}`
      };
    }
  }

  info("[VALIDATOR] PASS: Diff structure looks valid");
  return { ok: true };
}