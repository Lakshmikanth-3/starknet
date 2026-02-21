/**
 * Global Error Handler — PrivateBTC Vault
 *
 * Catches all unhandled errors and malformed JSON payloads.
 * Ensures clean JSON responses without exposing stack traces to the client.
 */

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log internal detail to console for debugging
    console.error(`[INTERNAL_ERROR] ${err.stack || err.message || err}`);

    // Handle malformed JSON body (SyntaxError from express.json)
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON body',
            code: 400
        });
    }

    // Default status code
    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({
        success: false,
        error: status === 500 ? 'Internal server error' : message,
        code: status
    });
};
