import { RpcProvider, Account, hash, CallData, cairo } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// ══════════════════════════════════════════════════════════════════════════════
// Starknet Sepolia V3-Compatible Deployment Script
// ══════════════════════════════════════════════════════════════════════════════

const RPC_URL = process.env.STARKNET_RPC_URL || process.env.SEPOLIA_RPC_URL || '';
const ACCOUNT_ADDRESS = process.env.STARKNET_ACCOUNT_ADDRESS || '0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '';

if (!PRIVATE_KEY) {
    console.error('❌ SEPOLIA_PRIVATE_KEY is not set in .env');
    process.exit(1);
}

if (!RPC_URL) {
    console.error('❌ STARKNET_RPC_URL is not set in .env');
    process.exit(1);
}

console.log('🚀 PrivateBTC Vault — Starknet Sepolia Deployment');
console.log('═══════════════════════════════════════════════════\n');
console.log(`   RPC URL: ${RPC_URL.substring(0, 50)}...`);
console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, '1');

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Load contract artifacts
// ──────────────────────────────────────────────────────────────────────────────
function loadContract(name: string) {
    const base = path.join(__dirname, '../../contracts/target/dev');
    const sierraPath = path.join(base, `private_btc_core_${name}.contract_class.json`);
    const casmPath = path.join(base, `private_btc_core_${name}.compiled_contract_class.json`);

    if (!fs.existsSync(sierraPath)) {
        throw new Error(`❌ Sierra file not found: ${sierraPath}\n   Run: cd contracts && scarb build`);
    }
    if (!fs.existsSync(casmPath)) {
        throw new Error(`❌ Casm file not found: ${casmPath}\n   Run: cd contracts && scarb build`);
    }

    console.log(`   📄 Loading ${name}...`);
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf-8'));
    return { sierra, casm };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Declare contract if not already declared
// ──────────────────────────────────────────────────────────────────────────────
async function declareIfNotExists(name: string, sierra: any, casm: any, compiledClassHashOverride?: string): Promise<string> {
    try {
        const classHash = hash.computeContractClassHash(sierra);
        console.log(`\n🔍 ${name} — Class Hash: ${classHash}`);

        // Check if already declared
        try {
            await provider.getClassByHash(classHash);
            console.log(`   ✅ Already declared on Sepolia\n`);
            return classHash;
        } catch {
            console.log(`   📤 Not declared yet. Declaring now...`);
        }

        // Attempt declaration with V3 transaction (STRK fee)
        console.log(`   ⏳ Declaring ${name} (V3 transaction)...`);
        
        const declarePayload: any = {
            contract: sierra,
        };

        // Use override if provided (workaround for CASM hash mismatch)
        if (compiledClassHashOverride) {
            console.log(`   🔧 Using compiled class hash override: ${compiledClassHashOverride}`);
            declarePayload.compiledClassHash = compiledClassHashOverride;
        } else {
            declarePayload.casm = casm;
        }

        // Use V3 (STRK) by default on Sepolia v0.14.0+
        const { transaction_hash, class_hash } = await account.declare(declarePayload, { version: 3 });
        
        console.log(`   🚀 Declaration TX: ${transaction_hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        
        await provider.waitForTransaction(transaction_hash, {
            retryInterval: 2000,
            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1']
        });
        
        console.log(`   ✅ ${name} declared successfully!`);
        console.log(`   🔗 https://sepolia.voyager.online/tx/${transaction_hash}\n`);
        
        return class_hash;
    } catch (error: any) {
        console.error(`   ❌ Failed to declare ${name}:`);
        console.error(`   ${error.message || error}`);
        if (error.response) {
            console.error('   Response:', JSON.stringify(error.response, null, 2));
        }
        throw error;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Deploy contract
// ──────────────────────────────────────────────────────────────────────────────
async function deployContract(name: string, classHash: string, constructorArgs: any[]): Promise<string> {
    try {
        console.log(`\n🚀 Deploying ${name}...`);
        console.log(`   Class Hash: ${classHash}`);
        console.log(`   Constructor Args: ${JSON.stringify(constructorArgs)}`);

        const deployPayload = {
            classHash: classHash,
            constructorCalldata: CallData.compile(constructorArgs),
        };

        // Deploy with V3 transaction
        const { transaction_hash, contract_address } = await account.deployContract(deployPayload, { version: 3 });
        
        console.log(`   🚀 Deploy TX: ${transaction_hash}`);
        console.log(`   ⏳ Waiting for confirmation...`);
        
        await provider.waitForTransaction(transaction_hash, {
            retryInterval: 2000,
            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1']
        });
        
        console.log(`   ✅ ${name} deployed at: ${contract_address}`);
        console.log(`   🔗 https://sepolia.voyager.online/contract/${contract_address}\n`);
        
        return contract_address;
    } catch (error: any) {
        console.error(`   ❌ Failed to deploy ${name}:`);
        console.error(`   ${error.message || error}`);
        if (error.response) {
            console.error('   Response:', JSON.stringify(error.response, null, 2));
        }
        throw error;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main deployment flow
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
    try {
        // Step 1: Check account balance
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Pre-flight Checks');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        try {
            const nonce = await account.getNonce();
            console.log(`   ✅ Account accessible (nonce: ${nonce})`);
        } catch (error) {
            console.error('   ❌ Failed to access account. Check PRIVATE_KEY and ACCOUNT_ADDRESS');
            throw error;
        }

        // Step 2: Load contract artifacts
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 Loading Contract Artifacts');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        const mockBtc = loadContract('MockBTC');
        const vault = loadContract('PrivateBTCVault');

        // Step 3: Declare MockBTC
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Declaring Contracts');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Compiled class hash override (workaround for CASM version mismatch)
        // This hash is expected by Starknet Sepolia for the current contract version
        const MOCKBTC_COMPILED_HASH = "0x7412e8c54b27cc9ca94d760eba5c6bdda82051dc9124ccfdcbb4b709c97bd0";
        
        const mockBtcClassHash = await declareIfNotExists('MockBTC', mockBtc.sierra, mockBtc.casm, MOCKBTC_COMPILED_HASH);

        // Step 4: Declare PrivateBTCVault (no override needed)
        const vaultClassHash = await declareIfNotExists('PrivateBTCVault', vault.sierra, vault.casm);

        // Step 5: Deploy MockBTC
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚢 Deploying Contracts');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const mockBtcAddress = await deployContract('MockBTC', mockBtcClassHash, [ACCOUNT_ADDRESS]);

        // Step 6: Deploy PrivateBTCVault
        const vaultAddress = await deployContract('PrivateBTCVault', vaultClassHash, [mockBtcAddress]);

        // Step 7: Save deployment info
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💾 Saving Deployment Info');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const deploymentInfo = {
            network: 'starknet-sepolia',
            deployedAt: new Date().toISOString(),
            deployer: ACCOUNT_ADDRESS,
            rpcUrl: RPC_URL,
            contracts: {
                MockBTC: {
                    classHash: mockBtcClassHash,
                    address: mockBtcAddress,
                },
                PrivateBTCVault: {
                    classHash: vaultClassHash,
                    address: vaultAddress,
                },
            },
        };

        const outputPath = path.join(__dirname, '../deployment-info.json');
        fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`   ✅ Saved to: ${outputPath}\n`);

        // Step 8: Display summary
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║          🎉 DEPLOYMENT SUCCESSFUL 🎉             ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        
        console.log('📋 Contract Addresses:\n');
        console.log(`   MockBTC (sBTC):      ${mockBtcAddress}`);
        console.log(`   PrivateBTCVault:     ${vaultAddress}\n`);
        
        console.log('🔗 Voyager Links:\n');
        console.log(`   MockBTC:             https://sepolia.voyager.online/contract/${mockBtcAddress}`);
        console.log(`   Vault:               https://sepolia.voyager.online/contract/${vaultAddress}\n`);
        
        console.log('⚙️  Update your .env files:\n');
        console.log('   Backend (.env):');
        console.log(`   VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
        console.log(`   MOCKBTC_CONTRACT_ADDRESS=${mockBtcAddress}`);
        console.log(`   VAULT_ADDRESS=${vaultAddress}`);
        console.log(`   SBTC_ADDRESS=${mockBtcAddress}\n`);
        console.log('   Frontend (.env.local):');
        console.log(`   NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
        console.log(`   NEXT_PUBLIC_MOCK_BTC_ADDRESS=${mockBtcAddress}\n`);

    } catch (error: any) {
        console.error('\n╔══════════════════════════════════════════════════╗');
        console.error('║          ❌ DEPLOYMENT FAILED ❌                 ║');
        console.error('╚══════════════════════════════════════════════════╝\n');
        console.error('Error:', error.message || error);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
