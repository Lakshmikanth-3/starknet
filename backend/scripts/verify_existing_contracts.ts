import { RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.STARKNET_RPC_URL || '';
const VAULT_ADDRESS = process.env.VAULT_CONTRACT_ADDRESS || '';
const MOCKBTC_ADDRESS = process.env.MOCKBTC_CONTRACT_ADDRESS || '';

async function verifyContracts() {
    console.log('🔍 Verifying Existing Contracts on Sepolia\n');
    console.log(`   RPC: ${RPC_URL.substring(0, 50)}...`);
    console.log(`   Vault: ${VAULT_ADDRESS}`);
    console.log(`   MockBTC: ${MOCKBTC_ADDRESS}\n`);

    const provider = new RpcProvider({ nodeUrl: RPC_URL });

    try {
        // Check Vault
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Checking Vault Contract');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        const vaultClassHash = await provider.getClassHashAt(VAULT_ADDRESS);
        console.log(`   ✅ Vault EXISTS on Sepolia`);
        console.log(`   Class Hash: ${vaultClassHash}`);
        console.log(`   🔗 https://sepolia.voyager.online/contract/${VAULT_ADDRESS}\n`);

        // Check MockBTC
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Checking MockBTC Contract');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        const mockBtcClassHash = await provider.getClassHashAt(MOCKBTC_ADDRESS);
        console.log(`   ✅ MockBTC EXISTS on Sepolia`);
        console.log(`   Class Hash: ${mockBtcClassHash}`);
        console.log(`   🔗 https://sepolia.voyager.online/contract/${MOCKBTC_ADDRESS}\n`);

        console.log('╔══════════════════════════════════════════════════╗');
        console.log('║   ✅ Both contracts exist and are accessible!   ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('💡 You can skip deployment and use these existing contracts!\n');

    } catch (error: any) {
        console.error('❌ Contract verification failed');
        console.error(`   ${error.message || error}\n`);
        console.log('⚠️  You may need to deploy new contracts.\n');
        process.exit(1);
    }
}

verifyContracts();
