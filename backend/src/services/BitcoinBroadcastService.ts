import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairAPI } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const ECPair: ECPairAPI = ECPairFactory(ecc);

const SIGNET: bitcoin.Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
};

export class BitcoinBroadcastService {
    private static MEMPOOL_API = process.env.MEMPOOL_API_URL || 'https://mempool.space/signet/api';

    static async broadcastSignetTransaction(amountSats: number): Promise<string> {
        console.log(`[BitcoinBroadcast] Starting automated broadcast for ${amountSats} sats...`);

        const privateKeyWif = process.env.SENDER_PRIVATE_KEY;
        const senderAddress = process.env.SENDER_ADDRESS;
        const vaultAddress = process.env.VAULT_ADDRESS_BTC;

        if (!privateKeyWif || !senderAddress || !vaultAddress) {
            throw new Error('Missing Bitcoin configuration in .env (SENDER_PRIVATE_KEY, SENDER_ADDRESS, or VAULT_ADDRESS_BTC)');
        }

        const keyPair = ECPair.fromWIF(privateKeyWif, SIGNET);

        // Step 1: Fetch UTXOs
        const utxoRes = await fetch(`${this.MEMPOOL_API}/address/${senderAddress}/utxo`);
        if (!utxoRes.ok) throw new Error(`Fetch UTXOs failed: ${utxoRes.statusText}`);
        const allUtxos = await utxoRes.json() as any[];

        if (allUtxos.length === 0) {
            throw new Error('No UTXOs found for sender address.');
        }

        // Step 2: Fetch fee rate
        const feeRes = await fetch(`${this.MEMPOOL_API}/v1/fees/recommended`);
        const fees = await feeRes.json() as any;
        const feeRate = fees.fastestFee || 1;

        // Step 3: Select UTXOs
        let totalInput = 0;
        const selectedUtxos = [];
        allUtxos.sort((a, b) => b.value - a.value);

        let estimatedFee = 0;
        for (const utxo of allUtxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            estimatedFee = Math.ceil((selectedUtxos.length * 68 + 2 * 31 + 10) * feeRate);
            if (totalInput >= amountSats + estimatedFee) break;
        }

        if (totalInput < amountSats + estimatedFee) {
            throw new Error(`Insufficient funds: Have ${totalInput}, need ${amountSats + estimatedFee}`);
        }

        // Step 4: Build PSBT
        const psbt = new bitcoin.Psbt({ network: SIGNET });

        for (const utxo of selectedUtxos) {
            const txRes = await fetch(`${this.MEMPOOL_API}/tx/${utxo.txid}`);
            const tx = await txRes.json() as any;
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

        psbt.addOutput({
            address: vaultAddress,
            value: BigInt(amountSats),
        });

        const change = totalInput - amountSats - estimatedFee;
        if (change > 546) {
            psbt.addOutput({
                address: senderAddress,
                value: BigInt(change),
            });
        }

        // Step 5: Sign & Finalize
        selectedUtxos.forEach((_, i) => psbt.signInput(i, keyPair));
        psbt.finalizeAllInputs();
        const txHex = psbt.extractTransaction().toHex();

        // Step 6: Broadcast
        const broadcastRes = await fetch(`${this.MEMPOOL_API}/tx`, {
            method: 'POST',
            body: txHex,
        });

        if (!broadcastRes.ok) {
            const err = await broadcastRes.text();
            throw new Error(`Broadcast failed: ${err}`);
        }

        const txid = await broadcastRes.text();
        console.log(`[BitcoinBroadcast] Success! TXID: ${txid}`);
        return txid;
    }

    /**
     * Send Bitcoin from custodian/sender address to any recipient (for withdrawals)
     */
    static async sendBitcoinToAddress(recipientAddress: string, amountSats: number): Promise<string> {
        console.log(`[BitcoinWithdrawal] Sending ${amountSats} sats to ${recipientAddress}...`);

        const privateKeyWif = process.env.SENDER_PRIVATE_KEY;
        const senderAddress = process.env.SENDER_ADDRESS;

        if (!privateKeyWif || !senderAddress) {
            throw new Error('Missing Bitcoin configuration in .env (SENDER_PRIVATE_KEY or SENDER_ADDRESS)');
        }

        if (!recipientAddress || !recipientAddress.startsWith('tb1')) {
            throw new Error('Invalid recipient address - must be a Signet testnet address (starts with tb1)');
        }

        const keyPair = ECPair.fromWIF(privateKeyWif, SIGNET);

        // Step 1: Fetch UTXOs from sender (custodian) address
        const utxoRes = await fetch(`${this.MEMPOOL_API}/address/${senderAddress}/utxo`);
        if (!utxoRes.ok) throw new Error(`Fetch UTXOs failed: ${utxoRes.statusText}`);
        const allUtxos = await utxoRes.json() as any[];

        if (allUtxos.length === 0) {
            throw new Error(`No UTXOs found for sender address ${senderAddress}. Cannot process withdrawal.`);
        }

        console.log(`[BitcoinWithdrawal] Found ${allUtxos.length} UTXOs, total: ${allUtxos.reduce((a, u) => a + u.value, 0)} sats`);

        // Step 2: Fetch fee rate
        const feeRes = await fetch(`${this.MEMPOOL_API}/v1/fees/recommended`);
        const fees = await feeRes.json() as any;
        const feeRate = fees.fastestFee || 1;

        // Step 3: Select UTXOs
        let totalInput = 0;
        const selectedUtxos = [];
        allUtxos.sort((a, b) => b.value - a.value);

        let estimatedFee = 0;
        for (const utxo of allUtxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            estimatedFee = Math.ceil((selectedUtxos.length * 68 + 2 * 31 + 10) * feeRate);
            if (totalInput >= amountSats + estimatedFee) break;
        }

        if (totalInput < amountSats + estimatedFee) {
            throw new Error(
                `Insufficient funds in custodian wallet. Have: ${totalInput} sats, Need: ${amountSats + estimatedFee} sats (amount + fee). Fund ${senderAddress} with Signet BTC.`
            );
        }

        console.log(`[BitcoinWithdrawal] Selected ${selectedUtxos.length} UTXOs, total input: ${totalInput} sats, fee: ${estimatedFee} sats`);

        // Step 4: Build PSBT
        const psbt = new bitcoin.Psbt({ network: SIGNET });

        for (const utxo of selectedUtxos) {
            const txRes = await fetch(`${this.MEMPOOL_API}/tx/${utxo.txid}`);
            const tx = await txRes.json() as any;
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

        // Send to recipient
        psbt.addOutput({
            address: recipientAddress,
            value: BigInt(amountSats),
        });

        // Change back to sender
        const change = totalInput - amountSats - estimatedFee;
        if (change > 546) {
            psbt.addOutput({
                address: senderAddress,
                value: BigInt(change),
            });
            console.log(`[BitcoinWithdrawal] Change output: ${change} sats back to ${senderAddress}`);
        }

        // Step 5: Sign & Finalize
        selectedUtxos.forEach((_, i) => psbt.signInput(i, keyPair));
        psbt.finalizeAllInputs();
        const txHex = psbt.extractTransaction().toHex();

        console.log(`[BitcoinWithdrawal] Transaction built, hex length: ${txHex.length}`);

        // Step 6: Broadcast
        const broadcastRes = await fetch(`${this.MEMPOOL_API}/tx`, {
            method: 'POST',
            body: txHex,
        });

        if (!broadcastRes.ok) {
            const err = await broadcastRes.text();
            throw new Error(`Bitcoin broadcast failed: ${err}`);
        }

        const txid = await broadcastRes.text();
        console.log(`[BitcoinWithdrawal] ✅ Success! Bitcoin sent to ${recipientAddress}`);
        console.log(`[BitcoinWithdrawal] TXID: ${txid}`);
        return txid;
    }
}
