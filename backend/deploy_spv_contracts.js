/**
 * deploy_spv_contracts.js
 *
 * Deploys:
 *   1. HeaderStore contract (accepts relayer address in constructor)
 *   2. PrivateBTCVault (SPV version) — new vault that gates minting on Bitcoin proof
 *
 * After deploying, update .env:
 *   HEADER_STORE_CONTRACT_ADDRESS=<address from step 1>
 *   VAULT_CONTRACT_ADDRESS=<address from step 2>   (replaces old vault)
 *
 * Run:
 *   cd backend && node deploy_spv_contracts.js
 */

require('dotenv').config({ path: '.env' });
const { RpcProvider, Account, json, CallData, stark, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.resolve(__dirname, '../contracts/target/dev');

const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
const account = new Account(
    provider,
    process.env.STARKNET_ACCOUNT_ADDRESS,
    process.env.SEPOLIA_PRIVATE_KEY,
    '1',  // Cairo 1 account
);

function loadContract(name) {
    // Scarb outputs files like: private_btc_core_<ContractName>.contract_class.json
    const sierraPath = path.join(CONTRACTS_DIR, `private_btc_core_${name}.contract_class.json`);
    const casmPath = path.join(CONTRACTS_DIR, `private_btc_core_${name}.compiled_contract_class.json`);
    if (!fs.existsSync(sierraPath)) throw new Error(`Sierra not found: ${sierraPath}`);
    if (!fs.existsSync(casmPath)) throw new Error(`CASM not found: ${casmPath}`);
    return {
        sierra: json.parse(fs.readFileSync(sierraPath, 'utf8')),
        casm: json.parse(fs.readFileSync(casmPath, 'utf8')),
    };
}

async function declareDeploy(name, constructorCalldata) {
    console.log(`\n📦 Declaring ${name}...`);
    const { sierra, casm } = loadContract(name);

    let classHash;
    try {
        const declareRes = await account.declare({ contract: sierra, casm });
        await provider.waitForTransaction(declareRes.transaction_hash);
        classHash = declareRes.class_hash;
        console.log(`  ✅ Declared. class_hash: ${classHash}`);
    } catch (e) {
        if (e.message?.includes('already declared') || e.message?.includes('ClassAlreadyDeclared')) {
            // Already declared — recompute class hash from sierra
            classHash = hash.computeContractClassHash(sierra);
            console.log(`  ℹ️  Already declared. class_hash: ${classHash}`);
        } else {
            throw e;
        }
    }

    console.log(`🚀 Deploying ${name}...`);
    const deployRes = await account.deployContract({
        classHash,
        constructorCalldata,
        salt: stark.randomAddress(),
    });
    await provider.waitForTransaction(deployRes.transaction_hash);
    const contractAddress = deployRes.contract_address;
    console.log(`  ✅ Deployed. address: ${contractAddress}`);
    console.log(`  🔍 Voyager: https://sepolia.voyager.online/contract/${contractAddress}`);
    return contractAddress;
}

async function main() {
    console.log('🔧 SPV Bridge Contract Deployment');
    console.log('==================================');
    console.log(`Account:  ${process.env.STARKNET_ACCOUNT_ADDRESS}`);
    console.log(`MockBTC:  ${process.env.MOCKBTC_CONTRACT_ADDRESS}`);

    // ── 1. Deploy HeaderStore ────────────────────────────────────────────────
    // constructor(relayer: ContractAddress)
    // The relayer is the backend's Starknet account (same as STARKNET_ACCOUNT_ADDRESS)
    const relayerAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

    const headerStoreAddress = await declareDeploy('HeaderStore', [relayerAddress]);

    // ── 2. Deploy SPV Vault ──────────────────────────────────────────────────
    // constructor(
    //   btc_token: ContractAddress,
    //   header_store: ContractAddress,
    //   vault_pkh_w0..w4: u32
    // )
    //
    // Vault P2WPKH pubkey hash words for tb1qgua8e2zpmq79zvmnequka5w53wse3ffuws00gs:
    // Verify with: node -e "const b=require('bitcoinjs-lib');const d=b.address.fromBech32('tb1qgua8e2zpmq79zvmnequka5w53wse3ffuws00gs');console.log(d.data.toString('hex'))"
    const pkhW0 = process.env.VAULT_PKH_W0 || '0x473a7ca8';
    const pkhW1 = process.env.VAULT_PKH_W1 || '0x41d83c51';
    const pkhW2 = process.env.VAULT_PKH_W2 || '0x3373c839';
    const pkhW3 = process.env.VAULT_PKH_W3 || '0x6c52d42f';
    const pkhW4 = process.env.VAULT_PKH_W4 || '0x6ed1d48b';

    const vaultAddress = await declareDeploy('PrivateBTCVault', [
        process.env.MOCKBTC_CONTRACT_ADDRESS,
        headerStoreAddress,
        pkhW0, pkhW1, pkhW2, pkhW3, pkhW4,
    ]);

    // ── 3. Print .env update instructions ───────────────────────────────────
    console.log('\n\n✅ DEPLOYMENT COMPLETE');
    console.log('======================');
    console.log('Add these lines to backend/.env:\n');
    console.log(`HEADER_STORE_CONTRACT_ADDRESS=${headerStoreAddress}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
    console.log(`VAULT_ADDR=${vaultAddress}`);
    console.log('\nℹ️  Also update frontend .env.local:');
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
    console.log('\n⚠️  IMPORTANT: The new Vault requires the MockBTC contract\'s mint()');
    console.log('   function to allow the vault address to call it.');
    console.log('   If MockBTC has access control on mint(), grant the new vault address.');
}

main().catch(err => {
    console.error('\n❌ Deployment failed:', err.message);
    process.exit(1);
});
