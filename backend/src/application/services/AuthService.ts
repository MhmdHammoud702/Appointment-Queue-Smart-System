import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../infrastructure/config/env.js";
import { User } from "../../infrastructure/database/models/User.js";
import { DomainError } from "../../domain/DomainError.js";
import type { LoginInput, RegisterUserInput } from "../../types/domain.js";
import type { UserRecord } from "../../infrastructure/database/models/User.js";
import type { SignOptions } from "jsonwebtoken";

const publicUser = (user: Pick<UserRecord, "fullName" | "email" | "phone" | "role"> & { _id: unknown }) => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role
});

function createToken(user: Pick<UserRecord, "role" | "fullName"> & { _id: unknown }) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, fullName: user.fullName },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
  );
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export class AuthService {
  async registerCustomer(input: RegisterUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await User.create({
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
        role: "Customer"
      });
      return { user: publicUser(user), token: createToken(user) };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainError("An account with this email already exists.", 409, "EMAIL_IN_USE");
      }
      throw error;
    }
  }

  async login({ email, password }: LoginInput) {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new DomainError("Email or password is incorrect.", 401, "INVALID_CREDENTIALS");
    }
    return { user: publicUser(user), token: createToken(user) };
  }

  async getCurrentUser(userId: string) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new DomainError("User account is unavailable.", 401, "ACCOUNT_DEACTIVATED");
    return publicUser(user);
  }

  private async createEmployee(input: RegisterUserInput, role: "Staff" | "Receptionist") {
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const user = await User.create({ ...input, email: input.email.toLowerCase(), passwordHash, role });
      return publicUser(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainError("An account with this email already exists.", 409, "EMAIL_IN_USE");
      }
      throw error;
    }
  }

  createStaff(input: RegisterUserInput) {
    return this.createEmployee(input, "Staff");
  }

  createReceptionist(input: RegisterUserInput) {
    return this.createEmployee(input, "Receptionist");
  }
}
