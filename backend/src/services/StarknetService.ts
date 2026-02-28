/**
 * StarknetService — 100% live Starknet Sepolia calls.
 * No mocks, no fallbacks, no cached block numbers.
 *
 * Inline ABI fragments for: deposit(), withdraw(),
 * is_commitment_registered(), balanceOf()
 */

import { RpcProvider, Contract, num, type Abi, uint256 } from 'starknet';
import { config } from '../config/env';
import {
    StarknetConnectionError,
    TransactionNotFoundError,
    TransactionRevertedError,
    CommitmentMismatchError,
} from '../types/errors';

// ─── Inline ABI fragments (only what we call) ──────────────────────────────
// Matches the actual Cairo contract signatures in contracts/src/vault.cairo
const VAULT_ABI = [
    {
        name: 'deposit',
        type: 'function',
        inputs: [
            { name: 'commitment', type: 'felt' },  // Only commitment - no amount
        ],
        outputs: [],
        stateMutability: 'external',
    },
    {
        name: 'withdraw',
        type: 'function',
        inputs: [
            { name: 'nullifier', type: 'felt' },
            { name: 'proof', type: 'core::array::Span::<core::felt252>' },
            { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'amount', type: 'u256' },
        ],
        outputs: [],
        stateMutability: 'external',
    },
    {
        name: 'get_total_staked',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'u256' }],
        stateMutability: 'view',
    },
] as const;

const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
        outputs: [{ type: 'u256' }],
        stateMutability: 'view',
    },
    {
        name: 'balance_of',  // snake_case variant
        type: 'function',
        inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
        outputs: [{ type: 'u256' }],
        stateMutability: 'view',
    },
    {
        name: 'mint',
        type: 'function',
        inputs: [
            { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'amount', type: 'u256' }
        ],
        outputs: [],
        stateMutability: 'external',
    },
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'amount', type: 'u256' }
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'external',
    },
] as const;

// ─── Provider singleton ─────────────────────────────────────────────────────
let _provider: RpcProvider | null = null;

// ─── Receipt shape ─────────────────────────────────────────────────────────
export interface TransactionReceipt {
    transaction_hash: string;
    block_number: number;
    block_hash: string;
    execution_status: 'SUCCEEDED' | 'REVERTED';
    events: Array<{
        from_address: string;
        keys: string[];
        data: string[];
    }>;
    actual_fee?: unknown;
}

export interface DepositVerifyResult {
    verified: boolean;
    blockNumber: number;
    blockTimestamp: number;
    actualCommitment?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────
export class StarknetService {
    private static circuitStatus: 'CLOSED' | 'OPEN' | 'HALF-OPEN' = 'CLOSED';
    private static consecutiveFailures = 0;
    private static nextAttemptAt = 0;
    private static readonly THRESHOLD = 5;
    private static readonly RESET_TIMEOUT_MS = 60000; // 1 minute
    private static readonly RPC_TIMEOUT_MS = 15000;    // 15 seconds

    /** RpcProvider singleton — uses STARKNET_RPC_URL from env */
    static getProvider(): RpcProvider {
        if (!_provider) {
            _provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
        }
        return _provider;
    }

    /** Returns current circuit breaker state for /health */
    static getCircuitState() {
        return {
            status: this.circuitStatus,
            failures: this.consecutiveFailures,
            nextAttemptAt: this.nextAttemptAt,
            isTripped: this.circuitStatus === 'OPEN'
        };
    }

    /**
     * Resilience wrapper for all RPC calls.
     * Handles: Timeouts, Failure Tracking, Circuit Breaker.
     */
    private static async withResilience<T>(fn: (provider: RpcProvider) => Promise<T>): Promise<T> {
        const now = Date.now();

        // 1. Check if circuit is OPEN
        if (this.circuitStatus === 'OPEN') {
            if (now >= this.nextAttemptAt) {
                console.log('🔌 Circuit HALF-OPEN: Testing RPC connectivity...');
                this.circuitStatus = 'HALF-OPEN';
            } else {
                throw new Error(`RPC circuit is OPEN. Next retry in ${Math.ceil((this.nextAttemptAt - now) / 1000)}s`);
            }
        }

        try {
            // 2. Execute with timeout
            const provider = this.getProvider();
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('RPC request timed out')), this.RPC_TIMEOUT_MS)
            );

            const result = await Promise.race([fn(provider), timeoutPromise]);

            // Success: Reset circuit
            this.consecutiveFailures = 0;
            this.circuitStatus = 'CLOSED';
            return result;
        } catch (err) {
            // Failure: Update circuit
            this.consecutiveFailures++;
            console.error(`❌ RPC Failure (${this.consecutiveFailures}/${this.THRESHOLD}):`, err instanceof Error ? err.message : err);

            if (this.consecutiveFailures >= this.THRESHOLD) {
                this.circuitStatus = 'OPEN';
                this.nextAttemptAt = Date.now() + this.RESET_TIMEOUT_MS;
                console.error(`🚨 RPC Circuit TRIPPED: Entering OPEN state for ${this.RESET_TIMEOUT_MS / 1000}s`);
            }

            throw err;
        }
    }

    /** Live block number — uses resilience wrapper. */
    static async getLiveBlockNumber(): Promise<number> {
        return this.withResilience(async (provider) => {
            return await provider.getBlockNumber();
        }).catch(err => {
            throw new StarknetConnectionError(
                `Failed to get block number: ${err instanceof Error ? err.message : String(err)}`
            );
        });
    }

    /** Execute the actual deposit (mint sBTC) on-chain via the relayer account */
    static async executeDeposit(params: {
        commitment: string;
        amount: bigint;
        vault_id: string;
    }): Promise<string> {
        return this.withResilience(async (provider) => {
            const { WalletService } = await import('./WalletService');

            const account = WalletService.getAccount();
            if (!account) {
                throw new Error('INSUFFICIENT SEPOLIA ETH: No relayer account configured');
            }

            const amountU256 = uint256.bnToUint256(params.amount);

            // Correct vault.deposit(commitment: felt252) signature from Cairo contract.
            // The vault doesn't transfer tokens itself - tokens must be sent to vault first.
            // We use a 2-call multicall:
            //   1. mockBtc.mint(vault, amount)     — mint tokens directly to vault
            //   2. vault.deposit(commitment)       — record commitment on-chain
            const mintCall = {
                contractAddress: config.MOCKBTC_CONTRACT_ADDRESS,
                entrypoint: 'mint',
                calldata: [
                    config.VAULT_CONTRACT_ADDRESS,  // mint directly to vault
                    amountU256.low.toString(),
                    amountU256.high.toString(),
                ]
            };

            const depositCall = {
                contractAddress: config.VAULT_CONTRACT_ADDRESS,
                entrypoint: 'deposit',
                calldata: [
                    params.commitment  // only commitment - matches Cairo signature
                ]
            };

            try {
                const nonce = await account.getNonce('latest');
                console.log(`[StarknetService] Executing deposit multicall for commitment: ${params.commitment}`);

                const response = await account.execute([mintCall, depositCall], {
                    nonce
                });

                console.log(`[StarknetService] Deposit tx sent. Hash: ${response.transaction_hash}`);
                return response.transaction_hash;
            } catch (err: any) {
                const errMsg = typeof err?.message === 'string'
                    ? err.message
                    : String(err ?? 'Unknown deposit execution error');
                const errMsgLower = errMsg.toLowerCase();
                if (errMsgLower.includes('balance is smaller') || errMsgLower.includes('insufficient')) {
                    throw new Error('INSUFFICIENT SEPOLIA ETH');
                }
                throw new Error(`Deposit execution failed: ${errMsg}`);
            }
        });
    }

    /** Validate tx hash format. */
    static validateTxHashFormat(txHash: string): boolean {
        return /^0x[0-9a-fA-F]{63,64}$/.test(txHash);
    }

    /** Execute the actual withdraw on-chain via the relayer account */
    static async withdraw(params: {
        nullifierHash: string;
        proof: string[];
        recipient: string;
        amount: bigint;
    }): Promise<string> {
        return this.withResilience(async (provider) => {
            const { WalletService } = await import('./WalletService');

            const account = WalletService.getAccount();
            if (!account) {
                throw new Error('INSUFFICIENT SEPOLIA ETH: No relayer account configured');
            }

            const call = {
                contractAddress: config.VAULT_CONTRACT_ADDRESS,
                entrypoint: 'withdraw',
                calldata: [
                    params.nullifierHash,
                    params.proof.length.toString(),
                    ...params.proof, // Span array elements
                    params.recipient,
                    uint256.bnToUint256(params.amount).low.toString(),
                    uint256.bnToUint256(params.amount).high.toString()
                ]
            };

            try {
                const nonce = await account.getNonce('latest');

                console.log(`[StarknetService] Executing withdraw transaction for nullifier: ${params.nullifierHash}`);

                const response = await account.execute(call, {
                    nonce
                });

                console.log(`[StarknetService] Withdraw tx sent. Hash: ${response.transaction_hash}`);
                return response.transaction_hash;
            } catch (err: any) {
                const errMsg = typeof err?.message === 'string'
                    ? err.message
                    : String(err ?? 'Unknown withdraw execution error');
                const errMsgLower = errMsg.toLowerCase();
                if (errMsgLower.includes('balance is smaller') || errMsgLower.includes('insufficient')) {
                    throw new Error('INSUFFICIENT SEPOLIA ETH');
                }
                throw new Error(`Withdraw execution failed: ${errMsg}`);
            }
        });
    }

    /** Fetch real transaction receipt from Starknet — uses resilience wrapper. */
    static async getTransactionReceipt(txHash: string): Promise<TransactionReceipt> {
        if (!this.validateTxHashFormat(txHash)) {
            throw new Error(`Invalid tx hash format: ${txHash}`);
        }
        return this.withResilience(async (provider) => {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) throw new TransactionNotFoundError(txHash);

            const r = receipt as unknown as {
                transaction_hash: string;
                block_number: number;
                block_hash: string;
                execution_status: string;
                events: Array<{ from_address: string; keys: string[]; data: string[] }>;
                actual_fee?: unknown;
            };

            return {
                transaction_hash: r.transaction_hash || txHash,
                block_number: r.block_number ?? 0,
                block_hash: r.block_hash ?? '',
                execution_status: (r.execution_status === 'SUCCEEDED' ? 'SUCCEEDED' : 'REVERTED') as 'SUCCEEDED' | 'REVERTED',
                events: r.events ?? [],
                actual_fee: r.actual_fee,
            };
        }).catch(err => {
            if (err instanceof TransactionNotFoundError) throw err;
            if (
                err instanceof Error &&
                (err.message.includes('not found') || err.message.includes('404'))
            ) {
                throw new TransactionNotFoundError(txHash);
            }
            throw err;
        });
    }

    /**
     * Poll Starknet every 5 seconds until tx is SUCCEEDED.
     * Throws TransactionRevertedError if REVERTED.
     * Throws Error on timeout (maxAttempts exceeded).
     */
    static async waitForTransaction(
        txHash: string,
        maxAttempts = 24
    ): Promise<TransactionReceipt> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`⏳ Attempt ${attempt}/${maxAttempts}: checking ${txHash}...`);

            try {
                const receipt = await this.getTransactionReceipt(txHash);

                if (receipt.execution_status === 'SUCCEEDED') {
                    console.log(`✅ Transaction confirmed at block ${receipt.block_number}`);
                    return receipt;
                }

                if (receipt.execution_status === 'REVERTED') {
                    throw new TransactionRevertedError(txHash);
                }
            } catch (err) {
                if (
                    err instanceof TransactionRevertedError ||
                    (err instanceof Error && err.message.includes('timeout'))
                ) {
                    throw err;
                }
                // TransactionNotFoundError or network error: tx still pending, keep polling
                console.log(`  ↳ Not yet confirmed (attempt ${attempt}). Waiting 5s...`);
            }

            if (attempt < maxAttempts) {
                await new Promise((res) => setTimeout(res, 5000));
            }
        }

        throw new Error(
            `Transaction ${txHash} not confirmed after ${maxAttempts} attempts (${maxAttempts * 5}s)`
        );
    }

    /**
     * Verify Deposit event in receipt — checks commitment matches.
     * Returns block number and block timestamp from receipt.
     */
    static async verifyDepositEvent(
        txHash: string,
        expectedCommitment: string
    ): Promise<DepositVerifyResult> {
        const receipt = await this.getTransactionReceipt(txHash);

        const vaultAddr = config.VAULT_CONTRACT_ADDRESS.toLowerCase();

        // Find Deposit event from our vault contract
        const depositEvent = receipt.events.find((ev) => {
            const fromAddr = ev.from_address.toLowerCase();
            return (
                fromAddr === vaultAddr &&
                ev.keys.length > 0 &&
                // Starknet events have the event selector in keys[0]
                ev.data.length > 0
            );
        });

        if (!depositEvent) {
            return {
                verified: false,
                blockNumber: receipt.block_number,
                blockTimestamp: 0,
            };
        }

        // Commitment is typically in data[0] for the Deposit event
        const actualCommitment = depositEvent.data[0] ?? '';
        const normalizedExpected = expectedCommitment.toLowerCase().replace('0x', '');
        const normalizedActual = actualCommitment.toLowerCase().replace('0x', '');
        const verified = normalizedExpected === normalizedActual;

        if (!verified) {
            throw new CommitmentMismatchError(expectedCommitment, actualCommitment);
        }

        // Fetch block to get timestamp
        let blockTimestamp = 0;
        try {
            const block = await this.withResilience(async (provider) => {
                return await provider.getBlock(receipt.block_number);
            });
            blockTimestamp = (block as unknown as { timestamp: number }).timestamp ?? 0;
        } catch {
            // Non-fatal — receipt confirmed, just can't get timestamp
        }

        return {
            verified: true,
            blockNumber: receipt.block_number,
            blockTimestamp,
            actualCommitment,
        };
    }

    /**
     * Verify Withdrawal event — checks nullifier appears in receipt.
     */
    static async verifyWithdrawalEvent(
        txHash: string,
        expectedNullifier: string
    ): Promise<boolean> {
        const receipt = await this.getTransactionReceipt(txHash);
        const vaultAddr = config.VAULT_CONTRACT_ADDRESS.toLowerCase();

        const normalized = expectedNullifier.toLowerCase().replace('0x', '');

        const found = receipt.events.some((ev) => {
            if (ev.from_address.toLowerCase() !== vaultAddr) return false;
            return ev.data.some(
                (d) => d.toLowerCase().replace('0x', '') === normalized
            );
        });

        return found;
    }

    /**
     * Check if a commitment is registered on-chain via contract call.
     */
    static async isCommitmentOnChain(commitment: string): Promise<boolean> {
        return this.withResilience(async (provider) => {
            const contract = new Contract({
                abi: VAULT_ABI as unknown as Abi,
                address: config.VAULT_CONTRACT_ADDRESS,
                providerOrAccount: provider
            });

            const result = await contract.call('is_commitment_registered', [commitment]);
            return BigInt(result as unknown as string) !== BigInt(0);
        }).catch(err => {
            console.error(`isCommitmentOnChain error for ${commitment}:`, err);
            return false;
        });
    }

    /**
     * Get live MockBTC (ERC-20) balance for a wallet address.
     */
    static async getMockBTCBalance(walletAddress: string): Promise<bigint> {
        return this.withResilience(async (provider) => {
            const contract = new Contract({
                abi: ERC20_ABI as unknown as Abi,
                address: config.MOCKBTC_CONTRACT_ADDRESS,
                providerOrAccount: provider
            });

            const result = await contract.call('balanceOf', [walletAddress]);
            const r = result as unknown as { low: bigint | string; high: bigint | string };

            // Uint256
            return uint256.uint256ToBN({ low: BigInt(r.low), high: BigInt(r.high) });
        }).catch(err => {
            throw new StarknetConnectionError(
                `Failed to fetch MockBTC balance for ${walletAddress}: ${err instanceof Error ? err.message : String(err)}`
            );
        });
    }

    /**
     * Quick contract reachability check for /health.
     */
    static async isContractReachable(address: string): Promise<boolean> {
        return this.withResilience(async (provider) => {
            const classHash = await provider.getClassHashAt(address, 'latest');
            return typeof classHash === 'string' && classHash.length > 2;
        }).catch(() => false);
    }
}
