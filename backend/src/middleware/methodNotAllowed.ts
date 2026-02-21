/**
 * 405 Method Not Allowed Middleware — PrivateBTC Vault
 */

import { Request, Response } from 'express';

export const methodNotAllowed = (req: Request, res: Response) => {
    res.status(405).json({
        success: false,
        error: 'Method not allowed'
    });
};
