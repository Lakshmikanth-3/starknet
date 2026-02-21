import { RpcProvider, Account, hash, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = '0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48';

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

async function main() {
    console.log('🚀 DEPLOYMENT SCRIPT (ALCHEMY RPC, V3 DEFAULTS)');

    const contractsDir = path.join(__dirname, '../../contracts/target/dev');

    const mockSierra = JSON.parse(fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8'));
    const mockCasm = JSON.parse(fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8'));

    console.log('📦 Declaring MockBTC...');
    let mockClassHash;
    try {
        const dRes = await account.declare({
            contract: mockSierra,
            casm: mockCasm
        });
        console.log('   TX:', dRes.transaction_hash);
        await provider.waitForTransaction(dRes.transaction_hash);
        mockClassHash = dRes.class_hash;
    } catch (e: any) {
        if (e.message.includes('already declared') || e.message.includes('Class hash already declared')) {
            console.log('   Already declared!');
            mockClassHash = hash.computeContractClassHash(mockSierra);
        } else {
            console.log('Error declaring mock:', e);
            throw e;
        }
    }
    console.log('✅ MockBTC Class Hash:', mockClassHash);

    console.log('🚢 Deploying MockBTC...');
    const constructorCalldata = CallData.compile({ owner: ACCOUNT_ADDRESS });
    const mockDeployResponse = await account.deployContract({
        classHash: mockClassHash,
        constructorCalldata
    });
    console.log('   TX:', mockDeployResponse.transaction_hash);
    await provider.waitForTransaction(mockDeployResponse.transaction_hash);
    const MOCK_ADDR = mockDeployResponse.contract_address;
    console.log('✅ MockBTC Address:', MOCK_ADDR);


    const vaultSierra = JSON.parse(fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8'));
    const vaultCasm = JSON.parse(fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8'));

    console.log('📦 Declaring Vault...');
    let vaultClassHash;
    try {
        const dRes = await account.declare({
            contract: vaultSierra,
            casm: vaultCasm
        });
        console.log('   TX:', dRes.transaction_hash);
        await provider.waitForTransaction(dRes.transaction_hash);
        vaultClassHash = dRes.class_hash;
    } catch (e: any) {
        if (e.message.includes('already declared') || e.message.includes('Class hash already declared')) {
            console.log('   Already declared!');
            vaultClassHash = hash.computeContractClassHash(vaultSierra);
        } else {
            console.log('Error declaring vault:', e);
            throw e;
        }
    }
    console.log('✅ Vault Class Hash:', vaultClassHash);

    console.log('🚢 Deploying Vault...');
    const vaultCalldata = CallData.compile({ btc_token: MOCK_ADDR });
    const vaultDeployResponse = await account.deployContract({
        classHash: vaultClassHash,
        constructorCalldata: vaultCalldata
    });
    console.log('   TX:', vaultDeployResponse.transaction_hash);
    await provider.waitForTransaction(vaultDeployResponse.transaction_hash);
    const VAULT_ADDR = vaultDeployResponse.contract_address;
    console.log('✅ Vault Address:', VAULT_ADDR);

    fs.writeFileSync('NEW_DEPLOYMENT.json', JSON.stringify({
        mockBtc: MOCK_ADDR,
        vault: VAULT_ADDR
    }, null, 2));

    console.log('🎉 Done! Save these addresses to .env!');
}

main().catch(console.error);
