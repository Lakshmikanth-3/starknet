import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    STARKNET_RPC_URL: z
        .string()
        .min(1, 'STARKNET_RPC_URL is required')
        .refine((u) => u.startsWith('https://'), {
            message: 'STARKNET_RPC_URL must start with https://',
        }),
    VAULT_CONTRACT_ADDRESS: z.string().default('0x072d121d6a86c73b649519cb51546dfba728ff0f1f3c041662ea7088ef01775'),
    MOCKBTC_CONTRACT_ADDRESS: z.string().default('0x0201c23ba72660516c987e8d11b8f6238b386f13099880cd1a8f5b065667343'),
    DB_PATH: z.string().default('./privatebtc-production-v4.db'),
    ENCRYPTION_KEY: z
        .string()
        .min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    // Wallet / Account — optional; needed for VaultService tx execution
    ACCOUNT_ADDRESS: z.string().default(''),
    PRIVATE_KEY: z.string().default(''),
    BITCOIN_NETWORK: z.enum(['signet', 'mainnet', 'testnet']).default('signet'),
    XVERSE_WALLET_ADDRESS: z.string().startsWith('tb1').default('tb1q'),
    MEMPOOL_API_URL: z.string().url().default('https://mempool.space/signet/api'),
    SIGNET_MIN_CONFIRMATIONS: z.coerce.number().default(1),
    STARKNET_ACCOUNT_ADDRESS: z.string().startsWith('0x').default('0x'),
    SEPOLIA_PRIVATE_KEY: z.string().startsWith('0x').default('0x'),
    VAULT_ADDRESS: z.string().startsWith('0x').default('0x'),
    SBTC_ADDRESS: z.string().startsWith('0x').default('0x'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    const formatted = parsed.error.format();
    Object.entries(formatted).forEach(([key, val]) => {
        if (key !== '_errors') {
            const msgs = (val as { _errors: string[] })._errors;
            if (msgs.length) console.error(`  ${key}: ${msgs.join(', ')}`);
        }
    });
    process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
