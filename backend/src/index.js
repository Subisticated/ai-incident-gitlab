// backend/src/index.js
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import webhooksRouter from "./controllers/webhooks.controller.js";
import incidentsRouter from "./controllers/incidents.controller.js";
import logger from "./utils/logger.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGODB_URI || "mongodb://localhost:27017/incident_copilot";

async function boot() {
  try {
    await mongoose.connect(MONGO, { autoIndex: true });
    logger.success("MongoDB connected to", MONGO);
  } catch (err) {
    logger.error("MongoDB connect failed:", err.message || err);
    process.exit(1);
  }

  const app = express();
  app.use(bodyParser.json({ limit: "5mb" }));
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/incidents", incidentsRouter);

  app.get("/health", (req, res) => res.json({ success: true, data: { status: "ok", uptime: process.uptime() } }));

  app.listen(PORT, () => logger.success(`Server listening on ${PORT}`));
}

boot();
