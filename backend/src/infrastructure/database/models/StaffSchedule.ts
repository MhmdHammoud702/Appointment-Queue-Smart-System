import mongoose from "mongoose";

interface IntervalRecord {
  day: number;
  from: string;
  to: string;
}

export interface StaffScheduleRecord {
  staff: mongoose.Types.ObjectId;
  weeklyIntervals: IntervalRecord[];
  daysOff: number[];
  services: mongoose.Types.ObjectId[];
}

const intervalSchema = new mongoose.Schema<IntervalRecord>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    from: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    to: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }
  },
  { _id: false }
);

const staffScheduleSchema = new mongoose.Schema<StaffScheduleRecord>(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    weeklyIntervals: { type: [intervalSchema], default: [] },
    daysOff: { type: [{ type: Number, min: 0, max: 6 }], default: [] },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }]
  },
  { timestamps: true }
);

export const StaffSchedule = mongoose.model("StaffSchedule", staffScheduleSchema);
