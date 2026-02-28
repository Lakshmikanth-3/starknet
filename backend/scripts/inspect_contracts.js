const { RpcProvider } = require('starknet');

async function main() {
    const p = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ' });

    const MOCKBTC = '0x0291c79b16b1541361c8efe84c5558994066948cfe9b7075db781a758c2cec52';
    const VAULT = '0x03e735d12f81f2f4beb45634bef9997ae3bde996c2f84a204957dc5ef2209de2';

    console.log('=== Checking MockBTC contract ===');
    try {
        const cls = await p.getClassAt(MOCKBTC, 'latest');
        const iface = cls.abi.find(x => x.type === 'interface');
        if (iface) {
            console.log('MockBTC functions:', iface.items.map(x => x.name));
        } else {
            // List all named items
            cls.abi.forEach(item => {
                if (item.name) console.log(' -', item.type, item.name);
                if (item.items) item.items.forEach(i => console.log('   fn:', i.name));
            });
        }
    } catch (e) {
        console.error('MockBTC ERROR:', e.message);
    }

    console.log('\n=== Checking Vault contract ===');
    try {
        const cls = await p.getClassAt(VAULT, 'latest');
        const iface = cls.abi.find(x => x.type === 'interface');
        if (iface) {
            console.log('Vault functions:', iface.items.map(x => x.name));
        } else {
            cls.abi.forEach(item => {
                if (item.name) console.log(' -', item.type, item.name);
                if (item.items) item.items.forEach(i => console.log('   fn:', i.name));
            });
        }
    } catch (e) {
        console.error('Vault ERROR:', e.message);
    }

    console.log('\n=== Done ===');
}

main().catch(console.error);
