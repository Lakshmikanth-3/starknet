/**
 * Custom typed errors for Starknet-related failures.
 * Import these in routes to give callers meaningful HTTP statuses.
 */

export class StarknetConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StarknetConnectionError';
    }
}

export class TransactionNotFoundError extends Error {
    readonly txHash: string;
    constructor(txHash: string) {
        super(`Transaction not found on Starknet Sepolia: ${txHash}`);
        this.name = 'TransactionNotFoundError';
        this.txHash = txHash;
    }
}

export class TransactionRevertedError extends Error {
    readonly txHash: string;
    constructor(txHash: string) {
        super(`Transaction reverted on-chain: ${txHash}`);
        this.name = 'TransactionRevertedError';
        this.txHash = txHash;
    }
}

export class CommitmentMismatchError extends Error {
    constructor(expected: string, actual: string) {
        super(`Commitment mismatch — expected: ${expected}, found in event: ${actual}`);
        this.name = 'CommitmentMismatchError';
    }
}
