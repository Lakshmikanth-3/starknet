const { RpcProvider, Account, json, constants } = require('starknet');
const fs = require('fs');
const path = require('path');

const SEPOLIA_RPC = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA (Fixed Version)\n");

    try {
        const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
        const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1"); // Explicit cairo version

        console.log("✅ Connected");
        console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

        // Load contracts
        const contractsDir = path.join(__dirname, '../private_btc_core/target/dev');

        const mockBtcSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
        );
        const mockBtcCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Contracts loaded\n");

        // DECLARE with explicit version
        console.log("📋 Declaring MockBTC (this takes 30-60 seconds)...\n");

        const mockDeclare = await account.declareIfNot({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });

        if (mockDeclare.transaction_hash) {
            console.log(`   TX Hash: ${mockDeclare.transaction_hash}`);
            await provider.waitForTransaction(mockDeclare.transaction_hash);
        } else {
            console.log("   Already declared!");
        }

        const mockClassHash = mockDeclare.class_hash;
        console.log(`✅ MockBTC Class Hash: ${mockClassHash}\n`);

        // DEPLOY
        console.log("🚢 Deploying MockBTC (this takes 30-60 seconds)...\n");

        const mockDeploy = await account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });

        console.log(`   TX Hash: ${mockDeploy.transaction_hash}`);
        await provider.waitForTransaction(mockDeploy.transaction_hash);
        console.log(`✅ MockBTC deployed: ${mockDeploy.contract_address}\n`);

        // Load Vault
        const vaultSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
        );
        const vaultCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
        );

        console.log("📋 Declaring Vault (this takes 30-60 seconds)...\n");

        const vaultDeclare = await account.declareIfNot({
            contract: vaultSierra,
            casm: vaultCasm
        });

        if (vaultDeclare.transaction_hash) {
            console.log(`   TX Hash: ${vaultDeclare.transaction_hash}`);
            await provider.waitForTransaction(vaultDeclare.transaction_hash);
        } else {
            console.log("   Already declared!");
        }

        const vaultClassHash = vaultDeclare.class_hash;
        console.log(`✅ Vault Class Hash: ${vaultClassHash}\n`);

        // DEPLOY Vault
        console.log("🚢 Deploying Vault (this takes 30-60 seconds)...\n");

        const vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockDeploy.contract_address]
        });

        console.log(`   TX Hash: ${vaultDeploy.transaction_hash}`);
        await provider.waitForTransaction(vaultDeploy.transaction_hash);
        console.log(`✅ Vault deployed: ${vaultDeploy.contract_address}\n`);

        // Save
        const info = {
            network: "sepolia-testnet",
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: {
                    classHash: mockClassHash,
                    address: mockDeploy.contract_address
                },
                PrivateBTCVault: {
                    classHash: vaultClassHash,
                    address: vaultDeploy.contract_address
                }
            },
            explorer: {
                mockBtc: `https://sepolia.voyager.online/contract/${mockDeploy.contract_address}`,
                vault: `https://sepolia.voyager.online/contract/${vaultDeploy.contract_address}`
            }
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(info, null, 2));

        console.log("═══════════════════════════════════════════════");
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("═══════════════════════════════════════════════");
        console.log(`\nMockBTC:  ${mockDeploy.contract_address}`);
        console.log(`Vault:    ${vaultDeploy.contract_address}`);
        console.log(`\nExplorer:`);
        console.log(info.explorer.mockBtc);
        console.log(info.explorer.vault);
        console.log(`\n✅ Saved to deployment-info.json\n`);

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        if (error.stack) {
            console.error("\nFull error:");
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
