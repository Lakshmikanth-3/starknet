import { Request, Response, NextFunction } from 'express';

/**
 * Middleware: Reject any request where txHash (body or params)
 * does not match the real Starknet tx hash format.
 *
 * Valid format: 0x followed by exactly 63 or 64 lowercase hex chars.
 */

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{63,64}$/;

export function validateTxHash(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Check body and route params
    const txHash: unknown =
        req.body?.txHash ?? req.params?.txHash ?? undefined;

    if (txHash === undefined) {
        next();
        return;
    }

    if (typeof txHash !== 'string' || !TX_HASH_REGEX.test(txHash)) {
        console.warn(
            `⛔ Rejected fake/invalid tx_hash attempt: "${txHash}" from ${req.ip} [${req.method} ${req.path}]`
        );
        res.status(400).json({
            success: false,
            error: 'Invalid Starknet transaction hash format',
            detail: 'Expected 0x followed by 63 or 64 lowercase hex characters',
        });
        return;
    }

    next();
}
