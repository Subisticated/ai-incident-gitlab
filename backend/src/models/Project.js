import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gitlabProjectId: { type: Number },
    gitlabUrl: { type: String, required: true },
    gitlabNamespace: { type: String, default: "" },
    isActive: { type: Boolean, default: true },

    // For hackathon simplicity; keep plain string
    gitlabAccessToken: { type: String, required: true }
  },
  { timestamps: true }
);

export const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
