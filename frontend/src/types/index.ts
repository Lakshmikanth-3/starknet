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

export interface DepositResponse {
    transaction_hash: string;
    status: string;
    vault_id: string;
    timestamp: string;
}

export interface AuditVerifyResult {
    tx_hash: string;
    status: string;
    voyager_url: string | null;
}

export interface AuditVerifyResponse {
    verified: number;
    pending: number;
    failed: number;
    simulated: number;
    results: AuditVerifyResult[];
}

export interface AuditEvent {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'HTLC_CLAIM' | 'HTLC_REFUND';
    tx_hash: string;
    status: string;
    amount: number;
    timestamp: string;
    voyager_url: string | null;
}
