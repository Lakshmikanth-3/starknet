require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const s = require('starknet');
const fs = require('fs');

async function test() {
    // Clear old error file if it exists
    if (fs.existsSync('../test_err.txt')) fs.unlinkSync('../test_err.txt');

    try {
        const p = new s.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        console.log('Provider OK');
        const accountAddr = process.env.STARKNET_ACCOUNT_ADDRESS;
        const privKey = process.env.SEPOLIA_PRIVATE_KEY;
        const rpcUrl = process.env.STARKNET_RPC_URL;
        console.log('addr:', accountAddr ? accountAddr.slice(0, 10) : 'UNDEFINED');
        console.log('key:', privKey ? privKey.slice(0, 6) : 'UNDEFINED');
        // starknet.js v9 object signature
        const a = new s.Account({ provider: { nodeUrl: rpcUrl }, address: accountAddr, signer: privKey });
        console.log('Account OK, address:', a.address);
        const nonce = await a.getNonce('latest');
        console.log('Nonce:', nonce);
    } catch (e) {
        const msg = 'Error: ' + (e.stack || e.message || String(e));
        fs.writeFileSync('../test_err.txt', msg);
        console.error('Error written to test_err.txt');
        process.exit(1);
    }
}
test();
