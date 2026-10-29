import mongoose from "mongoose";

export interface QueueEntryRecord {
  appointment: mongoose.Types.ObjectId;
  queueDate: string;
  queueNumber: number;
  status: "Waiting" | "Called" | "In Service" | "Completed" | "Cancelled";
  checkedInAt: Date;
  calledAt?: Date;
  completedAt?: Date;
}

const queueEntrySchema = new mongoose.Schema<QueueEntryRecord>(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true
    },
    queueDate: { type: String, required: true },
    queueNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["Waiting", "Called", "In Service", "Completed", "Cancelled"],
      default: "Waiting"
    },
    checkedInAt: { type: Date, required: true },
    calledAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

queueEntrySchema.index({ queueDate: 1, queueNumber: 1 }, { unique: true });
queueEntrySchema.index({ status: 1, checkedInAt: 1 });

export const QueueEntry = mongoose.model("QueueEntry", queueEntrySchema);
