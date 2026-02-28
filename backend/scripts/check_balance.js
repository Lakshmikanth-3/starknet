const { RpcProvider, Contract } = require('starknet');

async function checkBalance() {
    const provider = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ' });
    const accountAddress = '0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1';

    const strkAddress = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
    const ethAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

    const abi = [
        {
            "name": "balanceOf",
            "type": "function",
            "inputs": [{ "name": "account", "type": "felt" }],
            "outputs": [{ "name": "balance", "type": "Uint256" }],
            "stateMutability": "view"
        }
    ];

    try {
        const strkContract = new Contract(abi, strkAddress, provider);
        const ethContract = new Contract(abi, ethAddress, provider);

        const strkRes = await strkContract.balanceOf(accountAddress);
        const ethRes = await ethContract.balanceOf(accountAddress);

        const replacer = (key, value) => typeof value === 'bigint' ? value.toString() : value;
        console.log('STRK Balance:', JSON.stringify(strkRes, replacer));
        console.log('ETH Balance:', JSON.stringify(ethRes, replacer));
    } catch (e) {
        console.error('Error checking balance:', e.message);
    }
}

checkBalance();
