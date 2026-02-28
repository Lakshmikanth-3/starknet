/**
 * Extract ERC20 token ABI from deployed contract
 */

import { RpcProvider } from 'starknet';
import { config } from '../src/config/env';
import fs from 'fs';
import path from 'path';

async function extractTokenABI() {
    console.log('🔍 Extracting MockBTC token ABI...\n');
    
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    
    try {
        const contractClass = await provider.getClassAt(config.SBTC_CONTRACT_ADDRESS);
        
        const outputPath = path.join(__dirname, 'token_abi_extracted.json');
        fs.writeFileSync(outputPath, JSON.stringify(contractClass.abi, null, 2));
        
        console.log(`✓ Token ABI saved to: ${outputPath}\n`);
        
        // Find balanceOf function
        const findFunction = (name: string): any => {
            for (const item of contractClass.abi) {
                if (item.type === 'interface' && item.items) {
                    const fn = item.items.find((i: any) => i.name === name);
                    if (fn) return fn;
                }
            }
            return null;
        };
        
        const balanceOf = findFunction('balanceOf') || findFunction('balance_of');
        console.log('balanceOf function:', JSON.stringify(balanceOf, null, 2));
        
    } catch (err: any) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

extractTokenABI();
