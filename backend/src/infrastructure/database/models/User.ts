import mongoose from "mongoose";

export interface UserRecord {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "Customer" | "Staff" | "Receptionist" | "Admin";
}

const userSchema = new mongoose.Schema<UserRecord>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["Customer", "Staff", "Receptionist", "Admin"], default: "Customer" }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
