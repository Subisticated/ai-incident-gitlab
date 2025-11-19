import { Project } from "../models/Project.js";
import { Incident } from "../models/Incident.js";
import { runAutomationForIncident, handlePostMRPipeline } from "../services/automation.service.js";
import {
  fetchPipelineJobs,
  fetchJobLog,
  fetchGitlabCiConfig
} from "../services/gitlab.service.js";

function extractErrorSnippet(logs = "") {
  const lines = logs.split("\n").filter(Boolean);
  return lines.slice(-5).join("\n").slice(0, 1000);
}

export async function handleGitlabWebhook(req, res, next) {
  try {
    const event = req.header("X-Gitlab-Event");
    if (event !== "Pipeline Hook") {
      return res.json({
        success: true,
        data: { ignored: true, reason: "Not a Pipeline Hook event" },
        error: null
      });
    }

    const payload = req.body;
    const pipeline = payload.object_attributes;
    const projectInfo = payload.project;

    if (!pipeline || !projectInfo) {
      return res.json({
        success: true,
        data: { ignored: true, reason: "Missing pipeline or project info" },
        error: null
      });
    }

    const gitlabProjectId = projectInfo.id;
    const gitlabProjectWebUrl = projectInfo.web_url;

    let project = null;

    if (gitlabProjectId) {
      project = await Project.findOne({ gitlabProjectId });
    }
    if (!project && gitlabProjectWebUrl) {
      project = await Project.findOne({ gitlabUrl: gitlabProjectWebUrl });
    }

    if (!project) {
      return res.json({
        success: true,
        data: { ignored: true, reason: "Project not registered" },
        error: null
      });
    }

    const pipelineId = pipeline.id;
    const ref = pipeline.ref;

    // Route MR pipelines to retry handler
    if (ref && ref.startsWith("incident-fix-")) {
      let logs = null;
      if (pipeline.status === "failed") {
        try {
          const jobs = await fetchPipelineJobs(project, pipelineId);
          const failingJob = jobs.find((j) => j.status === "failed");
          if (failingJob) {
            logs = await fetchJobLog(project, failingJob.id);
          }
        } catch (err) {
          console.warn("Failed to fetch MR pipeline logs:", err.message);
        }
      }

      await handlePostMRPipeline(
        {
          ref,
          status: pipeline.status,
          id: pipelineId
        },
        logs
      );

      return res.json({
        success: true,
        data: { handled: "mr_pipeline" },
        error: null
      });
    }

    if (pipeline.status !== "failed") {
      return res.json({
        success: true,
        data: { ignored: true, reason: `status=${pipeline.status}` },
        error: null
      });
    }

    const commitSha = pipeline.sha;
    const pipelineUrl =
      pipeline.web_url || `${project.gitlabUrl}/-/pipelines/${pipelineId}`;

    let jobs = [];
    try {
      jobs = await fetchPipelineJobs(project, pipelineId);
    } catch (err) {
      console.warn("Failed to fetch jobs for pipeline:", err.message);
    }

    const failingJob =
      jobs.find((job) => job.status === "failed") || jobs[0] || null;

    let fullLogs = "";
    if (failingJob) {
      try {
        fullLogs = await fetchJobLog(project, failingJob.id);
      } catch (err) {
        console.warn("Failed to fetch job log:", err.message);
      }
    }

    let gitlabCiConfig = null;
    try {
      gitlabCiConfig = await fetchGitlabCiConfig(project, ref);
    } catch (err) {
      console.warn("Failed to fetch .gitlab-ci.yml:", err.message);
    }

    const incident = await Incident.create({
      project: project._id,
      pipelineId,
      pipelineUrl,
      jobId: failingJob?.id || null,
      jobName: failingJob?.name || null,
      gitRef: ref,
      commitSha,
      status: "open",
      analysisStatus: "pending",
      patchStatus: "pending",
      mrStatus: "not_requested",
      errorSnippet: extractErrorSnippet(fullLogs),
      logsStored: Boolean(fullLogs),
      fullLogs,
      gitlabCiConfig
    });

    runAutomationForIncident(incident._id).catch((err) =>
      console.error("Automation async error:", err.message)
    );

    return res.status(201).json({
      success: true,
      data: { incidentId: incident._id },
      error: null
    });
  } catch (err) {
    next(err);
  }
}
