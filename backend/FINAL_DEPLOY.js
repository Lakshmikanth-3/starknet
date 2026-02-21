const { RpcProvider, Account, hash } = require('starknet');
const fs = require('fs');

const RPC_URL = "http://127.0.0.1:5060";
const ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
const PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";

const MOCK_CLASS_HASH = "0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b";
const VAULT_CLASS_HASH = "0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2";

async function main() {
    console.log("🚀 REAL DEPLOYMENT - Final Attempt\n");

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

    console.log("✅ Connected");
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    try {
        // Deploy MockBTC
        console.log("👉 Deploying MockBTC...");
        const mockResult = await account.deployContract({
            classHash: MOCK_CLASS_HASH,
            constructorCalldata: [ACCOUNT_ADDRESS]
        });

        console.log("   TX: ", mockResult.transaction_hash);
        await provider.waitForTransaction(mockResult.transaction_hash);
        const mockAddress = mockResult.contract_address;
        console.log(`✅ MockBTC: ${mockAddress}\n`);

        // Deploy Vault
        console.log("👉 Deploying Vault...");
        const vaultResult = await account.deployContract({
            classHash: VAULT_CLASS_HASH,
            constructorCalldata: [mockAddress]
        });

        console.log("   TX: ", vaultResult.transaction_hash);
        await provider.waitForTransaction(vaultResult.transaction_hash);
        const vaultAddress = vaultResult.contract_address;
        console.log(`✅ Vault: ${vaultAddress}\n`);

        // Save
        const info = {
            network: "devnet-local",
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: { classHash: MOCK_CLASS_HASH, address: mockAddress },
                PrivateBTCVault: { classHash: VAULT_CLASS_HASH, address: vaultAddress }
            }
        };

        fs.writeFileSync('deployment-info.json', JSON.stringify(info, null, 2));

        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log(`   MockBTC: ${mockAddress}`);
        console.log(`   Vault:   ${vaultAddress}`);
        console.log("\n✅ Saved to deployment-info.json");

    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
    }
}

main();
