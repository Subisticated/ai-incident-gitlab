// backend/src/services/automation.service.js
import logger, { log } from "../utils/logger.js";
import { Incident } from "../models/Incident.js";
import { AIAnalysis } from "../models/AIAnalysis.js";
import { AIPatch } from "../models/AIPatch.js";
import { getRepoSnapshot } from "./repoContext.service.js";
import { runRCA, runPatchGeneration } from "./ai.service.js";
import { validateUnifiedDiff } from "./patchValidator.js";

export async function runAutomationForIncident(incidentId) {
  logger.info(`[AUTO] runAutomationForIncident(${incidentId})`);
  const incident = await Incident.findById(incidentId).populate("project");
  if (!incident) {
    logger.error(`[AUTO] Incident not found: ${incidentId}`);
    return;
  }

  if (["running"].includes(incident.analysisStatus) || ["running"].includes(incident.patchStatus)) {
    logger.warn(`[AUTO] Already processing: ${incidentId}`);
    return;
  }

  try {
    incident.analysisStatus = "running";
    incident.patchStatus = "pending";
    await incident.save();

    const logs = incident.fullLogs || "";
    const ciConfig = incident.gitlabCiConfig || "";

    const rca = await runRCA({ logs, gitlabCiConfig: ciConfig, metadata: { pipelineId: incident.pipelineId, gitRef: incident.gitRef } });

    const analysisDoc = await AIAnalysis.create({
      incident: incident._id,
      summary: rca.summary || "",
      rootCause: rca.rootCause || "",
      category: rca.category || "other",
      confidence: rca.confidence || 0
    });

    incident.aiAnalysis = analysisDoc._id;
    incident.analysisStatus = "done";
    await incident.save();
    logger.success("[AUTO] RCA saved");

    const repoSnapshot = await getRepoSnapshot(incident.project, incident.gitRef || "main");

    const filesToSend = [];
    if (rca?.failingFile) {
      const found = repoSnapshot.files.find(f => f.path === rca.failingFile);
      if (found) filesToSend.push(found);
    }
    if (filesToSend.length === 0) filesToSend.push(...repoSnapshot.files.slice(0, 12));

    logger.info("[AUTO] Generating patch...");
    let patchDoc = null;
    let patchResult = null;

    try {
      patchResult = await runPatchGeneration({
        incident,
        logs,
        gitlabCiConfig: ciConfig,
        files: repoSnapshot.files,
        targetFiles: repoSnapshot.targetFiles.join("\n"),
        metadata: { previousPatch: incident.aiPatch ? incident.aiPatch.diff : null, rca }
      });

      patchDoc = await AIPatch.create({
        incident: incident._id,
        diff: patchResult.diff || "",
        description: patchResult.raw ? "AI-generated" : "",
        risk: "medium",
        model: patchResult.usedModel || null,
        safeMode: patchResult.safeMode || false
      });

      incident.aiPatch = patchDoc._id;
      incident.patchStatus = "ready";
      await incident.save();
    } catch (err) {
      logger.error("[AUTO] Patch generation error:", err.message || err);
      patchDoc = patchDoc || new AIPatch({ incident: incident._id, diff: "", description: "Generation error", risk: "high" });
      incident.patchStatus = "failed";
      await incident.save();
    }

    if (!patchDoc || !patchDoc.diff || incident.patchStatus !== "ready") {
      logger.warn("[AUTO] Patch not ready or empty, skipping validation");
      if (patchDoc) { patchDoc.status = "failed"; patchDoc.validationError = "Patch missing"; await patchDoc.save(); }
      incident.patchStatus = "failed"; await incident.save(); return;
    }

    logger.info("[AUTO] Validating patch...");
    const validation = validateUnifiedDiff(patchDoc.diff, repoSnapshot.primaryFileContent);

    if (!validation.ok) {
      logger.warn("[AUTO] Patch validation failed:", validation.error);
      patchDoc.validationError = validation.error; patchDoc.status = "failed"; await patchDoc.save();
      incident.patchStatus = "failed"; incident.analysisStatus = "done"; await incident.save(); return;
    }

    patchDoc.status = "valid"; await patchDoc.save();
    incident.status = "in_progress"; await incident.save();
    logger.success("[AUTO] Patch validated and ready for MR");
  } catch (err) {
    logger.error("[AUTO] Automation internal error:", err.stack || err.message || err);
    incident.analysisStatus = incident.analysisStatus === "running" ? "failed" : incident.analysisStatus;
    incident.patchStatus = incident.patchStatus === "running" ? "failed" : incident.patchStatus;
    incident.retryCount = (incident.retryCount || 0) + 1;
    await incident.save();
  }
}
