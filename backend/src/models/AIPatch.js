import mongoose from "mongoose";

const aiPatchSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true
    },

    diff: String,
    description: String,
    risk: String,

    usedModel: String,
    safeMode: Boolean,

    previousAttempt: Boolean
  },
  { timestamps: true }
);

export const AIPatch =
  mongoose.models.AIPatch || mongoose.model("AIPatch", aiPatchSchema);
