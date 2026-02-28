const { RpcProvider, hash } = require('starknet');

async function main() {
    const p = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ' });
    const MOCKBTC = '0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52';

    const cls = await p.getClassAt(MOCKBTC, 'latest');

    console.log('=== All ABI items ===');
    cls.abi.forEach(item => {
        if (item.type === 'interface') {
            console.log('Interface:', item.name);
            item.items.forEach(fn => {
                const sel = hash.getSelectorFromName(fn.name);
                console.log(`  fn: ${fn.name} -> selector: ${sel}`);
            });
        } else if (item.type === 'function') {
            const sel = hash.getSelectorFromName(item.name);
            console.log(`fn: ${item.name} -> selector: ${sel}`);
        } else {
            console.log(`${item.type}: ${item.name}`);
        }
    });

    // Also check known selectors
    const knownFns = ['approve', 'transfer', 'mint', 'balance_of', 'balanceOf', 'transfer_from'];
    console.log('\n=== Known function selectors ===');
    knownFns.forEach(fn => {
        console.log(`${fn}: ${hash.getSelectorFromName(fn)}`);
    });
}

main().catch(console.error);
