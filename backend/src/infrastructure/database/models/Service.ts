import mongoose from "mongoose";

export interface ServiceRecord {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

const serviceSchema = new mongoose.Schema<ServiceRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    durationMinutes: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

serviceSchema.index({ name: 1 }, { unique: true });
export const Service = mongoose.model("Service", serviceSchema);
