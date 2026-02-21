const { RpcProvider, Account, Contract, CallData, cairo } = require('starknet');
const fs = require('fs');

const RPC_URL = "http://127.0.0.1:5060";

// Devnet pre-funded account
const ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
const PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";

// Already declared class hashes
const MOCK_BTC_CLASS_HASH = "0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b";
const VAULT_CLASS_HASH = "0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2";

// Universal Deployer Contract
const UDC_ADDRESS = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";

async function main() {
    console.log("🚀 REAL DEPLOYMENT STARTING...\n");

    // Initialize provider and account
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);

    console.log("✅ Connected to devnet");
    console.log(`   Account: ${ACCOUNT_ADDRESS}\n`);

    // UDC ABI (simplified - just the deployContract function)
    const UDC_ABI = [
        {
            name: "deployContract",
            type: "function",
            inputs: [
                { name: "classHash", type: "felt" },
                { name: "salt", type: "felt" },
                { name: "unique", type: "felt" },
                { name: "calldata", type: "felt*" }
            ],
            outputs: [{ name: "contract_address", type: "felt" }]
        }
    ];

    const udc = new Contract(UDC_ABI, UDC_ADDRESS, provider);
    udc.connect(account);

    console.log("---------------------------------------------------");
    console.log("👉 Step 1: Deploying MockBTC\n");

    // Deploy MockBTC with constructor arg: recipient = account address
    const mockBtcCalldata = CallData.compile({
        recipient: ACCOUNT_ADDRESS
    });

    console.log("📋 Calling UDC.deployContract for MockBTC...");

    try {
        const deployMockTx = await udc.deployContract(
            MOCK_BTC_CLASS_HASH,
            cairo.uint256(Date.now()), // random salt
            0, // unique = false
            mockBtcCalldata
        );

        console.log("⏳ Waiting for transaction...");
        const mockReceipt = await provider.waitForTransaction(deployMockTx.transaction_hash);

        // Parse contract address from events
        const mockBtcAddress = mockReceipt.events[0].data[0];

        console.log(`✅ MockBTC deployed at: ${mockBtcAddress}\n`);

        console.log("---------------------------------------------------");
        console.log("👉 Step 2: Deploying PrivateBTCVault\n");

        // Deploy Vault with constructor arg: btc_token = mockBtcAddress
        const vaultCalldata = CallData.compile({
            btc_token: mockBtcAddress
        });

        console.log("📋 Calling UDC.deployContract for Vault...");

        const deployVaultTx = await udc.deployContract(
            VAULT_CLASS_HASH,
            cairo.uint256(Date.now() + 1), // different salt
            0, // unique = false
            vaultCalldata
        );

        console.log("⏳ Waiting for transaction...");
        const vaultReceipt = await provider.waitForTransaction(deployVaultTx.transaction_hash);

        const vaultAddress = vaultReceipt.events[0].data[0];

        console.log(`✅ PrivateBTCVault deployed at: ${vaultAddress}\n`);

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

        console.log("🎉 DEPLOYMENT COMPLETE!\n");
        console.log("📝 Contract Addresses:");
        console.log(`   MockBTC: ${mockBtcAddress}`);
        console.log(`   Vault:   ${vaultAddress}\n`);
        console.log("✅ Saved to deployment-info.json");

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

main();
