import mongoose from "mongoose";

interface QueueCounterRecord {
  _id: string;
  value: number;
}

const queueCounterSchema = new mongoose.Schema<QueueCounterRecord>({
  _id: { type: String },
  value: { type: Number, default: 0 }
});

export const QueueCounter = mongoose.model("QueueCounter", queueCounterSchema);
