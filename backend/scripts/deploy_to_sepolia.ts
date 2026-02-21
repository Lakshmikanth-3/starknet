import { Contract, RpcProvider, Account, json, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Sepolia testnet configuration
const RPC_URL = process.env.SEPOLIA_RPC_URL;
console.log(`DEBUG: Loaded RPC_URL: ${RPC_URL}`);
const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });

// Use the Sepolia account from keystore
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
console.log(`DEBUG: Using Account: ${ACCOUNT_ADDRESS}`);
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';  // User needs to set this

if (!PRIVATE_KEY) {
    throw new Error('SEPOLIA_PRIVATE_KEY not set in .env file');
}

const account = new Account(PROVIDER, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function getNonce() {
    return await PROVIDER.getNonceForAddress(ACCOUNT_ADDRESS, 'latest');
}

async function declareIfNotExists(name: string, sierraPath: string, casmPath: string): Promise<string> {
    const contract = json.parse(fs.readFileSync(sierraPath).toString('utf-8'));
    const casm = json.parse(fs.readFileSync(casmPath).toString('utf-8'));

    const casmClassHash = contract.abi ? '0x' + contract.abi : casm.compiled_class_hash || casm.class_hash;

    // In starknet.js, we can also use compute.computeContractClassHash to be sure
    // But for now let's just try to declare and log the full error if it fails

    try {
        console.log(`📝 Checking if ${name} already declared...`);
        // We need the compiled class hash for v2/v3 contracts
        // This is just a check, if it's not found it throws
        //await PROVIDER.getClassByHash(casmClassHash);
        //console.log(`   ✅ ${name} already declared (Class Hash: ${casmClassHash})`);
        //return casmClassHash;
        throw new Error("Force declare for now");
    } catch {
        console.log(`   ${name} declaration attempt...`);
        const nonce = await getNonce();
        try {
            console.log(`   Estimating and declaring ${name}...`);
            // Set version to 3 to force Declare V3 (required for STRK fees)
            const res = await account.declare({ contract, casm }, { version: 3 });
            console.log(`   Tx: ${res.transaction_hash}`);
            await PROVIDER.waitForTransaction(res.transaction_hash);
            console.log(`✅ ${name} Declared.`);
            return res.class_hash;
        } catch (err: any) {
            console.error(`❌ Declare failed for ${name}:`);
            console.error(JSON.stringify(err, null, 2));
            throw err;
        }
    }
}

async function deploy(name: string, classHash: string, constructorCalldata: any[]) {
    console.log(`🚀 Deploying ${name}...`);
    const nonce = await getNonce();

    try {
        const { transaction_hash, contract_address } = await account.deployContract({
            classHash,
            constructorCalldata
        }, { nonce, maxFee: 10n ** 17n });

        console.log(`   Tx: ${transaction_hash}`);
        await PROVIDER.waitForTransaction(transaction_hash);
        console.log(`✅ ${name} Deployed at: ${contract_address}`);

        return contract_address;
    } catch (err: any) {
        console.error(`❌ Deploy failed for ${name}:`, err.message);
        throw err;
    }
}

async function main() {
    console.log(`🚀 Deploying contracts to Sepolia testnet`);
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    // Verify connectivity and account
    try {
        console.log('📡 Testing RPC connectivity...');
        const chainId = await PROVIDER.getChainId();
        console.log(`✅ Connected to chain: ${chainId}`);

        console.log('🔑 Verifying account access...');
        const nonce = await PROVIDER.getNonceForAddress(ACCOUNT_ADDRESS, 'latest');
        console.log(`✅ Account nonce: ${nonce}\n`);
    } catch (error: any) {
        console.error('❌ Connectivity/Account verification failed:');
        console.error('   Error:', error.message);
        console.error('   This could mean:');
        console.error('   - RPC URL is incorrect or unreachable');
        console.error('   - Account address doesn\'t exist on Sepolia');
        console.error('   - Private key is incorrect');
        throw error;
    }


    const btcSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
    const btcCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json');

    const vaultSierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.contract_class.json');
    const vaultCasmPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    // 1. Declare and deploy MockBTC
    const btcClassHash = await declareIfNotExists('MockBTC', btcSierraPath, btcCasmPath);
    const mockBtcAddr = await deploy('MockBTC', btcClassHash, [ACCOUNT_ADDRESS]);

    // 2. Declare and deploy PrivateBTCVault
    const vaultClassHash = await declareIfNotExists('PrivateBTCVault', vaultSierraPath, vaultCasmPath);
    const vaultAddr = await deploy('PrivateBTCVault', vaultClassHash, [mockBtcAddr]);

    console.log(`\n✅ Deployment complete!`);
    console.log(`   MockBTC: ${mockBtcAddr}`);
    console.log(`   PrivateBTCVault: ${vaultAddr}`);
    console.log(`\nUpdate your .env with:`);
    console.log(`MOCK_BTC_ADDR=${mockBtcAddr}`);
    console.log(`VAULT_ADDR=${vaultAddr}`);
}

main().catch((error) => {
    console.error('❌ Deployment failed:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Full Error:', error);
    process.exit(1);
});
