import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync('deploy_step.log', msg + '\n');
}

const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function deployMockBTC() {
    log('🚀 Starting MockBTC Deployment');

    const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const classHash = hash.computeContractClassHash(sierra);

    log(`📝 Class Hash: ${classHash}`);

    // Deploy
    log('🚀 Deploying MockBTC...');
    const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });

    try {
        log('Attempting V2 deployment...');
        const deploy = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata
        });
        log(`⏳ Transaction Hash: ${deploy.transaction_hash}`);
        await provider.waitForTransaction(deploy.transaction_hash);
        log(`✅ MockBTC Deployed at: ${deploy.contract_address}`);

        fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);

    } catch (err: any) {
        log(`⚠️ V2 Failed: ${err.message}`);
        log('Attempting V3 deployment...');
        try {
            const deploy = await account.deployContract({
                classHash: classHash,
                constructorCalldata: constructorCalldata
            }, { version: 3 });
            log(`⏳ Transaction Hash (V3): ${deploy.transaction_hash}`);
            await provider.waitForTransaction(deploy.transaction_hash);
            log(`✅ MockBTC Deployed (V3) at: ${deploy.contract_address}`);

            fs.writeFileSync('mock_btc_address.txt', deploy.contract_address);
        } catch (v3Err: any) {
            log(`❌ V3 Failed: ${v3Err.message}`);
            throw v3Err;
        }
    }
}

deployMockBTC().catch(err => {
    log(`❌ Fatal Error: ${err.message}`);
    process.exit(1);
});
