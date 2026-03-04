#!/usr/bin/env node
'use strict';
/**
 * deploy_spv.js — Deploy HeaderStore + SPV Vault contracts to Starknet Sepolia.
 *
 * Run from backend directory:
 *   cd backend && node deploy_spv.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { RpcProvider, Account, json, stark, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.resolve(__dirname, '../contracts/target/dev');
const RPC_URL = process.env.STARKNET_RPC_URL;
const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const MOCKBTC_ADDRESS = process.env.MOCKBTC_CONTRACT_ADDRESS;

if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY || !MOCKBTC_ADDRESS) {
    const missing = [
        !RPC_URL && 'STARKNET_RPC_URL',
        !ACCOUNT_ADDRESS && 'STARKNET_ACCOUNT_ADDRESS',
        !PRIVATE_KEY && 'SEPOLIA_PRIVATE_KEY',
        !MOCKBTC_ADDRESS && 'MOCKBTC_CONTRACT_ADDRESS',
    ].filter(Boolean);
    console.error('Missing env vars:', missing.join(', '));
    process.exit(1);
}

console.log('RPC URL :', RPC_URL.slice(0, 60) + '...');
console.log('Account :', ACCOUNT_ADDRESS);
console.log('MockBTC :', MOCKBTC_ADDRESS);
console.log('Artifacts:', CONTRACTS_DIR);
console.log('');

// starknet.js v9: Account takes an object { provider, address, signer }
const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account({
    provider: { nodeUrl: RPC_URL },
    address: ACCOUNT_ADDRESS,
    signer: PRIVATE_KEY,
});

function loadArtifact(contractName) {
    const sierra = path.join(CONTRACTS_DIR, `private_btc_core_${contractName}.contract_class.json`);
    const casm = path.join(CONTRACTS_DIR, `private_btc_core_${contractName}.compiled_contract_class.json`);
    if (!fs.existsSync(sierra)) {
        throw new Error(
            `Sierra not found: ${sierra}\n` +
            `Run scarb build first:\n` +
            `  wsl -d Ubuntu -e bash -c "export PATH='/home/sl/.asdf/installs/scarb/2.12.2/bin:/usr/bin:/bin' && cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts && scarb build"`
        );
    }
    return {
        sierra: json.parse(fs.readFileSync(sierra, 'utf8')),
        casm: json.parse(fs.readFileSync(casm, 'utf8')),
    };
}

async function declareDeploy(contractName, constructorCalldata) {
    console.log(`\n📦 ${contractName}`);
    const { sierra, casm } = loadArtifact(contractName);

    let classHash;
    try {
        console.log('  Declaring...');
        const decl = await account.declare({ contract: sierra, casm });
        console.log('  Declare tx:', decl.transaction_hash);
        await provider.waitForTransaction(decl.transaction_hash);
        classHash = decl.class_hash;
        console.log('  Class hash:', classHash);
    } catch (e) {
        const msg = String(e.message || e);
        if (/already.declared|ClassAlreadyDeclared|DuplicateTx/i.test(msg)) {
            classHash = hash.computeContractClassHash(sierra);
            console.log('  Already declared. class_hash:', classHash);
        } else {
            throw new Error(`Declare failed for ${contractName}: ${msg.slice(0, 400)}`);
        }
    }

    console.log('  Deploying...');
    const deploy = await account.deployContract({
        classHash,
        constructorCalldata,
        salt: stark.randomAddress(),
    });
    console.log('  Deploy tx:', deploy.transaction_hash);
    await provider.waitForTransaction(deploy.transaction_hash);
    const addr = deploy.contract_address;
    console.log(`  Address: ${addr}`);
    console.log(`  Voyager: https://sepolia.voyager.online/contract/${addr}`);
    return addr;
}

async function main() {
    if (fs.existsSync(CONTRACTS_DIR)) {
        const artifacts = fs.readdirSync(CONTRACTS_DIR)
            .filter(f => f.endsWith('.contract_class.json'))
            .map(f => f.replace('.contract_class.json', '').replace('private_btc_core_', ''));
        console.log('Available contracts:', artifacts.join(', '));
    }

    // 1. HeaderStore(relayer: ContractAddress)
    const headerStoreAddr = await declareDeploy('HeaderStore', [ACCOUNT_ADDRESS]);

    // 2. PrivateBTCVault(btc_token, header_store, pkh_w0..w4)
    const pkhW0 = process.env.VAULT_PKH_W0 || '0x473a7ca8';
    const pkhW1 = process.env.VAULT_PKH_W1 || '0x41d83c51';
    const pkhW2 = process.env.VAULT_PKH_W2 || '0x3373c839';
    const pkhW3 = process.env.VAULT_PKH_W3 || '0x6c52d42f';
    const pkhW4 = process.env.VAULT_PKH_W4 || '0x6ed1d48b';

    const vaultAddr = await declareDeploy('PrivateBTCVault', [
        MOCKBTC_ADDRESS,
        headerStoreAddr,
        pkhW0, pkhW1, pkhW2, pkhW3, pkhW4,
    ]);

    console.log('\n\nDEPLOYMENT COMPLETE');
    console.log('===================');
    console.log('Add these to backend/.env:\n');
    console.log(`HEADER_STORE_CONTRACT_ADDRESS=${headerStoreAddr}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddr}`);
    console.log(`VAULT_ADDR=${vaultAddr}`);
    console.log('\nAnd frontend/.env.local:');
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddr}`);
}

main().catch(err => {
    console.error('\nDeployment failed:', err.message || err);
    process.exit(1);
});
