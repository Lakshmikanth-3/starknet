/**
 * deploy_spv_contracts.mjs
 * ES Module deploy script using starknet.js directly.
 *
 * Run from backend folder:
 *   node deploy_spv_contracts.mjs
 */

import 'dotenv/config';
import { RpcProvider, Account, json, stark, hash } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, '../contracts/target/dev');

const RPC_URL = process.env.STARKNET_RPC_URL;
const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const MOCKBTC_ADDRESS = process.env.MOCKBTC_CONTRACT_ADDRESS;

if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY) {
    console.error('Missing env vars: STARKNET_RPC_URL, STARKNET_ACCOUNT_ADDRESS, SEPOLIA_PRIVATE_KEY');
    process.exit(1);
}

console.log('RPC_URL:', RPC_URL);
console.log('ACCOUNT:', ACCOUNT_ADDRESS);

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, '1');

function loadContract(name) {
    const sierraPath = path.join(CONTRACTS_DIR, `private_btc_core_${name}.contract_class.json`);
    const casmPath = path.join(CONTRACTS_DIR, `private_btc_core_${name}.compiled_contract_class.json`);
    if (!fs.existsSync(sierraPath)) throw new Error(`Sierra not found: ${sierraPath}\nDid you run 'scarb build'?`);
    if (!fs.existsSync(casmPath)) throw new Error(`CASM not found: ${casmPath}`);
    return {
        sierra: json.parse(fs.readFileSync(sierraPath, 'utf8')),
        casm: json.parse(fs.readFileSync(casmPath, 'utf8')),
    };
}

async function declareDeploy(name, constructorCalldata) {
    console.log(`\n📦 Declaring & deploying ${name}...`);
    const { sierra, casm } = loadContract(name);

    let classHash;
    try {
        const declareRes = await account.declare({ contract: sierra, casm });
        console.log(`  Declaring... tx: ${declareRes.transaction_hash}`);
        await provider.waitForTransaction(declareRes.transaction_hash);
        classHash = declareRes.class_hash;
        console.log(`  ✅ Declared. class_hash: ${classHash}`);
    } catch (e) {
        const msg = e.message || '';
        if (msg.includes('already declared') || msg.includes('ClassAlreadyDeclared') || msg.includes('DuplicateTx')) {
            classHash = hash.computeContractClassHash(sierra);
            console.log(`  ℹ️  Already declared. class_hash: ${classHash}`);
        } else {
            throw e;
        }
    }

    const deployRes = await account.deployContract({
        classHash,
        constructorCalldata,
        salt: stark.randomAddress(),
    });
    console.log(`  Deploying... tx: ${deployRes.transaction_hash}`);
    await provider.waitForTransaction(deployRes.transaction_hash);
    const contractAddress = deployRes.contract_address;
    console.log(`  ✅ Deployed: ${contractAddress}`);
    console.log(`  🔍 https://sepolia.voyager.online/contract/${contractAddress}`);
    return contractAddress;
}

async function main() {
    console.log('\n🔧 SPV Bridge Contract Deployment');
    console.log('==================================');

    // List available compiled artifacts to debug if needed
    if (fs.existsSync(CONTRACTS_DIR)) {
        const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith('.contract_class.json'));
        console.log('Found artifacts:', files.map(f => f.replace('.contract_class.json', '')).join(', '));
    } else {
        console.error(`Contracts target dir not found: ${CONTRACTS_DIR}`);
        console.error("Run: wsl -d Ubuntu -e bash -c \"export PATH='/home/sl/.asdf/installs/scarb/2.12.2/bin:/usr/bin:/bin' && cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts && scarb build\"");
        process.exit(1);
    }

    // 1. Deploy HeaderStore(relayer: ContractAddress)
    const headerStoreAddress = await declareDeploy('HeaderStore', [ACCOUNT_ADDRESS]);

    // 2. Deploy PrivateBTCVault(btc_token, header_store, pkh_w0..w4)
    const pkhW0 = process.env.VAULT_PKH_W0 || '0x473a7ca8';
    const pkhW1 = process.env.VAULT_PKH_W1 || '0x41d83c51';
    const pkhW2 = process.env.VAULT_PKH_W2 || '0x3373c839';
    const pkhW3 = process.env.VAULT_PKH_W3 || '0x6c52d42f';
    const pkhW4 = process.env.VAULT_PKH_W4 || '0x6ed1d48b';

    const vaultAddress = await declareDeploy('PrivateBTCVault', [
        MOCKBTC_ADDRESS,
        headerStoreAddress,
        pkhW0, pkhW1, pkhW2, pkhW3, pkhW4,
    ]);

    console.log('\n\n✅ ALL DONE. Add these to backend/.env:');
    console.log('');
    console.log(`HEADER_STORE_CONTRACT_ADDRESS=${headerStoreAddress}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
    console.log(`VAULT_ADDR=${vaultAddress}`);
    console.log('');
    console.log('And frontend/.env.local:');
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
}

main().catch(err => {
    console.error('\n❌ Deploy failed:', err.message || err);
    process.exit(1);
});
