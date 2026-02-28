/**
 * deploy_new_vault.ts
 * Deploys only the new PrivateBTCVault (balance_of-based) to Sepolia.
 * Reuses existing MockBTC — only redeploys the vault.
 */
import { RpcProvider, Account, CallData, hash, Signer } from 'starknet';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';

const ARTIFACTS_DIR = path.resolve(__dirname, '../../contracts/target/dev');

async function main() {
    console.log('🚀 Deploying new PrivateBTCVault to Sepolia');
    console.log('   MockBTC (existing):', config.MOCKBTC_CONTRACT_ADDRESS);
    console.log('   Relayer:', config.STARKNET_ACCOUNT_ADDRESS);
    console.log('');

    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, config.SEPOLIA_PRIVATE_KEY);

    // Load compiled artifacts
    const sierraPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.contract_class.json');
    const casmPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    if (!fs.existsSync(sierraPath)) throw new Error('Sierra file not found: ' + sierraPath);
    if (!fs.existsSync(casmPath)) throw new Error('Casm file not found: ' + casmPath);

    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf8'));

    const classHash = hash.computeContractClassHash(sierra);
    console.log('📝 Vault Class Hash:', classHash);

    // Check if already declared
    let alreadyDeclared = false;
    try {
        await provider.getClassByHash(classHash);
        alreadyDeclared = true;
        console.log('   ✅ Already declared on Sepolia');
    } catch {
        console.log('   📤 Not declared yet. Declaring...');
    }

    if (!alreadyDeclared) {
        const declResult = await account.declare(
            { contract: sierra, casm },
            { version: 3 as any }
        );
        console.log('   Declare TX:', declResult.transaction_hash);
        console.log('   Waiting for confirmation...');
        await provider.waitForTransaction(declResult.transaction_hash, {
            retryInterval: 3000,
            successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'] as any,
        });
        console.log('   ✅ Declared!');
    }

    // Deploy new vault with existing MockBTC address as constructor arg
    console.log('\n🚢 Deploying new vault...');
    const deployResult = await account.deployContract(
        {
            classHash,
            constructorCalldata: CallData.compile({ btc_token: config.MOCKBTC_CONTRACT_ADDRESS }),
        },
        { version: 3 as any }
    );
    const vaultAddress = deployResult.contract_address;
    console.log('   Deploy TX:', deployResult.transaction_hash);
    console.log('   Waiting for confirmation...');
    await provider.waitForTransaction(deployResult.transaction_hash, {
        retryInterval: 3000,
        successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'] as any,
    });

    console.log('\n✅ New vault deployed at:', vaultAddress);
    console.log('🔍 Voyager:', `https://sepolia.voyager.online/contract/${vaultAddress}`);
    console.log('\n════════════════════════════════════════');
    console.log('⚙️  Copy these to backend/.env:');
    console.log(`VAULT_ADDR=${vaultAddress}`);
    console.log(`VAULT_ADDRESS=${vaultAddress}`);
    console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
    console.log('════════════════════════════════════════');
    console.log('⚙️  Copy to frontend/.env.local:');
    console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
    console.log('════════════════════════════════════════');
}

main().catch(e => {
    console.error('\n❌ Deploy error:', e.message);
    if (e.baseError) console.error('Base:', JSON.stringify(e.baseError, null, 2).slice(0, 500));
    process.exit(1);
});
