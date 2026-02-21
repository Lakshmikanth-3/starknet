import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

// NO DOTENV

const LOG_FILE = 'deploy_nethermind.log';
// Clear log
fs.writeFileSync(LOG_FILE, 'Script Started\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Nethermind RPC
const RPC_URL = 'https://free-rpc.nethermind.io/sepolia-juno';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = '0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48';

log(`Using RPC: ${RPC_URL}`);

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function main() {
    log('🚀 Explicit V3 Deployment (Nethermind) - FORCE DEPLOY');

    const sierraPath = path.join(__dirname, '../../../contracts/target/dev/private_btc_core_MockBTC.contract_class.json');

    if (!fs.existsSync(sierraPath)) {
        log('❌ Sierra file not found!');
        return;
    }
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = hash.computeContractClassHash(sierra);
    const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });

    log(`📝 Class Hash: ${classHash}`);

    try {
        log('⚖️  Fetching Gas Price (Skipping Estimation)...');
        let block: any;
        try {
            block = await provider.getBlock('latest');
            log(`📦 Block: ${block.block_hash}, L1 Gas (Fri): ${block.l1_gas_price?.price_in_fri}`);
        } catch (e: any) {
            log(`⚠️ Failed to fetch block: ${e.message}`);
        }

        let gasPriceL1 = 1000000000n;
        if (block && block.l1_gas_price && block.l1_gas_price.price_in_fri) {
            // @ts-ignore
            gasPriceL1 = BigInt(block.l1_gas_price.price_in_fri);
        }

        log(`⛽ L1 Gas Price Used: ${gasPriceL1}`);

        // Hardcode generous bounds
        const maxPrice = gasPriceL1 * 10n; // 10x safety
        const maxAmount = 100000n;

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
    }
}

main();
