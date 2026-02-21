const { RpcProvider, Account, json } = require('starknet');
const fs = require('fs');
const path = require('path');

// Better Sepolia RPC (multiple fallbacks)
const RPC_ENDPOINTS = [
    "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7", // Alchemy
    "https://free-rpc.nethermind.io/sepolia-juno/v0_7",  // Nethermind
    "https://starknet-sepolia.public.blastapi.io" // Blast
];

const ACCOUNT_ADDRESS = "0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b";
const PRIVATE_KEY = "0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48";

async function deployWithProvider(rpcUrl) {
    console.log(`\n🔄 Trying RPC: ${rpcUrl.slice(0, 40)}...`);

    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

    try {
        // Test connection first
        const chainId = await provider.getChainId();
        console.log(`✅ Connected! Chain ID: ${chainId}`);

        // Load contracts
        const contractsDir = path.join(__dirname, '../private_btc_core/target/dev');

        console.log(`📂 Loading contracts from: ${contractsDir}`);

        const mockBtcSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.contract_class.json'), 'utf8')
        );
        const mockBtcCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_MockBTC.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ MockBTC contracts loaded");

        // Declare MockBTC
        console.log("\n📋 Declaring MockBTC...");
        const mockDeclare = await account.declareIfNot({
            contract: mockBtcSierra,
            casm: mockBtcCasm
        });

        if (mockDeclare.transaction_hash) {
            console.log(`   TX: ${mockDeclare.transaction_hash}`);
            await provider.waitForTransaction(mockDeclare.transaction_hash);
        }
        const mockClassHash = mockDeclare.class_hash;
        console.log(`✅ MockBTC Class Hash: ${mockClassHash}`);

        // Deploy MockBTC
        console.log("\n🚢 Deploying MockBTC...");
        const { transaction_hash: mockDeployTx, contract_address: mockAddress } = await account.deployContract({
            classHash: mockClassHash,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });

        console.log(`   TX: ${mockDeployTx}`);
        console.log(`   Waiting for confirmation...`);
        await provider.waitForTransaction(mockDeployTx);
        console.log(`✅ MockBTC deployed: ${mockAddress}`);

        // Load Vault contracts
        const vaultSierra = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.contract_class.json'), 'utf8')
        );
        const vaultCasm = json.parse(
            fs.readFileSync(path.join(contractsDir, 'private_btc_core_PrivateBTCVault.compiled_contract_class.json'), 'utf8')
        );

        console.log("✅ Vault contracts loaded");

        // Declare Vault
        console.log("\n📋 Declaring PrivateBTCVault...");
        const vaultDeclare = await account.declareIfNot({
            contract: vaultSierra,
            casm: vaultCasm
        });

        if (vaultDeclare.transaction_hash) {
            console.log(`   TX: ${vaultDeclare.transaction_hash}`);
            await provider.waitForTransaction(vaultDeclare.transaction_hash);
        }
        const vaultClassHash = vaultDeclare.class_hash;
        console.log(`✅ Vault Class Hash: ${vaultClassHash}`);

        // Deploy Vault
        console.log("\n🚢 Deploying PrivateBTCVault...");
        const { transaction_hash: vaultDeployTx, contract_address: vaultAddress } = await account.deployContract({
            classHash: vaultClassHash,
            constructorCalldata: [mockAddress[0]]
        });

        console.log(`   TX: ${vaultDeployTx}`);
        console.log(`   Waiting for confirmation...`);
        await provider.waitForTransaction(vaultDeployTx);
        console.log(`✅ Vault deployed: ${vaultAddress}`);

        // Save deployment info
        const info = {
            network: "sepolia-testnet",
            rpcUrl: rpcUrl,
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: {
                    classHash: mockClassHash,
                    address: mockAddress[0] || mockAddress
                },
                PrivateBTCVault: {
                    classHash: vaultClassHash,
                    address: vaultAddress[0] || vaultAddress
                }
            },
            explorer: {
                mockBtc: `https://sepolia.voyager.online/contract/${mockAddress[0] || mockAddress}`,
                vault: `https://sepolia.voyager.online/contract/${vaultAddress[0] || vaultAddress}`
            }
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(info, null, 2));

        console.log("\n═══════════════════════════════════════════════");
        console.log("🎉 SEPOLIA DEPLOYMENT COMPLETE!");
        console.log("═══════════════════════════════════════════════");
        console.log(`\n📝 Contract Addresses:`);
        console.log(`   MockBTC:  ${info.contracts.MockBTC.address}`);
        console.log(`   Vault:    ${info.contracts.PrivateBTCVault.address}`);
        console.log(`\n🔍 Voyager Explorer:`);
        console.log(`   MockBTC: ${info.explorer.mockBtc}`);
        console.log(`   Vault:   ${info.explorer.vault}`);
        console.log(`\n✅ Saved to deployment-info.json\n`);

        return true;

    } catch (error) {
        console.error(`❌ Failed with this RPC:`, error.message);
        return false;
    }
}

async function main() {
    console.log("🚀 DEPLOYING TO SEPOLIA TESTNET");
    console.log("   (Trying multiple RPC endpoints for reliability)\n");

    for (const rpc of RPC_ENDPOINTS) {
        const success = await deployWithProvider(rpc);
        if (success) {
            process.exit(0);
        }
    }

    console.error("\n❌ ALL RPC ENDPOINTS FAILED");
    console.error("\n💡 Solutions:");
    console.error("   1. Get free Alchemy API key: https://www.alchemy.com/");
    console.error("   2. Check your internet connection");
    console.error("   3. Try again later (public RPCs may be rate-limited)");
    process.exit(1);
}

main();
