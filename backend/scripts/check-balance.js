require('dotenv').config();

const MEMPOOL_API = 'https://mempool.space/signet/api';
const SENDER_ADDRESS = process.env.SENDER_ADDRESS || 'tb1qhkjy7mc9nwg3rtnjapuqg5xczc50nv6ysm5ak8';

async function main() {
    console.log(`Checking balance for: ${SENDER_ADDRESS} on Signet...`);

    const response = await fetch(`${MEMPOOL_API}/address/${SENDER_ADDRESS}/utxo`);
    if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.status} ${response.statusText}`);
    }

    const utxos = await response.json();
    let totalBalance = 0;

    console.log(`Found ${utxos.length} UTXOs:\n`);

    for (const utxo of utxos) {
        console.log(`- TXID: ${utxo.txid}`);
        console.log(`  VOUT: ${utxo.vout} | VALUE: ${utxo.value} sats | CONFIRMED: ${utxo.status.confirmed}`);
        totalBalance += utxo.value;
    }

    console.log(`\n========================================`);
    console.log(`Total Spendable Balance: ${totalBalance} sats`);

    const requiredSats = parseInt(process.env.SEND_AMOUNT_SATS || '200000', 10);
    // Estimate fee: around 300-500 sats
    const requiredTotal = requiredSats + 1000;

    if (totalBalance >= requiredTotal) {
        console.log(`✅ You have enough balance to send ${requiredSats} sats + fees.`);
    } else {
        console.log(`❌ INSUFFICIENT BALANCE. You need at least ${requiredTotal} sats (including estimated fees).`);
        console.log(`   Missing: ${requiredTotal - totalBalance} sats.`);
    }
}

main().catch(console.error);
