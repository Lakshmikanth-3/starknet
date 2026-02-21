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
        const response = await apiClient.get('/api/bridge/btc-status');
        return response.data;
    },

    // Core Actions
    depositCommitment: async (data: DepositRequest): Promise<DepositResponse> => {
        // Maps to the backend /api/commitment/create route
        const response = await apiClient.post<DepositResponse>('/api/commitment/create', data);
        return response.data;
    },

    withdrawCommitment: async (data: WithdrawRequest): Promise<WithdrawResponse> => {
        // Maps to backend /api/withdraw route (needs to be adapted if the route expects different payload)
        const response = await apiClient.post<WithdrawResponse>('/api/vault/withdraw', data);
        return response.data;
    },

    // Bridge
    detectLock: async (address: string, amountSats: number): Promise<DetectLockResponse> => {
        const response = await apiClient.post<any>('/api/bridge/detect-lock', {
            address,
            amountSats,
            simulate: false
        });
        return response.data.data || response.data;
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
}): Promise<DepositResponse> =>
    apiClient.post('/api/commitment/deposit', body).then(r => r.data);

export const verifyAudit = (): Promise<AuditVerifyResponse> =>
    apiClient.post('/api/audit/verify').then(r => r.data);

export const getAudit = (): Promise<{ events: AuditEvent[] }> =>
    apiClient.get('/api/audit').then(r => r.data);
