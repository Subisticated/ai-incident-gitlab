import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },
    pipelineId: { type: Number },
    pipelineUrl: { type: String },
    jobId: { type: Number },
    jobName: { type: String },
    gitRef: { type: String },
    commitSha: { type: String },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open"
    },

    analysisStatus: {
      type: String,
      enum: ["pending", "running", "done", "failed"],
      default: "pending"
    },

    patchStatus: {
      type: String,
      enum: ["pending", "running", "ready", "failed"],
      default: "pending"
    },

    mrStatus: {
      type: String,
      enum: ["not_requested", "open", "fixing", "resolved", "failed"],
      default: "not_requested"
    },

    category: {
      type: String,
      enum: ["config", "dependency", "test", "infra", "timeout", "other", null],
      default: null
    },

    errorSnippet: { type: String },
    logsStored: { type: Boolean, default: false },
    fullLogs: { type: String },
    gitlabCiConfig: { type: String },

    aiAnalysis: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIAnalysis"
    },
    aiPatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIPatch"
    },
    mergeRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MergeRequest"
    },

    retryCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Incident = mongoose.model("Incident", incidentSchema);
