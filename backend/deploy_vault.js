/**
 * Deploy vault + MockBTC from compiled artifacts.
 * Uses Alchemy v0.7.1 endpoint which is more permissive with fee versions.
 * Run: node deploy_vault.js
 */
require('dotenv').config();
const { Account, RpcProvider } = require('starknet');
const fs = require('fs');

const DEPLOY_RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ';

async function main() {
    const provider = new RpcProvider({ nodeUrl: DEPLOY_RPC_URL });
    const account = new Account(provider, process.env.STARKNET_ACCOUNT_ADDRESS, process.env.SEPOLIA_PRIVATE_KEY, '1');

    console.log('Account:', account.address);
    console.log('Using RPC:', DEPLOY_RPC_URL);
    const nonce = await account.getNonce('latest');
    console.log('Nonce:', nonce);

    const mockBtcSierra = JSON.parse(fs.readFileSync('../contracts/target/dev/private_btc_core_MockBTC.contract_class.json', 'utf8'));
    const mockBtcCasm = JSON.parse(fs.readFileSync('../contracts/target/dev/private_btc_core_MockBTC.compiled_contract_class.json', 'utf8'));
    const vaultSierra = JSON.parse(fs.readFileSync('../contracts/target/dev/private_btc_core_PrivateBTCVault.contract_class.json', 'utf8'));
    const vaultCasm = JSON.parse(fs.readFileSync('../contracts/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json', 'utf8'));

    console.log('\n=== Declaring & Deploying MockBTC ===');
    const mockResult = await account.declareAndDeploy({
        contract: mockBtcSierra,
        casm: mockBtcCasm,
        constructorCalldata: [process.env.STARKNET_ACCOUNT_ADDRESS],
    });
    const mockBtcClassHash = mockResult.declare.class_hash;
    const mockBtcAddr = mockResult.deploy.contract_address;
    console.log('MockBTC ClassHash:', mockBtcClassHash);
    console.log('MockBTC Address:', mockBtcAddr);
    console.log('MockBTC TX:', mockResult.deploy.transaction_hash);

    console.log('\nWaiting 40s for MockBTC to settle...');
    await new Promise(r => setTimeout(r, 40000));

    console.log('\n=== Declaring & Deploying Vault ===');
    const vaultResult = await account.declareAndDeploy({
        contract: vaultSierra,
        casm: vaultCasm,
        constructorCalldata: [mockBtcAddr],
    });
    const vaultClassHash = vaultResult.declare.class_hash;
    const vaultAddr = vaultResult.deploy.contract_address;
    console.log('Vault ClassHash:', vaultClassHash);
    console.log('Vault Address:', vaultAddr);
    console.log('Vault TX:', vaultResult.deploy.transaction_hash);

    console.log('\n===== COPY INTO YOUR .env =====');
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddr}`);
    console.log(`VAULT_ADDR=${vaultAddr}`);
    console.log(`VAULT_ADDRESS=${vaultAddr}`);
    console.log(`MOCKBTC_CONTRACT_ADDRESS=${mockBtcAddr}`);
    console.log(`MOCK_BTC_ADDR=${mockBtcAddr}`);
    console.log(`SBTC_ADDRESS=${mockBtcAddr}`);
    console.log('===============================');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
