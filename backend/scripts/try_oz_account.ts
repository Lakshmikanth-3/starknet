import { RpcProvider, Account, ec, json, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = 'http://127.0.0.1:5050';
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });

// Standard OZ account pattern for devnet with seed 0
const OZ_ACCOUNT_ADDRESS = '0x0517efefd330a9a10c88e1dbd77d5305a51ab7e4a98883e12c8fa1a85f9e5871';
const OZ_PRIVATE_KEY = '0x00c1cf1490de1352865301bb8705143f3ef938f97fdf892f1090dcb5ac7bcd1d';

async function main() {
    console.log(`🔌 Connecting to ${RPC_URL}...`);

    // Try with OZ account
    try {
        const account = new Account(PROVIDER, OZ_ACCOUNT_ADDRESS, OZ_PRIVATE_KEY);
        const nonce = await PROVIDER.getNonceForAddress(OZ_ACCOUNT_ADDRESS, 'latest');
        console.log(`✅ OZ Account online: ${OZ_ACCOUNT_ADDRESS}`);
        console.log(`   Nonce: ${nonce}`);

        // Try declaring MockBTC
        const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
        const casmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');

        const contract = json.parse(fs.readFileSync(sierraPath).toString('utf-8'));
        const casm = json.parse(fs.readFileSync(casmPath).toString('utf-8'));

        console.log(`📝 Attempting to declare MockBTC...`);
        const declareResponse = await account.declare({ contract, casm });
        console.log(`✅ Declared! Class Hash: ${declareResponse.class_hash}`);

    } catch (error: any) {
        console.error('❌ OZ Account failed:', error.message);
        console.error('   Stack:', error.stack);
    }
}

main();
