import mongoose from "mongoose";

const aiAnalysisSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true
    },

    summary: String,
    rootCause: String,
    category: String,
    confidence: Number,

    usedModel: String,
    safeMode: Boolean
  },
  { timestamps: true }
);

export const AIAnalysis =
  mongoose.models.AIAnalysis || mongoose.model("AIAnalysis", aiAnalysisSchema);
