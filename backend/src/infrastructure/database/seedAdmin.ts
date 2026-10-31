import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "./connectDatabase.js";
import { User } from "./models/User.js";
import { logger, serializeError } from "../logging/logger.js";

async function seedAdmin() {
  const fullName = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !email || !phone || !password) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, and ADMIN_PASSWORD in .env.");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long.");
  }

  try {
    await connectDatabase();

    const existingUser = await User.findOne({ email }).select("_id");
    if (existingUser) {
      throw new Error(`An account with ${email} already exists; no account was changed.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ fullName, email, phone, passwordHash, role: "Admin" });
    logger.info("Administrator account created.", { email });
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error: unknown) => {
  logger.error("Admin seed failed.", { error: serializeError(error) });
  process.exitCode = 1;
});
