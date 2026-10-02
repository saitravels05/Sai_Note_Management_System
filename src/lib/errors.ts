export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message = "Validation failed", fieldErrors?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to access this resource") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message = "Database connection unavailable") {
    super(message, 503, "DATABASE_UNAVAILABLE");
  }
}

export class FileProcessingError extends AppError {
  constructor(message = "Failed to process the uploaded file") {
    super(message, 422, "FILE_PROCESSING_ERROR");
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = "Business rule violation") {
    super(message, 422, "BUSINESS_RULE_VIOLATION");
  }
}

/**
 * Format any error safely for the client without leaking secrets or internals
 */
export function formatClientSafeError(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Generic fallback for unhandled exceptions
  return {
    message: "An unexpected error occurred. Please try again or contact system support.",
    code: "UNEXPECTED_ERROR",
    statusCode: 500,
  };
}
