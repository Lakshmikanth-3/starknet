/**
 * Deploy PrivateBTC Contracts to Starknet Sepolia
 * Uses pre-built Cairo artifacts from contracts/target/dev/
 */

const { Account, RpcProvider, json, CallData } = require('starknet');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function deployAll() {
    console.log('🚀 Deploying PrivateBTC Contracts to Starknet Sepolia\n');
    console.log('='.repeat(70), '\n');
    
    // Setup account
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const account = new Account({
        provider: { nodeUrl: process.env.STARKNET_RPC_URL },
        address: process.env.STARKNET_ACCOUNT_ADDRESS,
        signer: process.env.SEPOLIA_PRIVATE_KEY
    });
    
    console.log('📋 Configuration:');
    console.log('  Account:', account.address);
    const nonce = await account.getNonce();
    console.log('  Nonce:', nonce);
    console.log('  RPC:', process.env.STARKNET_RPC_URL, '\n');
    
    console.log('='.repeat(70), '\n');
    
    // Load artifacts
    console.log('📦 Loading contract artifacts...\n');
    const artifactsPath = path.join(__dirname, '../contracts/target/dev');
    
    const mockBtcSierra = json.parse(
        fs.readFileSync(path.join(artifactsPath, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
    );
    const mockBtcCasm = json.parse(
        fs.readFileSync(path.join(artifactsPath, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
    );
    console.log('  ✓ MockBTC artifacts loaded');
    
    const vaultSierra = json.parse(
        fs.readFileSync(path.join(artifactsPath, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
    );
    const vaultCasm = json.parse(
        fs.readFileSync(path.join(artifactsPath, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
    );
    console.log('  ✓ Vault artifacts loaded\n');
    
    console.log('='.repeat(70), '\n');
    
    // STEP 1: Declare MockBTC
    console.log('📤 STEP 1: Declaring MockBTC contract...');
    let mockBtcClassHash;
    try {
        const mockBtcDeclare = await account.declareIfNot({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });
        
        mockBtcClassHash = mockBtcDeclare.class_hash;
        
        if (mockBtcDeclare.transaction_hash) {
            console.log('  Waiting for declaration tx:', mockBtcDeclare.transaction_hash);
            await provider.waitForTransaction(mockBtcDeclare.transaction_hash);
            console.log('  ✓ Declaration confirmed');
        } else {
            console.log('  ℹ️  Class already declared');
        }
        console.log('  MockBTC ClassHash:', mockBtcClassHash, '\n');
    } catch (error) {
        console.error('  ❌ Declaration failed:', error.message);
        throw error;
    }
    
    // STEP 2: Deploy MockBTC
    console.log('🚀 STEP 2: Deploying MockBTC contract...');
    let mockBtcAddress;
    try {
        const constructorCalldata = CallData.compile({
            recipient: account.address  // Initial mint recipient
        });
        
        const mockBtcDeploy = await account.deployContract({
            classHash: mockBtcClassHash,
            constructorCalldata
        });
        
        mockBtcAddress = mockBtcDeploy.contract_address;
        console.log('  Deployment tx:', mockBtcDeploy.transaction_hash);
        console.log('  Waiting for confirmation...');
        
        await provider.waitForTransaction(mockBtcDeploy.transaction_hash);
        
        console.log('  ✓ MockBTC deployed!');
        console.log('  Address:', mockBtcAddress);
        console.log('  Voyager:', `https://sepolia.voyager.online/contract/${mockBtcAddress}\n`);
    } catch (error) {
        console.error('  ❌ Deployment failed:', error.message);
        throw error;
    }
    
    console.log('='.repeat(70), '\n');
    
    // STEP 3: Declare Vault
    console.log('📤 STEP 3: Declaring Vault contract...');
    let vaultClassHash;
    try {
        const vaultDeclare = await account.declareIfNot({
            contract: vaultSierra,
            casm: vaultCasm
        });
        
        vaultClassHash = vaultDeclare.class_hash;
        
        if (vaultDeclare.transaction_hash) {
            console.log('  Waiting for declaration tx:', vaultDeclare.transaction_hash);
            await provider.waitForTransaction(vaultDeclare.transaction_hash);
            console.log('  ✓ Declaration confirmed');
        } else {
            console.log('  ℹ️  Class already declared');
        }
        console.log('  Vault ClassHash:', vaultClassHash, '\n');
    } catch (error) {
        console.error('  ❌ Declaration failed:', error.message);
        throw error;
    }
    
    // STEP 4: Deploy Vault
    console.log('🚀 STEP 4: Deploying Vault contract...');
    let vaultAddress;
    try {
        const constructorCalldata = CallData.compile({
            btc_token: mockBtcAddress  // MockBTC token address
        });
        
        const vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata
        });
        
        vaultAddress = vaultDeploy.contract_address;
        console.log('  Deployment tx:', vaultDeploy.transaction_hash);
        console.log('  Waiting for confirmation...');
        
        await provider.waitForTransaction(vaultDeploy.transaction_hash);
        
        console.log('  ✓ Vault deployed!');
        console.log('  Address:', vaultAddress);
        console.log('  Voyager:', `https://sepolia.voyager.online/contract/${vaultAddress}\n`);
    } catch (error) {
        console.error('  ❌ Deployment failed:', error.message);
        throw error;
    }
    
    console.log('='.repeat(70));
    console.log('✅ DEPLOYMENT COMPLETE!');
    console.log('='.repeat(70), '\n');
    
    console.log('📝 Update your backend/.env with these values:\n');
    console.log(`MOCKBTC_CONTRACT_ADDRESS=${mockBtcAddress}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
    console.log(`SBTC_ADDRESS=${mockBtcAddress}`);
    
    console.log('\n🔗 Verify on Voyager:');
    console.log(`  MockBTC: https://sepolia.voyager.online/contract/${mockBtcAddress}`);
    console.log(`  Vault:   https://sepolia.voyager.online/contract/${vaultAddress}`);
    
    console.log('\n🧪 Next Steps:');
    console.log('  1. Update .env file');
    console.log('  2. Restart backend: npm run dev');
    console.log('  3. Test deposit: node test_deposit_fixed.js');
    console.log('  4. Test full flow via frontend');
}

deployAll().catch(error => {
    console.error('\n❌ Deployment script failed:', error);
    process.exit(1);
});
