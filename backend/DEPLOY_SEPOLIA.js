const { RpcProvider, Account, json } = require('starknet');
const fs = require('fs');
const path = require('path');

// Sepolia Configuration with Alchemy
const SEPOLIA_RPC = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ";
const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA TESTNET\n");

    const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

    console.log("✅ Connected to Sepolia");
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   RPC: ${SEPOLIA_RPC}\n`);

    try {
        // Load compiled contracts
        const contractsDir = path.join(__dirname, '../private_btc_core/target/dev');

        const mockBtcSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
        );
        const mockBtcCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
        );

        const vaultSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
        );
        const vaultCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Contracts loaded\n");

        // Declare MockBTC
        console.log("📋 Declaring MockBTC...");
        const mockDeclare = await account.declare({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });

        console.log(`   TX: ${mockDeclare.transaction_hash}`);
        await provider.waitForTransaction(mockDeclare.transaction_hash);
        const mockClassHash = mockDeclare.class_hash;
        console.log(`✅ MockBTC Class Hash: ${mockClassHash}\n`);

        // Deploy MockBTC
        console.log("🚢 Deploying MockBTC...");
        const mockDeploy = await account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS] // recipient
        });

        console.log(`   TX: ${mockDeploy.transaction_hash}`);
        await provider.waitForTransaction(mockDeploy.transaction_hash);
        const mockAddress = mockDeploy.contract_address;
        console.log(`✅ MockBTC Address: ${mockAddress}\n`);

        // Declare Vault
        console.log("📋 Declaring PrivateBTCVault...");
        const vaultDeclare = await account.declare({
            contract: vaultSierra,
            casm: vaultCasm
        });

        console.log(`   TX: ${vaultDeclare.transaction_hash}`);
        await provider.waitForTransaction(vaultDeclare.transaction_hash);
        const vaultClassHash = vaultDeclare.class_hash;
        console.log(`✅ Vault Class Hash: ${vaultClassHash}\n`);

        // Deploy Vault
        console.log("🚢 Deploying PrivateBTCVault...");
        const vaultDeploy = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockAddress] // btc_token
        });

        console.log(`   TX: ${vaultDeploy.transaction_hash}`);
        await provider.waitForTransaction(vaultDeploy.transaction_hash);
        const vaultAddress = vaultDeploy.contract_address;
        console.log(`✅ Vault Address: ${vaultAddress}\n`);

        // Save deployment info
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
        console.log("🎉 SEPOLIA DEPLOYMENT COMPLETE!");
        console.log("═══════════════════════════════════════════════");
        console.log(`\n📝 Contract Addresses:`);
        console.log(`   MockBTC:  ${mockAddress}`);
        console.log(`   Vault:    ${vaultAddress}`);
        console.log(`\n🔍 Voyager Explorer:`);
        console.log(`   ${info.explorer.mockBtc}`);
        console.log(`   ${info.explorer.vault}`);
        console.log(`\n✅ Saved to deployment-info.json`);

    } catch (error) {
        console.error("\n❌ DEPLOYMENT FAILED:");
        console.error(error.message);
        if (error.response) {
            console.error("Response:", error.response);
        }
        process.exit(1);
    }
}

main();
