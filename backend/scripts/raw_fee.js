const https = require('https');
require('dotenv').config();

const rpcUrl = new URL(process.env.STARKNET_RPC_URL);

async function rpcCall(method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const req = https.request({
            hostname: rpcUrl.hostname,
            path: rpcUrl.pathname + rpcUrl.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    const nonceResp = await rpcCall('starknet_getNonce', ['latest', process.env.STARKNET_ACCOUNT_ADDRESS]);
    const nonce = nonceResp.result || '0x2';
    console.log('Nonce:', nonce);

    const estimateResp = await rpcCall('starknet_estimateFee', [
        [{
            type: 'INVOKE',
            sender_address: process.env.STARKNET_ACCOUNT_ADDRESS,
            calldata: [
                '0x1',
                process.env.MOCKBTC_CONTRACT_ADDRESS,
                '0x2f0b3c5710379609eb5495f1ecd348cb28167711b73609fe565a72734550354',
                '0x3',
                process.env.VAULT_CONTRACT_ADDRESS,
                '0xf4240', '0x0'
            ],
            version: '0x100000000000000000000000000000003',
            signature: [],
            nonce: nonce,
            resource_bounds: {
                l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
                l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
                l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' }
            },
            tip: '0x0',
            paymaster_data: [],
            account_deployment_data: [],
            nonce_data_availability_mode: 'L1',
            fee_data_availability_mode: 'L1'
        }],
        'latest'
    ]);

    console.log('\n=== RAW FEE ESTIMATE RESPONSE ===');
    console.log(JSON.stringify(estimateResp, null, 2));
}

main().catch(e => console.error('FATAL:', e.message));
