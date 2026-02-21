const { RpcProvider, Account, json, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

const SEPOLIA_RPC = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA\n");

    const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

    console.log("✅ Connected");
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    try {
        // Load contracts
        const contractsDir = path.join(__dirname, '../private_btc_core/target/dev');

        const mockBtcSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
        );
        const mockBtcCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Contracts loaded\n");

        // Wait a bit to avoid nonce issues
        await sleep(2000);

        // DECLARE MockBTC
        console.log("📋 Declaring MockBTC...");
        console.log("   (This may take 30-60 seconds)\n");

        const mockDeclare = await account.declare({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });

        console.log(`   TX Hash: ${mockDeclare.transaction_hash}`);
        console.log("   Waiting for confirmation...");

        await provider.waitForTransaction(mockDeclare.transaction_hash);
        const mockClassHash = mockDeclare.class_hash;
        console.log(`✅ MockBTC declared: ${mockClassHash}\n`);

        // Wait before next transaction
        await sleep(3000);

        // DEPLOY MockBTC
        console.log("🚢 Deploying MockBTC...");
        console.log("   (This may take 30-60 seconds)\n");

        const mockDeploy = await account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });

        console.log(`   TX Hash: ${mockDeploy.transaction_hash}`);
        console.log("   Waiting for confirmation...");

        await provider.waitForTransaction(mockDeploy.transaction_hash);
        const mockAddress = mockDeploy.contract_address;
        console.log(`✅ MockBTC deployed: ${mockAddress}\n`);

        // Load Vault
        const vaultSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
        );
        const vaultCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Vault contracts loaded\n");

        // Wait before next transaction
        await sleep(3000);

        // DECLARE Vault
        console.log("📋 Declaring Vault...");
        console.log("   (This may take 30-60 seconds)\n");

        const vaultDeclare = await account.declare({
            contract: vaultSierra,
            casm: vaultCasm
        });

        console.log(`   TX Hash: ${vaultDeclare.transaction_hash}`);
        console.log("   Waiting for confirmation...");

        await provider.waitForTransaction(vaultDeclare.transaction_hash);
        const vaultClassHash = vaultDeclare.class_hash;
        console.log(`✅ Vault declared: ${vaultClassHash}\n`);

        // Wait before final deployment
        await sleep(3000);

        // DEPLOY Vault
        console.log("🚢 Deploying Vault...");
        console.log("   (This may take 30-60 seconds)\n");

        const vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockAddress]
        });

        console.log(`   TX Hash: ${vaultDeploy.transaction_hash}`);
        console.log("   Waiting for confirmation...");

        await provider.waitForTransaction(vaultDeploy.transaction_hash);
        const vaultAddress = vaultDeploy.contract_address;
        console.log(`✅ Vault deployed: ${vaultAddress}\n`);

        // Save
        const info = {
            network: "sepolia-testnet",
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: {
                    classHash: mockClassHash,
                    address: mockAddress
                },
                PrivateBTCVault: {
                    classHash: vaultClassHash,
                    address: vaultAddress
                }
            },
            explorer: {
                mockBtc: `https://sepolia.voyager.online/contract/${mockAddress}`,
                vault: `https://sepolia.voyager.online/contract/${vaultAddress}`
            }
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(info, null, 2));

        console.log("═══════════════════════════════════════════════");
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("═══════════════════════════════════════════════");
        console.log(`\nMockBTC:  ${mockAddress}`);
        console.log(`Vault:    ${vaultAddress}`);
        console.log(`\nExplorer:`);
        console.log(info.explorer.mockBtc);
        console.log(info.explorer.vault);
        console.log(`\n✅ deployment-info.json saved\n`);

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        if (error.response) {
            console.error("Response:", JSON.stringify(error.response, null, 2));
        }
        process.exit(1);
    }
}

main();
