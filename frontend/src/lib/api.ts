// lib/api.ts
import axios from 'axios';
import {
    VaultStatus,
    DepositRequest,
    DepositResponse,
    WithdrawRequest,
    WithdrawResponse,
    DetectLockResponse,
    AuditEvent,
    HealthResponse,
    AuditVerifyResponse
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000 // Added 30 second timeout as backend does exponential backoff
});

export const api = {
    // Vault State
    getVaultStatus: async (): Promise<VaultStatus> => {
        // Since /api/vault/status doesn't exist in the current backend routing, we derive stats from /health and /api/audit
        const health = await api.getHealth();
        // Fallback mock metrics if backend doesn't supply them directly
        return {
            network: health.starknet.network,
            blockNumber: health.starknet.blockNumber,
            metrics: {
                totalDeposits: 0,
                activeHtlcs: 0,
            },
            health: {
                vaultContractReachable: health.starknet.vaultContractReachable,
                mockBtcContractReachable: health.starknet.mockBtcContractReachable,
                circuitTripped: health.starknet.circuit.isTripped,
            }
        };
    },

    getHealth: async (): Promise<HealthResponse> => {
        const response = await apiClient.get<HealthResponse>('/health');
        return response.data;
    },

    getBtcStatus: async (): Promise<any> => {
        const response = await apiClient.get('/api/bridge/status');
        return response.data;
    },

    getDepositAddress: async (vaultId: string): Promise<any> => {
        const response = await apiClient.get(`/api/bridge/deposit-address?vault_id=${vaultId}`);
        return response.data;
    },

    // Core Actions
    depositCommitment: async (data: DepositRequest): Promise<DepositResponse> => {
        try {
            const response = await apiClient.post<any>('/api/commitment/create', data);

            // Handle nested data structures or direct mapping based on backend response evolution
            const responseData = response.data;
            return {
                commitment: responseData.commitment_hash || responseData.data?.commitment || responseData.commitment,
                nullifier_hash: responseData.nullifier_hash || responseData.data?.nullifier_hash,
                status: 'success',
                transaction_hash: ''
            };
        } catch (error: any) {
            const errorBody = error.response?.data?.error || error.message;
            console.error('[api] createCommitment failed:', error.response?.status, errorBody);
            throw new Error(`Request failed with status code ${error.response?.status || 500}: ${errorBody}`);
        }
    },

    withdrawCommitment: async (data: WithdrawRequest): Promise<WithdrawResponse> => {
        // Maps to backend /api/withdraw route (needs to be adapted if the route expects different payload)
        const response = await apiClient.post<WithdrawResponse>('/api/vault/withdraw', data);
        return response.data;
    },

    // Bridge
    detectLock: async (address: string, amount: number): Promise<DetectLockResponse> => {
        const response = await apiClient.get<any>('/api/bridge/detect-lock', {
            params: {
                address: address,  // Backend route expects 'address', not 'vault_id'
                amount: amount     // BTC float e.g. 0.002
            }
        });

        const data = response.data.data || response.data;
        return {
            locked: data.detected,
            transactionId: data.txid,
            confirmations: data.confirmations,
            amountMatched: data.amount_btc, // Fixed property name
            status: data.detected ? 'LOCKED' : 'PENDING',
            signet_url: data.signet_url,    // Included missing property
            mempool_url: data.mempool_url,  // Included missing property
        };
    },

    broadcastTx: async (amount: string): Promise<any> => {
        const response = await apiClient.post('/api/bridge/broadcast', { amount });
        return response.data;
    },

    // Check sender balance for auto-broadcast availability
    checkSenderBalance: async (): Promise<{
        hasFunds: boolean;
        balance: number;
        balanceBTC: string;
        canBroadcast: boolean;
        message: string;
        address?: string;
    }> => {
        const response = await apiClient.get('/api/bridge/sender-balance');
        return response.data;
    },

    // Audit
    getAuditLogs: async (): Promise<AuditEvent[]> => {
        try {
            const response = await apiClient.get('/api/audit');
            return response.data.events || [];
        } catch {
            return [];
        }
    }
};


export const submitDeposit = (body: {
    vault_id: string;
    commitment: string;
    amount: number;
    bitcoin_txid?: string;
    secret?: string;   // forwarded for ZK proof generation
    salt?: string;     // optional explicit salt
}): Promise<DepositResponse> =>
    apiClient.post('/api/commitment/deposit', body).then(r => r.data);

export const verifyAudit = (): Promise<AuditVerifyResponse> =>
    apiClient.post('/api/audit/verify').then(r => r.data);

export const getAudit = (): Promise<{ events: AuditEvent[] }> =>
    apiClient.get('/api/audit').then(r => r.data);
