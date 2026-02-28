/**
 * Extract full ABI from deployed contract and save it
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';
import fs from 'fs';
import path from 'path';

async function extractABI() {
    console.log('🔍 Extracting full ABI from deployed contract...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        const contractClass = await provider.getClassAt(config.VAULT_CONTRACT_ADDRESS);
        
        const outputPath = path.join(__dirname, 'vault_abi_extracted.json');
        fs.writeFileSync(outputPath, JSON.stringify(contractClass.abi, null, 2));
        
        console.log(`✓ ABI saved to: ${outputPath}\n`);
        console.log('ABI Structure:');
        console.log(JSON.stringify(contractClass.abi, null, 2));
        
    } catch (err: any) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

extractABI();
