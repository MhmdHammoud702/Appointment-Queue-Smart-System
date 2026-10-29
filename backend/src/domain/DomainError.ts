export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "BUSINESS_RULE_VIOLATION") {
    super(message);
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
