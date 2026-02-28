import { RpcProvider, Account, CallData, hash } from 'starknet';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/env';

const ARTIFACTS_DIR = path.resolve(__dirname, '../../contracts/target/dev');

async function main() {
    const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
    const account = new Account(provider, config.STARKNET_ACCOUNT_ADDRESS, config.SEPOLIA_PRIVATE_KEY);
    // Did NOT pass '1' to account creation, letting starknet.js use defaults.

    const sierraPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.contract_class.json');
    const casmPath = path.join(ARTIFACTS_DIR, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json');

    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf8'));

    let classHash = hash.computeContractClassHash(sierra);

    try {
        await provider.getClassByHash(classHash);
        console.log('✅ Already declared');
    } catch {
        console.log('📤 Declaring...');
        const dRes = await account.declare({ contract: sierra, casm });
        console.log('Declare TX:', dRes.transaction_hash);
        await provider.waitForTransaction(dRes.transaction_hash, { retryInterval: 3000, successStates: ['ACCEPTED_ON_L2'] as any });
    }

    console.log('\n🚢 Deploying new vault...');
    const deployResult = await account.deployContract({
        classHash,
        constructorCalldata: CallData.compile({ btc_token: config.MOCKBTC_CONTRACT_ADDRESS }),
    });
    console.log('Deploy TX:', deployResult.transaction_hash);
    await provider.waitForTransaction(deployResult.transaction_hash, { retryInterval: 3000, successStates: ['ACCEPTED_ON_L2'] as any });

    console.log('\n✅ New vault deployed at:', deployResult.contract_address);
}

main().catch(console.error);
