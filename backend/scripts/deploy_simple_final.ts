import { Contract, RpcProvider, Account, json, num } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });

const ACCOUNT_ADDRESS = '0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
const PRIVATE_KEY = '0x71d7bb07b9a64f6f78ac4c816aff4da9';

const account = new Account(PROVIDER, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function main() {
    console.log(`🔌 Simple Local Deployment`);

    const btcSierra = json.parse(fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json'), 'utf8'));
    const btcCasm = json.parse(fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8'));

    try {
        console.log('1. Declaring MockBTC...');
        // Force version 2 for local devnet as it might not support V3 (STRK) fees well
        const declareRes = await account.declare({ contract: btcSierra, casm: btcCasm }, { version: 2 });
        console.log(`✅ Declared: ${declareRes.class_hash}`);

        await new Promise(r => setTimeout(r, 2000));

        console.log('2. Deploying MockBTC...');
        const deployRes = await account.deployContract({
            classHash: declareRes.class_hash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        }, { version: 1 }); // Use V1 for local devnet
        console.log(`✅ Deployed: ${deployRes.contract_address}`);

        // We can stop here for verification
        console.log('\nDeployment succeeded partially, updating .env...');

        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/STARKNET_RPC_URL=.*/, `STARKNET_RPC_URL=${RPC_URL}`);
        envContent = envContent.replace(/MOCK_BTC_ADDR=.*/, `MOCK_BTC_ADDR=${deployRes.contract_address}`);
        fs.writeFileSync(envPath, envContent);

    } catch (e: any) {
        console.error('❌ Error during simple deploy:', e.message);
        if (e.data) console.dir(e.data, { depth: null });
    }
}

main();
