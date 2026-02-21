// types/index.ts

export interface VaultStatus {
    network: string;
    blockNumber: number;
    metrics: {
        totalDeposits: number;
        activeHtlcs: number;
    };
    health: {
        vaultContractReachable: boolean;
        mockBtcContractReachable: boolean;
        circuitTripped: boolean;
    };
}

export interface DepositRequest {
    amount: string;
    secret: string;
}

export interface DepositResponse {
    message: string;
    commitment: string;
    nullifier_hash: string;
    amount: number;
    secret: string;
}

export interface WithdrawRequest {
    nullifier: string;
    secret: string;
    proof: string;
}

export interface WithdrawResponse {
    message: string;
    status: string;
}

export interface DetectLockResponse {
    locked: boolean;
    blockHeight?: number;
    transactionId?: string;
    confirmations?: number;
    amount?: number;
    status: string;
}

export interface AuditEvent {
    id: number;
    timestamp: number;
    eventType: string;
    txHash: string;
    status: 'success' | 'pending' | 'failed';
    details: string;
}

export interface HealthResponse {
    status: string;
    starknet: {
        network: string;
        blockNumber: number;
        vaultContractReachable: boolean;
        mockBtcContractReachable: boolean;
        circuit: {
            status: string;
            failures: number;
            isTripped: boolean;
        };
    };
    db: {
        connected: boolean;
    };
    timestamp: number;
}
