const { RpcProvider, Account, json, constants } = require('starknet');
const fs = require('fs');
const path = require('path');

const SEPOLIA_RPC = "https://rpc.starknet-testnet.lava.build";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

const MAX_RETRIES = 5;

async function retry(fn, name) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await fn();
        } catch (e) {
            console.log(`⚠️  ${name} failed (attempt ${i + 1}/${MAX_RETRIES}): ${e.message}`);
            if (i === MAX_RETRIES - 1) throw e;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA (Robust Force)\n");

    try {
        const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
        const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

        console.log("✅ Connected");

        // Load contracts
        const contractsDir = path.join(__dirname, '../contracts/target/dev');
        let verifyPath = contractsDir;
        if (!fs.existsSync(contractsDir)) {
            verifyPath = path.join(__dirname, '../private_btc_core/target/dev');
        }

        const mockBtcSierra = json.parse(fs.readFileSync(path.join(verifyPath, 'private_btc_core_MockBTC.contract_class.json'), 'utf8'));
        const mockBtcCasm = json.parse(fs.readFileSync(path.join(verifyPath, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8'));

        console.log("✅ Contracts loaded");

        // DECLARE MockBTC
        console.log("📋 Declaring MockBTC...");
        const mockDeclare = await retry(() => account.declareIfNot({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        }), "Declare MockBTC");

        if (mockDeclare.transaction_hash) {
            console.log(`   TX: ${mockDeclare.transaction_hash}`);
            await retry(() => provider.waitForTransaction(mockDeclare.transaction_hash), "Wait MockBTC Declare");
        }

        const mockClassHash = mockDeclare.class_hash;
        console.log(`✅ MockBTC Class Hash: ${mockClassHash}`);

        // DEPLOY MockBTC
        console.log("🚢 Deploying MockBTC...");
        const mockDeploy = await retry(() => account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        }), "Deploy MockBTC");

        console.log(`   TX: ${mockDeploy.transaction_hash}`);
        await retry(() => provider.waitForTransaction(mockDeploy.transaction_hash), "Wait MockBTC Deploy");
        console.log(`✅ MockBTC: ${mockDeploy.contract_address}`);

        // Load Vault
        const vaultSierra = json.parse(fs.readFileSync(path.join(verifyPath, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8'));
        const vaultCasm = json.parse(fs.readFileSync(path.join(verifyPath, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8'));

        // DECLARE Vault
        console.log("📋 Declaring Vault...");
        const vaultDeclare = await retry(() => account.declareIfNot({
            contract: vaultSierra,
            casm: vaultCasm
        }), "Declare Vault");

        if (vaultDeclare.transaction_hash) {
            console.log(`   TX: ${vaultDeclare.transaction_hash}`);
            await retry(() => provider.waitForTransaction(vaultDeclare.transaction_hash), "Wait Vault Declare");
        }

        const vaultClassHash = vaultDeclare.class_hash;
        console.log(`✅ Vault Class Hash: ${vaultClassHash}`);

        // DEPLOY Vault
        console.log("🚢 Deploying Vault...");
        const vaultDeploy = await retry(() => account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockDeploy.contract_address]
        }), "Deploy Vault");

        console.log(`   TX: ${vaultDeploy.transaction_hash}`);
        await retry(() => provider.waitForTransaction(vaultDeploy.transaction_hash), "Wait Vault Deploy");
        console.log(`✅ Vault: ${vaultDeploy.contract_address}`);

        // Save info
        const info = {
            network: "sepolia-testnet",
            rpcUrl: SEPOLIA_RPC,
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: { classHash: mockClassHash, address: mockDeploy.contract_address },
                PrivateBTCVault: { classHash: vaultClassHash, address: vaultDeploy.contract_address }
            },
            explorer: {
                mockBtc: `https://sepolia.voyager.online/contract/${mockDeploy.contract_address}`,
                vault: `https://sepolia.voyager.online/contract/${vaultDeploy.contract_address}`
            }
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(info, null, 2));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log(`MockBTC: ${mockDeploy.contract_address}`);
        console.log(`Vault: ${vaultDeploy.contract_address}`);

    } catch (error) {
        console.error("❌ FATAL ERROR:", error.message);
        process.exit(1);
    }
}

main();
