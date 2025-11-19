import { Incident } from "../models/Incident.js";
import { AIAnalysis } from "../models/AIAnalysis.js";
import { AIPatch } from "../models/AIPatch.js";
import { callRCA, callGeneratePatch } from "../services/ai.service.js";
import { createMRForIncident } from "../services/automation.service.js";

export async function listIncidents(req, res, next) {
  try {
    const { projectId, status, category } = req.query;

    const filter = {};
    if (projectId) filter.project = projectId;
    if (status) filter.status = status;
    if (category) filter.category = category;

    const items = await Incident.find(filter)
      .populate("project", "name gitlabUrl")
      .populate("aiAnalysis", "summary rootCause category confidence")
      .populate("mergeRequest", "mrIid url branchName status")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        items,
        page: 1,
        pageSize: items.length,
        total: items.length
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

export async function getIncident(req, res, next) {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate("project", "name gitlabUrl")
      .populate("aiAnalysis")
      .populate("aiPatch")
      .populate("mergeRequest");

    if (!incident) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" }
      });
    }

    res.json({
      success: true,
      data: { incident },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

export async function updateIncident(req, res, next) {
  try {
    const updates = req.body;

    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { ...updates },
      { new: true }
    );

    if (!incident) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" }
      });
    }

    res.json({
      success: true,
      data: { incident },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

// Stubbed AI + MR endpoints (we'll wire to AI + GitLab later)

export async function triggerAnalysis(req, res, next) {
  try {
    console.log('🔍 triggerAnalysis called for incident:', req.params.id);
    
    const incident = await Incident.findById(req.params.id).populate(
      "project",
      "name gitlabProjectId gitlabUrl"
    );

    if (!incident) {
      console.log('❌ Incident not found:', req.params.id);
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" }
      });
    }

    console.log('📞 Calling AI RCA service...');
    const rca = await callRCA({
      incidentId: incident._id.toString(),
      logs: incident.fullLogs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      metadata: {
        projectName: incident.project?.name,
        pipelineId: incident.pipelineId,
        jobName: incident.jobName,
        gitRef: incident.gitRef
      }
    });

    console.log('✅ AI RCA completed:', rca);
    const analysis = await AIAnalysis.create({
      incident: incident._id,
      summary: rca.summary,
      rootCause: rca.rootCause,
      category: rca.category,
      confidence: rca.confidence
    });

    incident.aiAnalysis = analysis._id;
    incident.analysisStatus = "done"; // Mark analysis as complete
    if (!incident.category && rca.category) {
      incident.category = rca.category;
    }
    await incident.save();

    console.log('✅ Analysis saved to DB');
    res.json({
      success: true,
      data: { aiAnalysis: analysis },
      error: null
    });
  } catch (err) {
    console.error('❌ Error in triggerAnalysis:', err);
    next(err);
  }
}

export async function triggerPatch(req, res, next) {
  try {
    console.log('🔧 triggerPatch called for incident:', req.params.id);
    
    const incident = await Incident.findById(req.params.id).populate(
      "project",
      "name gitlabProjectId gitlabUrl"
    );

    if (!incident) {
      console.log('❌ Incident not found:', req.params.id);
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" }
      });
    }

    console.log('📞 Calling AI Patch service...');
    // TODO: later fetch related repo files via GitLab; for now, empty
    const files = [];

    const patchRes = await callGeneratePatch({
      incidentId: incident._id.toString(),
      logs: incident.fullLogs || "",
      gitlabCiConfig: incident.gitlabCiConfig || "",
      files,
      metadata: {
        projectName: incident.project?.name,
        pipelineId: incident.pipelineId,
        jobName: incident.jobName,
        gitRef: incident.gitRef
      }
    });

    console.log('✅ AI Patch generated');
    const patch = await AIPatch.create({
      incident: incident._id,
      diff: patchRes.diff,
      description: patchRes.description,
      riskLevel: patchRes.riskLevel || "medium"
    });

    incident.aiPatch = patch._id;
    incident.patchStatus = "ready"; // Mark patch as ready
    await incident.save();

    console.log('✅ Patch saved to DB, status set to ready');
    res.json({
      success: true,
      data: { aiPatch: patch },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

export async function createMergeRequest(req, res, next) {
  try {
    const incidentId = req.params.incidentId || req.params.id;

    const mr = await createMRForIncident(incidentId);

    return res.json({ success: true, data: { mr }, error: null });
  } catch (err) {
    next(err);
  }
}

export async function rerunPipeline(req, res, next) {
  try {
    console.log('🔄 rerunPipeline called for incident:', req.params.id);
    
    const incident = await Incident.findById(req.params.id).populate('project');
    
    if (!incident) {
      console.log('❌ Incident not found:', req.params.id);
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "INCIDENT_NOT_FOUND", message: "Incident not found" }
      });
    }

    if (!incident.pipelineId) {
      console.log('❌ No pipeline ID found for incident');
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: "NO_PIPELINE", message: "No pipeline associated with this incident" }
      });
    }

    if (!incident.project) {
      console.log('❌ No project associated with incident');
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: "NO_PROJECT", message: "No project associated with this incident" }
      });
    }

    console.log('📞 Calling GitLab API to retry pipeline:', incident.pipelineId);
    const { retryPipeline } = await import("../services/gitlab.service.js");
    const pipelineData = await retryPipeline(incident.project, incident.pipelineId);

    console.log('✅ Pipeline retry triggered:', pipelineData.id);
    res.json({
      success: true,
      data: {
        pipelineId: pipelineData.id,
        pipelineUrl: pipelineData.web_url,
        status: pipelineData.status
      },
      error: null
    });
  } catch (err) {
    console.error('❌ Error in rerunPipeline:', err);
    next(err);
  }
}
