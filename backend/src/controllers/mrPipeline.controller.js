// backend/src/controllers/mrPipeline.controller.js
import express from "express";
import { handleMrPipelineEvent } from "../services/automation.service.js";
import { log, warn, error, success } from "../utils/logger.js";
export const router = express.Router();

router.post("/gitlab/pipelines", express.json({ limit: "10mb" }), async (req, res, next) => {
  try {
    const event = req.header("X-Gitlab-Event");
    if (event !== "Pipeline Hook") return res.json({ success: true, ignored: true });
    const pipeline = req.body.object_attributes;
    if (!pipeline) return res.json({ success: true, ignored: true });
    if (!pipeline.ref || !pipeline.ref.startsWith("incident-fix-")) return res.json({ success: true, ignored: true });

    log.event("MR pipeline webhook for", pipeline.ref, "status", pipeline.status);
    await handleMrPipelineEvent({ ref: pipeline.ref, id: pipeline.id, status: pipeline.status });
    return res.json({ success: true });
  } catch (err) {
    log.error("mrPipeline.controller error:", err.message);
    next(err);
  }
});
