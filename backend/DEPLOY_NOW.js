const { RpcProvider, Account, json } = require('starknet');
const fs = require('fs');
const path = require('path');

// Alchemy Sepolia
const SEPOLIA_RPC = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA (Alchemy - v0_7)\n");

    const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

    console.log("✅ Connected");
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    try {
        // Load contract files
        const contractsDir = path.join(__dirname, '../private_btc_core/target/dev');

        const mockBtcSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
        );
        const mockBtcCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ MockBTC loaded\n");

        // DECLARE MockBTC
        console.log("📋 Declaring MockBTC...");
        const mockDeclareResponse = await account.declare({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });

        console.log(`   TX: ${mockDeclareResponse.transaction_hash}`);
        await provider.waitForTransaction(mockDeclareResponse.transaction_hash);
        const mockClassHash = mockDeclareResponse.class_hash;
        console.log(`✅ Class Hash: ${mockClassHash}\n`);

        // DEPLOY MockBTC
        console.log("🚢 Deploying MockBTC...");
        const mockDeployResponse = await account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });

        console.log(`   TX: ${mockDeployResponse.transaction_hash}`);
        await provider.waitForTransaction(mockDeployResponse.transaction_hash);
        const mockAddress = mockDeployResponse.contract_address;
        console.log(`✅ Address: ${mockAddress}\n`);

        // Load Vault
        const vaultSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
        );
        const vaultCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Vault loaded\n");

        // DECLARE Vault
        console.log("📋 Declaring Vault...");
        const vaultDeclareResponse = await account.declare({
            contract: vaultSierra,
            casm: vaultCasm
        });

        console.log(`   TX: ${vaultDeclareResponse.transaction_hash}`);
        await provider.waitForTransaction(vaultDeclareResponse.transaction_hash);
        const vaultClassHash = vaultDeclareResponse.class_hash;
        console.log(`✅ Class Hash: ${vaultClassHash}\n`);

        // DEPLOY Vault
        console.log("🚢 Deploying Vault...");
        const vaultDeployResponse = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockAddress]
        });

        console.log(`   TX: ${vaultDeployResponse.transaction_hash}`);
        await provider.waitForTransaction(vaultDeployResponse.transaction_hash);
        const vaultAddress = vaultDeployResponse.contract_address;
        console.log(`✅ Address: ${vaultAddress}\n`);

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
        console.log(`\n✅ deployment-info.json\n`);

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        if (error.response) {
            console.error("Response:", JSON.stringify(error.response, null, 2));
        }
        process.exit(1);
    }
}

main();
