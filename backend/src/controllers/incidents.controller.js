// backend/src/controllers/incidents.controller.js
import express from "express";
import logger from "../utils/logger.js";
import { Incident } from "../models/incident.js";
import { AIPatch } from "../models/aiPatch.js";
import { createBranchForPatch, commitFiles, createMergeRequest } from "../services/gitlab.service.js";
import { MergeRequest } from "../models/mergeRequest.js";

export const router = express.Router();

router.post("/:id/create-mr", async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id).populate("project");
    if (!incident) return res.status(404).json({ error: "NOT_FOUND" });

    const aiPatch = await AIPatch.findById(incident.aiPatch);
    if (!aiPatch || !aiPatch.diff) return res.status(400).json({ error: "NO_PATCH" });

    if (incident.mrStatus === "open") return res.status(409).json({ error: "MR_ALREADY_OPEN" });

    const branchName = `incident-fix-${incident._id}`;
    await createBranchForPatch(incident.project, branchName, incident.gitRef || "main").catch(() => {});

    // For demo safety: store patch as file rather than apply raw diff
    const actions = [{ action: "create", file_path: `ai_patches/incident_${incident._id}.md`, content: `AI Patch\n\n${aiPatch.diff}` }];

    await commitFiles(incident.project, branchName, `AI patch for incident ${incident._id}`, actions);

    const mr = await createMergeRequest(incident.project, branchName, incident.gitRef || "main", `AI Patch for Incident ${incident._id}`, `Auto-generated patch.`);

    await MergeRequest.create({ incident: incident._id, project: incident.project._id, mrId: mr.iid || mr.id, mrUrl: mr.web_url, sourceBranch: branchName, targetBranch: incident.gitRef || "main" });

    incident.mrStatus = "open";
    await incident.save();

    logger.success("[INCIDENT] MR created", mr.web_url);
    return res.json({ success: true, mr });
  } catch (err) {
    logger.error("[INCIDENT] create-mr error:", err.stack || err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;