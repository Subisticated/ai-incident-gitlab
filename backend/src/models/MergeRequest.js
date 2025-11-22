import mongoose from "mongoose";

const mergeRequestSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    mrId: Number,
    mrUrl: String,
    sourceBranch: String,
    targetBranch: String,

    status: {
      type: String,
      enum: ["open", "merged", "closed", "failed"],
      default: "open"
    }
  },
  { timestamps: true }
);

export const MergeRequest =
  mongoose.models.MergeRequest || mongoose.model("MergeRequest", mergeRequestSchema);
