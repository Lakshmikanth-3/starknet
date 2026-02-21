import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

async function deployWithClassHash() {
    console.log('🚀 Simplified Sepolia Deployment');
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   RPC: ${RPC_URL}\n`);

    // Check if contracts are already declared by trying to get the class
    const mockBtcSierra = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json'), 'utf-8')
    );
    const mockBtcCasm = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.compiled_contract_class.json'), 'utf-8')
    );

    const vaultSierra = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.contract_class.json'), 'utf-8')
    );
    const vaultCasm = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf-8')
    );

    // Compute class hashes
    const mockBtcClassHash = hash.computeContractClassHash(mockBtcSierra);
    const vaultClassHash = hash.computeContractClassHash(vaultSierra);

    console.log(`📝 Computed Class Hashes:`);
    console.log(`   MockBTC: ${mockBtcClassHash}`);
    console.log(`   Vault: ${vaultClassHash}\n`);

    // Try to declare MockBTC
    try {
        console.log('🔍 Checking if MockBTC is already declared...');
        try {
            await provider.getClassByHash(mockBtcClassHash);
            console.log('   ✅ MockBTC already declared!');
        } catch {
            console.log('   📤 Declaring MockBTC...');
            try {
                // Try default (likely V2/ETH)
                const declareResult = await account.declareIfNot({ contract: mockBtcSierra, casm: mockBtcCasm });
                console.log(`   ✅ MockBTC declared: ${declareResult.class_hash}`);
            } catch (err: any) {
                console.log(`   ⚠️ V2 Declaration failed, trying V3 (STRK)... Error: ${err.message}`);
                // Try V3 (STRK)
                const declareResult = await account.declare({ contract: mockBtcSierra, casm: mockBtcCasm }, { version: 3 });
                console.log(`   ✅ MockBTC declared (V3): ${declareResult.transaction_hash}`);
                await provider.waitForTransaction(declareResult.transaction_hash);
            }
        }
    } catch (err: any) {
        console.error(`   ❌ Failed to declare MockBTC:`, err.message);
        throw err;
    }

    // Try to declare Vault
    try {
        console.log('🔍 Checking if PrivateBTCVault is already declared...');
        try {
            await provider.getClassByHash(vaultClassHash);
            console.log('   ✅ PrivateBTCVault already declared!');
        } catch {
            console.log('   📤 Declaring PrivateBTCVault...');
            try {
                const declareResult = await account.declareIfNot({ contract: vaultSierra, casm: vaultCasm });
                console.log(`   ✅ PrivateBTCVault declared: ${declareResult.class_hash}`);
            } catch (err: any) {
                console.log(`   ⚠️ V2 Declaration failed, trying V3 (STRK)...`);
                const declareResult = await account.declare({ contract: vaultSierra, casm: vaultCasm }, { version: 3 });
                console.log(`   ✅ PrivateBTCVault declared (V3): ${declareResult.transaction_hash}`);
                await provider.waitForTransaction(declareResult.transaction_hash);
            }
        }
    } catch (err: any) {
        console.error(`   ❌ Failed to declare PrivateBTCVault:`, err.message);
        // throw err; // Don't throw, maybe MockBTC worked
    }

    // Deploy MockBTC
    console.log('\n🚀 Deploying MockBTC...');
    const mockBtcConstructor = CallData.compile({ owner: ACCOUNT_ADDRESS });
    let mockBtcDeploy;
    try {
        mockBtcDeploy = await account.deployContract({
            classHash: mockBtcClassHash,
            constructorCalldata: mockBtcConstructor
        });
    } catch (err: any) {
        console.log(`   ⚠️ V2 Deployment failed, trying V3 (STRK)... Error: ${err.message}`);
        mockBtcDeploy = await account.deployContract({
            classHash: mockBtcClassHash,
            constructorCalldata: mockBtcConstructor
        }, { version: 3 });
    }

    await provider.waitForTransaction(mockBtcDeploy.transaction_hash);
    console.log(`   ✅ MockBTC deployed at: ${mockBtcDeploy.contract_address}`);

    // Deploy Vault
    console.log('\n🚀 Deploying PrivateBTCVault...');
    const vaultConstructor = CallData.compile({ btc_token: mockBtcDeploy.contract_address });
    let vaultDeploy;
    try {
        vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: vaultConstructor
        });
    } catch (err: any) {
        console.log(`   ⚠️ V2 Deployment failed, trying V3 (STRK)... Error: ${err.message}`);
        vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: vaultConstructor
        }, { version: 3 });
    }

    await provider.waitForTransaction(vaultDeploy.transaction_hash);
    console.log(`   ✅ PrivateBTCVault deployed at: ${vaultDeploy.contract_address}`);

    console.log('\n✅ Deployment Complete!');
    console.log(`\nUpdate your .env with:`);
    console.log(`MOCK_BTC_ADDR=${mockBtcDeploy.contract_address}`);
    console.log(`VAULT_ADDR=${vaultDeploy.contract_address}`);
    console.log(`\nVoyager Links:`);
    console.log(`MockBTC: https://sepolia.voyager.online/contract/${mockBtcDeploy.contract_address}`);
    console.log(`Vault: https://sepolia.voyager.online/contract/${vaultDeploy.contract_address}`);
}

deployWithClassHash().catch(err => {
    console.error('❌ Deployment failed:', err.message);
    process.exit(1);
});
