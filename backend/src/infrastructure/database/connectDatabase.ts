import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Appointment } from "./models/Appointment.js";

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  await Appointment.createIndexes();
  console.log("Connected to MongoDB.");
}

