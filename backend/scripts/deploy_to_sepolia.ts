import { RpcProvider, Account, json, hash } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Starknet Sepolia - Alchemy RPC v0_9
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ';
console.log(`DEBUG: Using RPC: ${RPC_URL}`);
// NOTE: node_modules/starknet/dist/index.js patches:
// 1. defaultOptions.blockIdentifier FIXED to LATEST
// 2. isV3Tx FIXED to default to V3 (mandatory for v0.14.0)

const PROVIDER = new RpcProvider({ nodeUrl: RPC_URL });

const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS || '0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

if (!PRIVATE_KEY) {
    throw new Error('SEPOLIA_PRIVATE_KEY not set in .env file');
}

const account = new Account(PROVIDER, ACCOUNT_ADDRESS, PRIVATE_KEY, '1');

async function declareIfNotExists(name: string, sierraPath: string, casmPath: string, compiledClassHashOverride?: string): Promise<string> {
    const contractSierra = json.parse(fs.readFileSync(sierraPath).toString('utf-8'));
    const contractCasm = json.parse(fs.readFileSync(casmPath).toString('utf-8'));
    const classHash = hash.computeContractClassHash(contractSierra);
    console.log(`   🔍 Computed Class Hash for ${name}: ${classHash}`);

    console.log(`📝 Checking if ${name} already declared (Hash: ${classHash})...`);
    try {
        await PROVIDER.getClassByHash(classHash);
        console.log(`   ✅ ${name} already declared.`);
        return classHash;
    } catch (e) {
        console.log(`   ❌ ${name} not declared. Declaring now...`);
        const declareOptions: any = { contract: contractSierra };
        if (compiledClassHashOverride) {
            declareOptions.compiledClassHash = compiledClassHashOverride;
        } else {
            declareOptions.casm = contractCasm;
        }
        const { transaction_hash, class_hash } = await account.declare(declareOptions);
        console.log(`   🚀 Declaration tx: ${transaction_hash}`);
        await PROVIDER.waitForTransaction(transaction_hash);
        console.log(`   ✅ ${name} declared: ${class_hash}`);
        return class_hash;
    }
}

async function deploy(name: string, classHash: string, constructorCalldata: any[]) {
    console.log(`🚀 Deploying ${name}...`);
    // Using default version (V3) and auto-estimation for fees
    const { transaction_hash, contract_address } = await account.deployContract(
        { classHash, constructorCalldata }
    );
    console.log(`   🚀 Deploy tx: ${transaction_hash}`);
    await PROVIDER.waitForTransaction(transaction_hash);
    console.log(`   ✅ ${name} deployed at: ${contract_address}`);
    return contract_address;
}

async function main() {
    console.log('--- STARTING DEPLOYMENT ---');

    const base = path.join(__dirname, '../../contracts/target/dev');
    const btcSierra = path.join(base, 'private_btc_core_MockBTC.contract_class.json');
    const btcCasm = path.join(base, 'private_btc_core_MockBTC.compiled_contract_class.json');
    const vSierra = path.join(base, 'private_btc_core_PrivateBTCVault.contract_class.json');
    const vCasm = path.join(base, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    // DEFINITIVE COMPILED HASHES FROM NETWORK ERROR MESSAGES
    const MOCKBTC_COMPILED_HASH = "0x7412e8c54b27cc9ca94d760eba5c6bdda82051dc9124ccfdcbb4b709c97bd0";

    const btcHash = await declareIfNotExists('MockBTC', btcSierra, btcCasm, MOCKBTC_COMPILED_HASH);
    const btcAddr = await deploy('MockBTC', btcHash, [ACCOUNT_ADDRESS]);

    const vaultHash = await declareIfNotExists('PrivateBTCVault', vSierra, vCasm);
    const vaultAddr = await deploy('PrivateBTCVault', vaultHash, [btcAddr, ACCOUNT_ADDRESS]);

    console.log('\n=== DEPLOYMENT SUMMARY ===');
    console.log(`MockBTC:         ${btcAddr}`);
    console.log(`PrivateBTCVault: ${vaultAddr}`);
    console.log('==========================');
    console.log('\nUpdate your .env with:');
    console.log(`MOCK_BTC_ADDR=${btcAddr}`);
    console.log(`VAULT_ADDR=${vaultAddr}`);
    console.log(`MOCKBTC_CONTRACT_ADDRESS=${btcAddr}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddr}`);
    console.log(`SBTC_ADDRESS=${btcAddr}`);
    console.log(`VAULT_ADDRESS=${vaultAddr}`);
}

main().catch(e => {
    console.error('❌ FATAL ERROR:', e.message || e);
    // Print more detail if available
    if (e.data) console.error('Error Data:', JSON.stringify(e.data, null, 2));
    process.exit(1);
});
