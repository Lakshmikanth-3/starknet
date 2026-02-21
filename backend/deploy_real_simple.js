const { RpcProvider, Account, hash, CallData } = require('starknet');
const fs = require('fs');

const RPC_URL = "http://127.0.0.1:5060";
const ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
const PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";

// Already declared
const MOCK_BTC_CLASS_HASH = "0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b";
const VAULT_CLASS_HASH = "0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2";

async function deployContract(account, classHash, constructorCalldata) {
    const deployPayload = {
        classHash: classHash,
        constructorCalldata: constructorCalldata,
        salt: "0x" + Math.floor(Math.random() * 1000000000000).toString(16)
    };

    console.log("📋 Deploying with payload:", deployPayload);

    const deployResponse = await account.deployContract(deployPayload);
    console.log("⏳ Transaction hash:", deployResponse.transaction_hash);

    await account.waitForTransaction(deployResponse.transaction_hash);
    console.log("✅ Transaction confirmed!");

    return deployResponse.contract_address[0];
}

async function main() {
    console.log("🚀 REAL DEPLOYMENT (Simplified Approach)\n");

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

    console.log("✅ Connected to devnet");
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    try {
        console.log("---------------------------------------------------");
        console.log("👉 Step 1: Deploying MockBTC\n");

        // Constructor: recipient (feltaddress)
        const mockBtcAddress = await deployContract(
            account,
            MOCK_BTC_CLASS_HASH,
            [ACCOUNT_ADDRESS] // recipient
        );

        console.log(`✅ MockBTC deployed: ${mockBtcAddress}\n`);

        console.log("---------------------------------------------------");
        console.log("👉 Step 2: Deploying PrivateBTCVault\n");

        const vaultAddress = await deployContract(
            account,
            VAULT_CLASS_HASH,
            [mockBtcAddress] // btc_token
        );

        console.log(`✅ Vault deployed: ${vaultAddress}\n`);

        console.log("---------------------------------------------------");
        console.log("💾 Saving deployment info...\n");

        const deploymentInfo = {
            network: "devnet-local",
            deployedAt: new Date().toISOString(),
            contracts: {
                MockBTC: {
                    classHash: MOCK_BTC_CLASS_HASH,
                    address: mockBtcAddress
                },
                PrivateBTCVault: {
                    classHash: VAULT_CLASS_HASH,
                    address: vaultAddress
                }
            }
        };

        fs.writeFileSync(
            'deployment-info.json',
            JSON.stringify(deploymentInfo, null, 2)
        );

        console.log("🎉 REAL DEPLOYMENT COMPLETE!\n");
        console.log("📝 Addresses:");
        console.log(`   MockBTC: ${mockBtcAddress}`);
        console.log(`   Vault:   ${vaultAddress}`);

    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

main();
