import { RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDRESS = '0x040b5d051f333646dda1b93a85419ba12d98a7e19a8d95ee638a8fef6ea15f4c';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

console.log('Testing Sepolia Connection...');
console.log('RPC URL:', RPC_URL);
console.log('Account:', ACCOUNT_ADDRESS);
console.log('Private Key Set:', !!PRIVATE_KEY);
console.log('');

const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function test() {
    try {
        console.log('1. Testing RPC endpoint...');
        const chainId = await provider.getChainId();
        console.log('✅ Chain ID:', chainId);
    } catch (error: any) {
        console.error('❌ RPC endpoint test failed:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        return;
    }

    try {
        console.log('\n2. Testing account nonce...');
        const nonce = await provider.getNonceForAddress(ACCOUNT_ADDRESS, 'latest');
        console.log('✅ Account nonce:', nonce);
    } catch (error: any) {
        console.error('❌ Account nonce test failed:');
        console.error('   Message:', error.message);
        console.error('   Name:', error.name);
        return;
    }

    console.log('\n✅ All connectivity tests passed!');
}

test();
