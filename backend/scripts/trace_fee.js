const { Account, RpcProvider, CallData, cairo } = require('starknet');
require('dotenv').config();

async function main() {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const account = new Account(
        provider,
        process.env.STARKNET_ACCOUNT_ADDRESS,
        process.env.SEPOLIA_PRIVATE_KEY,
        '1'
    );

    const nonce = await provider.getNonceForAddress(process.env.STARKNET_ACCOUNT_ADDRESS, 'latest');
    console.log('Nonce:', nonce);

    // Check raw fee estimation first
    try {
        console.log('Calling raw getEstimateFee...');
        const feeResp = await provider.getEstimateFeeBulk(
            [{
                type: 'INVOKE',
                contractAddress: process.env.STARKNET_ACCOUNT_ADDRESS,
                calldata: ['0x1',
                    process.env.MOCKBTC_CONTRACT_ADDRESS,
                    '0x2f0b3c5710379609eb5495f1ecd348cb28167711b73609fe565a72734550354', // mint selector
                    '0x3',
                    process.env.VAULT_CONTRACT_ADDRESS,
                    '0xf4240', '0x0'],
                senderAddress: process.env.STARKNET_ACCOUNT_ADDRESS,
                signature: [],
                version: '0x3',
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
            { blockIdentifier: 'latest' }
        );
        console.log('Raw fee estimate:', JSON.stringify(feeResp, null, 2));
    } catch (e) {
        console.error('FEE ERROR:', e.message);
        // Log the raw RPC response if available
        if (e.baseError) console.error('BASE:', JSON.stringify(e.baseError, null, 2));
    }
}

main().catch(e => {
    console.error('FATAL:', e.message);
    console.error('STACK:', e.stack);
});
