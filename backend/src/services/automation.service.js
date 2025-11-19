import { Incident } from "../models/Incident.js";
import { Project } from "../models/Project.js";
import { AIAnalysis } from "../models/AIAnalysis.js";
import { AIPatch } from "../models/AIPatch.js";
import { MergeRequest } from "../models/MergeRequest.js";

import { callRCA, callGeneratePatch } from "./ai.service.js";
import {
  createBranch,
  getFile,
  commitFile,
  createMR
} from "./gitlab.service.js";

import { cleanDiff, extractFilePath, isNewFile } from "../utils/diffParser.js";
import {
  applyPatchNewFile,
  applyPatchExistingFile
} from "../utils/patchEngine.js";

// -------------- 1. Full automation for a NEW incident --------------

export async function runAutomationForIncident(incidentId) {
  const incident = await Incident.findById(incidentId).populate("project");

  if (!incident || !incident.project) return;

  // Avoid double-running
  if (incident.analysisStatus !== "pending") return;

  try {
    incident.status = "in_progress";
    incident.analysisStatus = "running";
    await incident.save();

    // 1) Run AI Analysis
    const rca = await callRCA({
      incidentId: incident._id.toString(),
      logs: incident.fullLogs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      metadata: {
        projectName: incident.project.name,
        pipelineId: incident.pipelineId,
        jobName: incident.jobName,
        gitRef: incident.gitRef
      }
    });

    const analysis = await AIAnalysis.create({
      incident: incident._id,
      summary: rca.summary,
      rootCause: rca.rootCause,
      category: rca.category,
      confidence: rca.confidence
    });

    incident.aiAnalysis = analysis._id;
    incident.analysisStatus = "done";
    if (!incident.category && rca.category) {
      incident.category = rca.category;
    }
    await incident.save();

    // 2) Run AI Patch generation
    incident.patchStatus = "running";
    await incident.save();

    const patchRes = await callGeneratePatch({
      incidentId: incident._id.toString(),
      logs: incident.fullLogs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      files: [],
      metadata: {
        projectName: incident.project.name,
        pipelineId: incident.pipelineId,
        jobName: incident.jobName,
        gitRef: incident.gitRef
      }
    });

    const patch = await AIPatch.create({
      incident: incident._id,
      diff: patchRes.diff,
      description: patchRes.description,
      riskLevel: patchRes.risk || "medium"
    });

    incident.aiPatch = patch._id;
    incident.patchStatus = "ready";
    await incident.save();
  } catch (err) {
    console.error("🔥 Automation failed for incident", incidentId, err.message);
    await Incident.findByIdAndUpdate(incidentId, {
      analysisStatus: "failed",
      patchStatus: "failed"
    });
  }
}

// -------------- 2. User triggers MR creation (one-click) --------------

export async function createMRForIncident(incidentId) {
  const incident = await Incident.findById(incidentId)
    .populate("project")
    .populate("aiPatch")
    .populate("aiAnalysis");

  if (!incident || !incident.project) {
    throw new Error("Incident or project not found");
  }

  if (!incident.aiPatch || !incident.aiPatch.diff) {
    throw new Error("AI patch not ready yet");
  }

  const project = incident.project;
  const baseBranch = project.defaultBranch || "main";
  const branch = `incident-fix-${incident._id}`;

  // 1) Ensure branch exists or create
  await createBranch(project, branch, baseBranch).catch((err) => {
    if (err.response?.data?.message === "Branch already exists") {
      console.log("⚠️ Reusing existing branch", branch);
    } else {
      throw err;
    }
  });

  const rawDiff = incident.aiPatch.diff;
  const diff = cleanDiff(rawDiff);

  const filePath = extractFilePath(diff);
  if (!filePath) {
    throw new Error("Could not detect file path from diff");
  }

  const newFile = isNewFile(diff);
  let updatedContent;

  if (newFile) {
    console.log("🆕 Creating new file from diff:", filePath);
    updatedContent = applyPatchNewFile(diff);

    if (!updatedContent || !updatedContent.trim()) {
      throw new Error("Invalid new-file patch content");
    }

    await commitFile(
      project,
      branch,
      filePath,
      updatedContent,
      `AI created ${filePath} for incident ${incident._id}`,
      true
    );
  } else {
    console.log("✏️ Updating existing file:", filePath);

    const original = await getFile(project, filePath, baseBranch);
    updatedContent = applyPatchExistingFile(original, diff);

    if (!updatedContent || !updatedContent.trim()) {
      throw new Error("Could not apply patch to existing file");
    }

    await commitFile(
      project,
      branch,
      filePath,
      updatedContent,
      `AI patch for ${filePath} (incident ${incident._id})`,
      false
    );
  }

  // 2) Create MR
  const title = `AI Fix for Incident ${incident._id}`;
  const description = `
AI-generated fix for pipeline failure.

Incident: ${incident._id}
File: ${filePath}

AI Summary: ${incident.aiAnalysis?.summary || "N/A"}
Root Cause: ${incident.aiAnalysis?.rootCause || "N/A"}
`;

  const mrData = await createMR(project, branch, title, description);

  const mr = await MergeRequest.create({
    incident: incident._id,
    mrId: mrData.id,
    mrIid: mrData.iid,
    url: mrData.web_url,
    branchName: branch,
    status: mrData.state || "opened",
    lastCheckedAt: new Date()
  });

  incident.mergeRequest = mr._id;
  incident.mrStatus = "open";
  await incident.save();

  return mr;
}

// -------------- 3. Handle MR pipeline result (webhook) --------------

export async function handlePostMRPipeline(pipelinePayload, logs) {
  const ref = pipelinePayload.ref; // branch name
  const status = pipelinePayload.status; // "success" | "failed" | etc.

  // We only care about branches like "incident-fix-<id>"
  if (!ref || !ref.startsWith("incident-fix-")) return;

  // Try to find MR by branch
  const mr = await MergeRequest.findOne({ branchName: ref }).populate("incident");
  if (!mr || !mr.incident) return;

  const incident = mr.incident;

  if (status === "success") {
    console.log("✅ MR pipeline succeeded for", ref);

    incident.status = "resolved";
    incident.mrStatus = "resolved";
    await incident.save();

    // Clean up related incidents
    if (incident.category && incident.errorSnippet) {
      await Incident.deleteMany({
        _id: { $ne: incident._id },
        category: incident.category,
        errorSnippet: incident.errorSnippet
      });
    }

    return;
  }

  if (status !== "failed") return;

  console.log("❌ MR pipeline failed for", ref, "→ retrying AI fix");

  // Retry limit for safety
  if (incident.retryCount >= 3) {
    incident.mrStatus = "failed";
    await incident.save();
    return;
  }

  incident.retryCount += 1;
  incident.mrStatus = "fixing";
  await incident.save();

  // Run a new RCA + patch using latest logs
  try {
    const rca = await callRCA({
      incidentId: incident._id.toString(),
      logs: logs || incident.fullLogs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      metadata: {
        projectName: "MR retry",
        pipelineId: pipelinePayload.id,
        jobName: "mr-pipeline",
        gitRef: ref
      }
    });

    const analysis = await AIAnalysis.create({
      incident: incident._id,
      summary: rca.summary,
      rootCause: rca.rootCause,
      category: rca.category,
      confidence: rca.confidence
    });

    incident.aiAnalysis = analysis._id;
    await incident.save();

    const patchRes = await callGeneratePatch({
      incidentId: incident._id.toString(),
      logs: logs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      files: [],
      metadata: {
        projectName: "MR retry",
        pipelineId: pipelinePayload.id,
        jobName: "mr-pipeline",
        gitRef: ref
      }
    });

    const patch = await AIPatch.create({
      incident: incident._id,
      diff: patchRes.diff,
      description: patchRes.description,
      riskLevel: patchRes.risk || "medium"
    });

    incident.aiPatch = patch._id;
    await incident.save();

    // Apply new patch on same branch
    const project = await Project.findById(incident.project);
    if (!project) {
      throw new Error("Project not found for incident retry");
    }

    const rawDiff = patch.diff;
    const diff = cleanDiff(rawDiff);
    const filePath = extractFilePath(diff);
    if (!filePath) throw new Error("Could not detect file path from retry diff");

    const newFile = isNewFile(diff);
    let updatedContent;

    if (newFile) {
      updatedContent = applyPatchNewFile(diff);
      await commitFile(
        project,
        mr.branchName,
        filePath,
        updatedContent,
        `AI retry patch created ${filePath}`,
        true
      );
    } else {
      const original = await getFile(project, filePath, ref);
      updatedContent = applyPatchExistingFile(original, diff);
      if (!updatedContent) throw new Error("Could not apply retry patch");

      await commitFile(
        project,
        mr.branchName,
        filePath,
        updatedContent,
        `AI retry patch for ${filePath}`,
        false
      );
    }

    // Pushing commit triggers new pipeline → webhook will handle again
  } catch (err) {
    console.error("🔥 Retry automation failed:", err.message);
    incident.mrStatus = "failed";
    await incident.save();
  }
}
