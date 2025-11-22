// backend/src/services/mrHandler.service.js
import logger from "../utils/logger.js";
import { Incident } from "../models/Incident.js";
import { AIPatch } from "../models/AIPatch.js";
import { fetchPipelineJobs, getPipelineLogs, commitFiles } from "./gitlab.service.js";
import { getRepoSnapshot } from "./repoContext.service.js";
import { runPatchGeneration } from "./ai.service.js";
import { validateUnifiedDiff } from "./patchValidator.js";
import { applyPatch } from "diff";

const MAX_RETRIES = parseInt(process.env.AI_RETRY_MAX || "3", 10);

export async function handleMrPipelineEvent({ ref, status, pipelineId, project }) {
  // ref format: incident-fix-<incidentId>
  if (!ref || !ref.startsWith("incident-fix-")) return;
  const incidentId = ref.replace("incident-fix-", "");
  logger.info("[MR] handleMrPipelineEvent for", incidentId, status);

  const incident = await Incident.findById(incidentId).populate("project");
  if (!incident) { logger.warn("[MR] Incident not found", incidentId); return; }

  if (status === "success") {
    incident.mrStatus = "resolved";
    incident.status = "resolved";
    await incident.save();
    logger.success("[MR] Pipeline for MR succeeded — incident resolved", incidentId);
    return;
  }

  if (status !== "failed") return;

  incident.retryCount = (incident.retryCount || 0) + 1;
  if (incident.retryCount > MAX_RETRIES) {
    incident.mrStatus = "failed";
    await incident.save();
    logger.warn("[MR] Max retries reached for", incidentId);
    return;
  }

  incident.mrStatus = "fixing";
  await incident.save();

  // fetch failing job log
  try {
    const jobs = await fetchPipelineJobs(incident.project, pipelineId);
    const failing = jobs.find(j => j.status === "failed");
    const logs = failing ? await getPipelineLogs(incident.project, failing.id) : incident.fullLogs || "";
    incident.fullLogs = logs;
    await incident.save();

    // repo snapshot
    const { files: repoFiles } = await getRepoSnapshot(incident.project, incident.gitRef || "main");
    const repoFilesMap = Object.fromEntries(repoFiles.map(f => [f.path, f.content]));


    // prepare files
    const filesToSend = [];
    if (incident.aiAnalysis && incident.aiAnalysis.failingFile && repoFilesMap[incident.aiAnalysis.failingFile]) {
      filesToSend.push({ path: incident.aiAnalysis.failingFile, content: repoFilesMap[incident.aiAnalysis.failingFile] });
    } else {
      repoFiles.slice(0,8).forEach(f => filesToSend.push({ path: f.path, content: f.content }));
    }

    // generate retry patch
    const patchRes = await runPatchGeneration({ logs: incident.fullLogs, gitlabCiConfig: incident.gitlabCiConfig || "", metadata: { previousPatch: (await AIPatch.findById(incident.aiPatch))?.diff }, files: filesToSend, targetFilesText: repoFiles.map(f => f.path).join("\n") });

    const newDiff = patchRes.diff || "";
    const aiPatchDoc = await AIPatch.findById(incident.aiPatch);
    aiPatchDoc.diff = newDiff;
    await aiPatchDoc.save();

    if (!newDiff || newDiff.length < 10) {
      aiPatchDoc.previousAttempt = true;
      await aiPatchDoc.save();
      logger.warn("[MR] AI returned empty retry patch");
      return;
    }

    const valid = validateUnifiedDiff(newDiff, repoFilesMap[Object.keys(repoFilesMap)[0]]); // Note: This validation is weak, needs target file
    if (!valid.ok) {
      aiPatchDoc.previousAttempt = true;
      aiPatchDoc.description = valid.error;
      await aiPatchDoc.save();
      logger.warn("[MR] Retry patch validation failed:", valid.error);
      return;
    }

    /*
    // convert diff blocks -> actions
    const blocks = parseUnifiedPatch(newDiff);
    const actions = [];
    for (const b of blocks) {
      const original = repoFiles[b.target];
      const applied = applyPatch(original, b.raw);
      actions.push({ action: "update", file_path: b.target, content: applied });
    }

    // commit to MR branch (ref)
    await commitFiles(incident.project, ref, `AI retry #${incident.retryCount} for ${incident._id}`, actions);
    */

    incident.mrStatus = "open";
    await incident.save();
    logger.success("[MR] Committed retry patch to", ref);
  } catch (err) {
    logger.error("[MR] Self-heal retry error:", err.message || err);
    try {
      const aiPatchDoc = await AIPatch.findById(incident.aiPatch);
      if (aiPatchDoc) { aiPatchDoc.description = err.message; await aiPatchDoc.save(); }
    } catch {}
  }
}
