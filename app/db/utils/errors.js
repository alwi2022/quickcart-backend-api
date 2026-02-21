// utils/errors.js
import { ZodError } from 'zod';

export class AppError extends Error {
    constructor(message, status = 500, details = undefined) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.details = details;
    }
}
export class BadRequestError extends AppError {
    constructor(message = 'Bad Request', details) { super(message, 400, details); }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', details) { super(message, 401, details); }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', details) { super(message, 403, details); }
}
export class NotFoundError extends AppError {
    constructor(message = 'Not Found', details) { super(message, 404, details); }
}

export function fromZodError(err) {
    if (!(err instanceof ZodError)) return err;
    // Rangkuman error Zod yang rapi
    const details = err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
    }));
    return new BadRequestError('Validation error', details);
}

// utils/errors.js
export function json(data, init = {}) {
    const status = init.status || 200;

    // Gunakan Headers agar Set-Cookie (dan header lain) tetap utuh
    const headers = new Headers(init.headers || undefined);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return new Response(JSON.stringify(data), { status, headers });
}


// Centralized error handler untuk App Router
export function handleApiError(e) {
    // Zod → BadRequest
    if (e instanceof ZodError) {
        const be = fromZodError(e);
        return json({ error: be.message, details: be.details }, { status: be.status });
    }
    // AppError khusus
    if (e instanceof AppError) {
        return json({ error: e.message, details: e.details }, { status: e.status });
    }
    // JWT errors umum dari jsonwebtoken
    if (e?.name === 'JsonWebTokenError') {
        return json({ error: 'Invalid token' }, { status: 401 });
    }
    if (e?.name === 'TokenExpiredError') {
        return json({ error: 'Token expired' }, { status: 401 });
    }

    console.error('[API ERROR]', e);
    return json({ error: 'Internal Server Error' }, { status: 500 });
}
