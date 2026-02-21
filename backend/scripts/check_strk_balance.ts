import { Contract, RpcProvider, Account, num } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });
const ADMIN_ADDRESS = '0x040b5d051f333646dda1b93a85419ba12d98a7e19a8d95ee638a8fef6ea15f4c';
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'; // STRK on Sepolia

async function main() {
    console.log(`🔌 Connecting to Sepolia...`);
    console.log(`📡 RPC: ${RPC_URL}`);
    try {
        const { abi: erc20Abi } = await PROVIDER.getClassAt(STRK_ADDRESS);
        if (!erc20Abi) throw new Error('STRK ABI not found');

        const contract = new Contract(erc20Abi, STRK_ADDRESS, PROVIDER);
        const balance = await contract.balanceOf(ADMIN_ADDRESS);

        // Uint256 in Starknet.js 6.x is often returned as a bigint or object
        const amount = num.toBigInt(balance.low || balance);
        console.log(`✅ STRK Balance: ${amount.toString()} (raw)`);
        console.log(`✅ STRK Balance: ${Number(amount) / 1e18} STRK`);
    } catch (error: any) {
        console.error('❌ Failed to check STRK balance:', error.message);
    }
}

main();
