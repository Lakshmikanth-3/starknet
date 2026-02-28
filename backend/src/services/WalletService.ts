/**
 * WalletService — singleton Starknet Account + RpcProvider.
 * Uses STARKNET_RPC_URL + ACCOUNT_ADDRESS + PRIVATE_KEY (or SEPOLIA_PRIVATE_KEY) from env.
 *
 * Rules:
 *  - Provider is the same singleton used by StarknetService (via config)
 *  - Account is loaded once and reused
 *  - getBalance() returns live MockBTC ERC20 balance
 */

import { Account, Contract, type Abi, uint256, RpcProvider } from 'starknet';
import { StarknetService } from './StarknetService';
import { config } from '../config/env';

// ─── Inline ERC20 ABI (balanceOf only) ─────────────────────────────────────
const ERC20_ABI: Abi = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'felt' }],
        outputs: [
            { name: 'low', type: 'felt' },
            { name: 'high', type: 'felt' },
        ],
        stateMutability: 'view',
    },
] as unknown as Abi;

// ─── Singletons ─────────────────────────────────────────────────────────────
let _provider: RpcProvider | null = null;
let _account: Account | null = null;

export class WalletService {
    /** Get (or create) the RpcProvider singleton. */
    static getProvider(): RpcProvider {
        if (!_provider) {
            _provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
        }
        return _provider;
    }

    /**
     * Get (or create) the Account singleton.
     * Falls back to SEPOLIA_PRIVATE_KEY if PRIVATE_KEY is not set.
     * Returns null if neither is configured — callers must handle this.
     */
    static getAccount(): Account | null {
        if (_account) return _account;

        const privateKey = config.PRIVATE_KEY || config.SEPOLIA_PRIVATE_KEY;
        const accountAddress = config.ACCOUNT_ADDRESS || config.STARKNET_ACCOUNT_ADDRESS;

        // Note: Default for STARKNET_ACCOUNT_ADDRESS is '0x' in env.ts so we should check length
        if (!privateKey || !accountAddress || accountAddress === '0x') {
            console.warn(
                '⚠️ WalletService: ACCOUNT_ADDRESS or PRIVATE_KEY not set — account operations unavailable.'
            );
            return null;
        }

        _account = new Account({
            provider: { nodeUrl: config.STARKNET_RPC_URL },
            address: accountAddress,
            signer: privateKey
        });
        return _account;
    }

    /**
     * Returns true if a usable account is configured.
     * Used by health checks and route guards.
     */
    static isAccountConfigured(): boolean {
        const privateKey = config.PRIVATE_KEY || config.SEPOLIA_PRIVATE_KEY;
        const accountAddress = config.ACCOUNT_ADDRESS || config.STARKNET_ACCOUNT_ADDRESS;
        return Boolean(privateKey && accountAddress && accountAddress !== '0x');
    }

    /**
     * Fetch live MockBTC (ERC-20) balance for any wallet address.
     * Returns balance as bigint (in satoshi-unit tokens).
     */
    static async getBalance(walletAddress: string): Promise<bigint> {
        const provider = this.getProvider();
        const contract = new Contract({
            abi: ERC20_ABI,
            address: config.MOCKBTC_CONTRACT_ADDRESS,
            providerOrAccount: provider
        });

        const result = await contract.call('balanceOf', [walletAddress]);
        const r = result as unknown as { low: bigint | string; high: bigint | string };

        // Starknet ERC20 uses Uint256 (low + high)
        const low = uint256.uint256ToBN({ low: BigInt(r.low), high: BigInt(r.high) });
        return low;
    }

    /**
     * Get the address of the loaded account, or null.
     */
    static getAccountAddress(): string | null {
        const addr = config.ACCOUNT_ADDRESS || config.STARKNET_ACCOUNT_ADDRESS;
        return addr && addr !== '0x' ? addr : null;
    }
}
