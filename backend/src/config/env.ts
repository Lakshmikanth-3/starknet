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
    VAULT_CONTRACT_ADDRESS: z.string().default('0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2'),
    MOCKBTC_CONTRACT_ADDRESS: z.string().default('0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52'),
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
    SEPOLIA_PRIVATE_KEY: z.string().default(''),
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
