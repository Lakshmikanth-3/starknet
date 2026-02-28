/**
 * deploy_new_vault.js
 * Declares and deploys only the new PrivateBTCVault contract,
 * reusing the existing MockBTC at the current address.
 */
require('dotenv').config();
const { RpcProvider, Account, CallData, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.STARKNET_RPC_URL;
const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;
const EXISTING_MOCKBTC = process.env.SBTC_ADDRESS; // Keep using existing MockBTC

const ARTIFACTS_DIR = path.join(__dirname, '../../contracts/target/dev');

async function main() {
    console.log('🚀 Deploying new PrivateBTCVault (balance_of-based) to Sepolia');
    console.log('   MockBTC (existing):', EXISTING_MOCKBTC);
    console.log('');

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, '1');

    // Load compiled artifacts
    const sierraPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.contract_class.json');
    const casmPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    if (!fs.existsSync(sierraPath)) throw new Error('Sierra file not found: ' + sierraPath);
    if (!fs.existsSync(casmPath)) throw new Error('Casm file not found: ' + casmPath);

    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf8'));

    // Compute expected class hash
    const classHash = hash.computeContractClassHash(sierra);
    console.log('📝 Vault Class Hash:', classHash);

    // Check if already declared
    let alreadyDeclared = false;
    try {
        await provider.getClassByHash(classHash);
        alreadyDeclared = true;
        console.log('✅ Already declared on Sepolia');
    } catch {
        console.log('📤 Not declared yet. Declaring...');
    }

    if (!alreadyDeclared) {
        const { transaction_hash: declTx } = await account.declare({ contract: sierra, casm }, { version: 3 });
        console.log('   Declare TX:', declTx);
        console.log('   Waiting for confirmation...');
        await provider.waitForTransaction(declTx, { retryInterval: 2000, successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'] });
        console.log('✅ Declared!');
    }

    // Deploy new vault with existing MockBTC address as constructor arg
    console.log('\n🚢 Deploying new vault...');
    const { transaction_hash: deployTx, contract_address: vaultAddress } = await account.deployContract(
        {
            classHash,
            constructorCalldata: CallData.compile({ btc_token: EXISTING_MOCKBTC }),
        },
        { version: 3 }
    );
    console.log('   Deploy TX:', deployTx);
    console.log('   Waiting for confirmation...');
    await provider.waitForTransaction(deployTx, { retryInterval: 2000, successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'] });

    console.log('\n✅ New vault deployed at:', vaultAddress);
    console.log('🔍 Voyager:', `https://sepolia.voyager.online/contract/${vaultAddress}`);

    console.log('\n════════════════════════════════════════');
    console.log('⚙️  Update your .env with:');
    console.log(`VAULT_ADDR=${vaultAddress}`);
    console.log(`VAULT_ADDRESS=${vaultAddress}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
    console.log('════════════════════════════════════════');
    console.log('\n⚙️  Update frontend .env.local with:');
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
    console.log('════════════════════════════════════════');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
