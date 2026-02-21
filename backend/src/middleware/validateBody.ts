/**
 * Validation Middleware — PrivateBTC Vault
 *
 * Enforces strictly non-empty fields and correct Content-Type.
 */

import { Request, Response, NextFunction } from 'express';

export const validateBody = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Check Content-Type
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const contentType = req.headers['content-type'];
            if (!contentType || !contentType.includes('application/json')) {
                return res.status(400).json({
                    success: false,
                    error: 'Content-Type must be application/json'
                });
            }
        }

        // Check if body exists
        if (!req.body) {
            return res.status(400).json({
                success: false,
                error: 'Request body is required'
            });
        }

        // Check if body is empty object
        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body cannot be empty'
            });
        }

        // Check for required fields
        for (const field of requiredFields) {
            const val = req.body[field];

            // Missing field
            if (val === undefined || val === null) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required field: ${field}`
                });
            }

            // Must be non-empty string or valid number
            if (typeof val === 'string') {
                if (val.trim().length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Missing required field: ${field}`
                    });
                }
            } else if (typeof val === 'number') {
                if (isNaN(val)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid type for field: ${field}`
                    });
                }
            } else {
                // Not a string or number
                return res.status(400).json({
                    success: false,
                    error: `Invalid type for field: ${field}`
                });
            }
        }

        next();
    };
};
