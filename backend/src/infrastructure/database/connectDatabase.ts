import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Appointment } from "./models/Appointment.js";
import { logger } from "../logging/logger.js";

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  await Appointment.createIndexes();
  logger.info("Connected to MongoDB.");
}
