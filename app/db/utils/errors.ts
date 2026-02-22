import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details?: unknown) {
    super(message, 404, details);
  }
}

export function fromZodError(err: unknown): BadRequestError | unknown {
  if (!(err instanceof ZodError)) return err;

  const details = err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return new BadRequestError('Validation error', details);
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export function handleApiError(e: unknown): Response {
  if (e instanceof ZodError) {
    const be = fromZodError(e) as BadRequestError;
    return json({ error: be.message, details: be.details }, { status: be.status });
  }

  if (e instanceof AppError) {
    return json({ error: e.message, details: e.details }, { status: e.status });
  }

  const errorName = typeof e === 'object' && e && 'name' in e ? (e as { name?: string }).name : undefined;
  if (errorName === 'JsonWebTokenError') {
    return json({ error: 'Invalid token' }, { status: 401 });
  }
  if (errorName === 'TokenExpiredError') {
    return json({ error: 'Token expired' }, { status: 401 });
  }

  console.error('[API ERROR]', e);
  return json({ error: 'Internal Server Error' }, { status: 500 });
}
