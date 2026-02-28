const fetch = require('node-fetch');

async function testRpc() {
    const url = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ';
    const request = {
        jsonrpc: "2.0",
        method: "starknet_estimateFee",
        params: {
            request: [
                {
                    type: "DECLARE",
                    sender_address: "0x54078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1",
                    version: "0x100000000000000000000000000000003", // Query V3
                    signature: [],
                    nonce: "0x0",
                    contract_class: {
                        // Minimal valid-ish class or just empty
                        sierra_program: ["0x1"],
                        entry_points_by_type: { EXTERNAL: [], L1_HANDLER: [], CONSTRUCTOR: [] },
                        abi: []
                    },
                    compiled_class_hash: "0x0",
                    resource_bounds: {
                        l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
                        l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
                        l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
                    }
                }
            ],
            block_id: "latest"
        },
        id: 1
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

testRpc();
