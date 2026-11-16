import { ErrorCode } from '@codeyoung/shared';

/**
 * Typed application error with HTTP status and error code (DESIGN.md §8).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
