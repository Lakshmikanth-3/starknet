/**
 * 404 Not Found Middleware — PrivateBTC Vault
 */

import { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`
    });
};
