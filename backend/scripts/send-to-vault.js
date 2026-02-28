const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
require('dotenv').config();

const ECPair = ECPairFactory(ecc);

// Signet network config
const SIGNET = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
};

const MEMPOOL_API = 'https://mempool.space/signet/api';
const VAULT_ADDRESS = process.env.VAULT_ADDRESS_BTC || 'tb1qgua8e2zpmq79zvmnequka5w53wse3ffuws00gs';
const SENDER_ADDRESS = process.env.SENDER_ADDRESS || 'tb1qhkjy7mc9nwg3rtnjapuqg5xczc50nv6ysm5ak8';

// Use command line argument if provided, otherwise fallback to .env
const argAmount = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const AMOUNT_SATS = argAmount || parseInt(process.env.SEND_AMOUNT_SATS || '200000', 10);

async function main() {
    // Step 1: Load private key
    const privateKeyWif = process.env.SENDER_PRIVATE_KEY;
    if (!privateKeyWif) {
        throw new Error('SENDER_PRIVATE_KEY is missing from .env');
    }

    const keyPair = ECPair.fromWIF(privateKeyWif, SIGNET);
    const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: SIGNET });

    if (address !== SENDER_ADDRESS) {
        throw new Error(`Derived address ${address} does not match SENDER_ADDRESS ${SENDER_ADDRESS}. Check your SENDER_PRIVATE_KEY is correct for a P2WPKH address.`);
    }

    console.log(`--- SIGNET TRANSACTION BUILDER ---`);
    console.log(`Sender: ${SENDER_ADDRESS}`);
    console.log(`Vault:  ${VAULT_ADDRESS}`);
    console.log(`Amount: ${AMOUNT_SATS} sats`);

    // Step 2: Fetch UTXOs
    console.log(`\nFetching UTXOs...`);
    const utxoRes = await fetch(`${MEMPOOL_API}/address/${SENDER_ADDRESS}/utxo`);
    if (!utxoRes.ok) throw new Error(`Fetch UTXOs failed: ${utxoRes.status} ${utxoRes.statusText}`);
    const allUtxos = await utxoRes.json();

    if (allUtxos.length === 0) {
        throw new Error('No UTXOs found for sender address.');
    }

    // Step 3: Fetch fee rate
    console.log('Fetching recommended fee rate...');
    const feeRes = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
    if (!feeRes.ok) throw new Error('Fetch fees failed');
    const fees = await feeRes.json();
    const feeRate = fees.fastestFee || 1;
    console.log(`Using fee rate: ${feeRate} sats/vB`);

    // Step 4: Select UTXOs
    let totalInput = 0;
    const selectedUtxos = [];

    allUtxos.sort((a, b) => b.value - a.value);

    let estimatedFee = 0;
    for (const utxo of allUtxos) {
        selectedUtxos.push(utxo);
        totalInput += utxo.value;

        // estimate fee: inputs * 68 + outputs (max 2) * 31 + 10
        estimatedFee = Math.ceil((selectedUtxos.length * 68 + 2 * 31 + 10) * feeRate);

        if (totalInput >= AMOUNT_SATS + estimatedFee) {
            break;
        }
    }

    if (totalInput < AMOUNT_SATS + estimatedFee) {
        throw new Error(`Insufficient funds. Have ${totalInput} sats, need ${AMOUNT_SATS + estimatedFee} sats.`);
    }

    console.log(`Selected ${selectedUtxos.length} UTXO(s) totaling ${totalInput} sats. Estimated fee: ${estimatedFee} sats.`);

    // Step 6: Build PSBT transaction
    const psbt = new bitcoin.Psbt({ network: SIGNET });

    // Step 7: Add inputs
    for (const utxo of selectedUtxos) {
        const txRes = await fetch(`${MEMPOOL_API}/tx/${utxo.txid}`);
        if (!txRes.ok) throw new Error(`Fetch tx ${utxo.txid} failed`);
        const tx = await txRes.json();
        const scriptPubKey = tx.vout[utxo.vout].scriptpubkey;

        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(scriptPubKey, 'hex'),
                value: BigInt(utxo.value),
            },
        });
    }

    // Step 8: Add outputs
    psbt.addOutput({
        address: VAULT_ADDRESS,
        value: BigInt(AMOUNT_SATS),
    });

    const change = totalInput - AMOUNT_SATS - estimatedFee;
    if (change > 546) { // dust threshold
        console.log(`Adding change output: ${change} sats returning to ${SENDER_ADDRESS}`);
        psbt.addOutput({
            address: SENDER_ADDRESS,
            value: BigInt(change),
        });
    } else {
        console.log(`Change ${change} is below dust threshold, adding to miner fee.`);
    }

    // Step 9: Sign all inputs
    console.log('\nSigning transaction...');
    for (let i = 0; i < selectedUtxos.length; i++) {
        psbt.signInput(i, keyPair);
    }

    // Step 10: Finalize
    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();
    console.log('Transaction signed and hexadecimal extracted.');

    // Step 11: Broadcast
    console.log('\nBroadcasting transaction to Mempool...');
    const broadcastRes = await fetch(`${MEMPOOL_API}/tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: txHex,
    });

    if (!broadcastRes.ok) {
        const errorText = await broadcastRes.text();
        throw new Error(`Broadcast failed: ${broadcastRes.status} ${broadcastRes.statusText}\n${errorText}`);
    }

    const txid = await broadcastRes.text();

    // Step 12: Success output
    console.log('\n✅ Transaction successfully broadcast to Signet!');
    console.log(`TXID: ${txid}`);
    console.log(`View: https://mempool.space/signet/tx/${txid}`);
}

main().catch(console.error);
