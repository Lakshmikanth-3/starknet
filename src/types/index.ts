export interface CreateVaultParams {
    userAddress: string;
    amount: number;
    lockPeriod: number;
}

export interface WithdrawParams {
    vaultId: string;
    proof: string;
    userAddress: string;
}

export interface Vault {
    id: number;
    vault_id: string;
    user_address: string;
    commitment: string;
    lock_period: number;
    created_at: number;
    unlock_at: number;
    status: 'locked' | 'unlocked' | 'withdrawn';
    apy: number;
    is_withdrawn: boolean;
    withdrawn_at?: number;
}

export interface Commitment {
    id: number;
    vault_id: string;
    commitment: string;
    randomness: string;
    amount: number;
    created_at: number;
}

export interface Transaction {
    id: number;
    vault_id: string;
    tx_type: 'deposit' | 'withdraw';
    tx_hash: string;
    amount?: number;
    timestamp: number;
}

export interface ProofResult {
    proof: string;
    publicInputs: string[];
}

export interface VaultResponse {
    vaultId: string;
    commitment: string;
    lockPeriod: number;
    createdAt: number;
    unlockAt: number;
    status: string;
    apy: number;
    daysRemaining: number;
    amount: number;
    projectedYield: string;
    totalWithdrawal: string;
}
