
const { RpcProvider, hash, num } = require('starknet');

async function main() {
    const provider = new RpcProvider({ nodeUrl: 'https://api.cartridge.gg/x/starknet/sepolia' });
    const vaultAddr = '0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2';

    // btc_token is in storage at some slot.
    // #[storage] struct Storage { btc_token: ContractAddress, ... }
    // Slot 0 is usually the first member.
    const slot = hash.getStorageVarAddress('btc_token');
    console.log(`btc_token slot: ${slot}`);

    try {
        const val = await provider.getStorageAt(vaultAddr, slot, 'latest');
        console.log(`btc_token value: ${val}`);
    } catch (e) {
        console.error(e);
    }
}

main();
