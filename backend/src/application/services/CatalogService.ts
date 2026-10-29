import { DomainError } from "../../domain/DomainError.js";
import { Service } from "../../infrastructure/database/models/Service.js";
import type { ServiceInput } from "../../types/domain.js";

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export class CatalogService {
  listServices(includeInactive = false) {
    return Service.find(includeInactive ? {} : { active: true }).sort({ name: 1 });
  }

  async createService(input: ServiceInput) {
    try {
      return await Service.create(input);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainError("A service with this name already exists.", 409, "SERVICE_NAME_IN_USE");
      }
      throw error;
    }
  }

  async updateService(serviceId: string, input: Partial<ServiceInput>) {
    const service = await Service.findByIdAndUpdate(serviceId, { $set: input }, { new: true, runValidators: true });
    if (!service) throw new DomainError("Service not found.", 404, "SERVICE_NOT_FOUND");
    return service;
  }

  async setServiceStatus(serviceId: string, active: boolean) {
    return this.updateService(serviceId, { active });
  }
}
