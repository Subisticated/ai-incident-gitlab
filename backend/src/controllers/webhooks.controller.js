// backend/src/controllers/webhooks.controller.js
import express from "express";
import logger from "../utils/logger.js";
import { Project } from "../models/Project.js";
import { Incident } from "../models/Incident.js";
import { runAutomationForIncident } from "../services/automation.service.js";

export const router = express.Router();

function extractFailedJob(body) {
  return body.builds?.find(b => b.status === "failed") || body.jobs?.find(j => j.status === "failed") || null;
}

async function handleGitlabWebhook(req, res) {
  try {
    const event = req.headers["x-gitlab-event"];
    logger.info(`[WEBHOOK] Event: ${event}`);
    if (event !== "Pipeline Hook") return res.json({ success: true, ignored: true });

    const body = req.body;
    const pipeline = body.object_attributes || {};
    logger.info("[WEBHOOK] Pipeline status:", pipeline.status);

    if (pipeline.status !== "failed") return res.json({ success: true, ignored: true });

    const projectInfo = body.project || {};
    const failedJob = extractFailedJob(body);
    if (!failedJob) { logger.warn("[WEBHOOK] No failed job found"); return res.status(400).json({ error: "NO_FAILED_JOB" }); }

    // DEMO MODE: Force fixed projectId because GitLab webhooks send inconsistent IDs
    const FORCED_PROJECT_ID = 76116069;

    const project = await Project.findOne({ gitlabProjectId: FORCED_PROJECT_ID });

    logger.info("[WEBHOOK] (Demo) Forced project lookup ->", FORCED_PROJECT_ID);
    if (!project) { logger.error("[WEBHOOK] Unknown project id", projectInfo.id); return res.status(404).json({ error: "PROJECT_NOT_FOUND" }); }

    const incident = await Incident.create({
      project: project._id,
      pipelineId: pipeline.id,
      pipelineUrl: pipeline.url,
      jobId: failedJob.id,
      jobName: failedJob.name,
      gitRef: pipeline.ref,
      commitSha: body.commit?.id,
      status: "open",
      analysisStatus: "pending",
      patchStatus: "pending",
      mrStatus: "not_requested",
      errorSnippet: failedJob.failure_reason || "",
      logsStored: false
    });

    logger.success(`[WEBHOOK] Incident created: ${incident._id}`);
    runAutomationForIncident(incident._id).catch(e => logger.error("[AUTO] async error", e.message || e));
    return res.json({ success: true, incidentId: incident._id });
  } catch (err) {
    logger.error("[WEBHOOK] Handler error:", err.stack || err.message);
    return res.status(500).json({ error: err.message });
  }
}

router.post("/gitlab", handleGitlabWebhook);
export default router;
