import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const LOG_FILE = 'deploy_force_detail.log';
// Clear log file
fs.writeFileSync(LOG_FILE, 'Script Started\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Use Blast API
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function main() {
    log('🚀 Explicit V3 Deployment (BlastAPI) - FORCE DEPLOY DEBUG');

    // MockBTC Class hash
    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = hash.computeContractClassHash(sierra);
    const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });

    log(`📝 Class Hash: ${classHash}`);

    try {
        // Check if declared
        try {
            await provider.getClassByHash(classHash);
            log('✅ MockBTC Already Declared');
        } catch {
            log('⚠️ Class hash not found on node. Assuming it might be declared or attempting without check (risky).');
        }

        log('⚖️  Fetching Gas Price (Skipping Estimation)...');
        let block: any;
        try {
            // Use latest instead of pending
            block = await provider.getBlock('latest');
            log(`📦 Block fetched: ${block.block_hash}`);
        } catch (e: any) {
            log(`⚠️ Failed to fetch block: ${e.message}`);
        }

        let gasPriceL1 = 1000000000n; // Default 1 Gwei in Fri

        if (block && block.l1_gas_price) {
            // @ts-ignore
            if (block.l1_gas_price.price_in_fri) {
                // @ts-ignore
                gasPriceL1 = BigInt(block.l1_gas_price.price_in_fri);
            } else if (block.l1_gas_price.price_in_wei) {
                // Fallback to wei if fri missing
                // @ts-ignore
                gasPriceL1 = BigInt(block.l1_gas_price.price_in_wei);
            }
        }

        log(`⛽ L1 Gas Price (Fri/Wei): ${gasPriceL1}`);

        // Hardcode generous bounds
        // Max Price: 3x current (generous!)
        const maxPrice = gasPriceL1 * 3n;
        const maxAmount = 200000n; // 200k gas

        // Both L1 and L2 bounds
        const resourceBounds = {
            l1_gas: {
                max_amount: '0x' + maxAmount.toString(16),
                max_price_per_unit: '0x' + maxPrice.toString(16)
            },
            l2_gas: {
                max_amount: '0x' + maxAmount.toString(16),
                max_price_per_unit: '0x' + maxPrice.toString(16)
            }
        };

        log(`🚀 Deploying with bounds: ${JSON.stringify(resourceBounds)}`);

        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        }, {
            version: 3,
            resourceBounds: resourceBounds
        });

        log(`✅ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        log(`🎉 MockBTC Deployed at: ${deploy.contract_address}`);

        fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);

    } catch (err: any) {
        log(`❌ Failed: ${err.message}`);
        if (err.data) log(`Error Data: ${JSON.stringify(err.data)}`);
        // if (err.stack) log(err.stack);
    }
}

main();
