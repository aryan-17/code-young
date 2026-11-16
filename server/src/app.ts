import Fastify from 'fastify';
import type { AppDependencies } from './lib/types.js';
import { AppError } from './lib/errors.js';

/**
 * Fastify app factory — Composition Root (DESIGN.md §3.3).
 *
 * Accepts dependency overrides for testing (Dependency Inversion).
 * Production wiring happens in index.ts; tests pass FixedClock, mocks, etc.
 */
export function buildApp(deps: Partial<AppDependencies> = {}) {
  const app = Fastify({ logger: false });

  // Store deps on app instance for route access
  app.decorate('deps', deps);

  // Health check (DESIGN.md §8)
  app.get('/api/health', async () => {
    return { status: 'ok' };
  });

  // Global error handler — maps AppError to standard envelope (DESIGN.md §8)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    // Unexpected errors — no stack traces in response
    console.error('Unhandled error:', error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}
