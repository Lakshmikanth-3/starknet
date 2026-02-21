import { RpcProvider, Account, constants } from 'starknet';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkBalance() {
    const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
    const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
    const provider = new RpcProvider({ nodeUrl: RPC_URL });

    console.log(`Checking balance for: ${ACCOUNT_ADDRESS}`);

    try {
        // ETH Address on Sepolia
        const ethAddr = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
        // STRK Address on Sepolia
        const strkAddr = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

        const ethBal = await provider.callContract({
            contractAddress: ethAddr,
            entrypoint: 'balanceOf',
            calldata: [ACCOUNT_ADDRESS]
        });
        console.log(`ETH Balance: ${BigInt(ethBal[0]).toString()}`);

        const strkBal = await provider.callContract({
            contractAddress: strkAddr,
            entrypoint: 'balanceOf',
            calldata: [ACCOUNT_ADDRESS]
        });
        console.log(`STRK Balance: ${BigInt(strkBal[0]).toString()}`);

    } catch (err: any) {
        console.error('Failed to check balance:', err.message);
    }
}

checkBalance();
