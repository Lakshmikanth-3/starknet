/**
 * Bitcoin Covenant Service
 *
 * Creates Bitcoin transactions that spend from a P2TR (taproot) covenant address
 * controlled by the sequencer's signing key via an OP_CHECKSIG tapscript leaf.
 *
 * The covenant address is deterministically derived from SEQUENCER_SIGNING_KEY so
 * the on-chain script/control-block always matches the address - fixing the
 * `bad-witness-nonstandard` rejection that occurred when those were mismatched.
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import fetch from 'node-fetch';
import * as ecc from 'tiny-secp256k1';
import { StarknetProofService } from './StarknetProofService';
import { WithdrawalAuthorizationService } from './WithdrawalAuthorizationService';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const OPCAT_SIGNET: bitcoin.Network = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
};

// ── Covenant parameters derived from SEQUENCER_SIGNING_KEY ──────────────────
function deriveCovenant() {
    const signingKeyHex = process.env.SEQUENCER_SIGNING_KEY || '';
    if (!signingKeyHex) {
        throw new Error('SEQUENCER_SIGNING_KEY not set in .env');
    }
    const privKey = Buffer.from(signingKeyHex, 'hex');
    const compressedPub = Buffer.from(ecc.pointFromScalar(privKey, true)!);
    const xOnlyPubkey = compressedPub.slice(1); // 32 bytes

    // Tapscript: <xonly-pubkey> OP_CHECKSIG (BIP342)
    const tapscript = bitcoin.script.compile([xOnlyPubkey, bitcoin.opcodes.OP_CHECKSIG]);

    // NUMS internal key – provably unspendable for key-path spends
    const internalPubkey = Buffer.from(
        '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
        'hex',
    );

    // Build the P2TR address (script-path spend only)
    const p2trInfo = bitcoin.payments.p2tr({
        internalPubkey,
        scriptTree: { output: tapscript },
        network: OPCAT_SIGNET,
    });

    // Build the spending template to get the control block
    const p2trSpend = bitcoin.payments.p2tr({
        internalPubkey,
        scriptTree: { output: tapscript },
        redeem: { output: tapscript, redeemVersion: 0xc0 },
        network: OPCAT_SIGNET,
    });

    // witness[last] is the control block produced by bitcoinjs
    if (!p2trSpend.witness || p2trSpend.witness.length === 0) {
        throw new Error('Could not derive control block');
    }
    const controlBlock = Buffer.from(p2trSpend.witness[p2trSpend.witness.length - 1]);

    return {
        address: p2trInfo.address!,
        tapscript,
        internalPubkey,
        controlBlock,
        xOnlyPubkey,
        privKey,
    };
}

const COVENANT = deriveCovenant();
// Log so the operator knows which address to fund
console.log(`[Covenant] Derived P2TR covenant address: ${COVENANT.address}`);
console.log(`[Covenant] Tapscript (hex): ${Buffer.from(COVENANT.tapscript).toString('hex')}`);
console.log(`[Covenant] Control block (hex): ${COVENANT.controlBlock.toString('hex')}`);

export class BitcoinCovenantService {

    private static MEMPOOL_API = process.env.OPCAT_MEMPOOL_API || 'https://mempool.space/signet/api';
    // Use the dynamically derived address, not the old env value
    private static get COVENANT_ADDRESS() { return COVENANT.address; }

    /**
     * Create a signed tapscript (P2TR script-path) covenant withdrawal.
     *
     * The witness stack is simply: <schnorr-signature> | <tapscript> | <control-block>
     */
    static async createCovenantWithdrawal(authorizationId: string): Promise<{
        txHex: string;
        txid: string;
        witnessSize: number;
    }> {
        console.log(`[Covenant] Creating covenant withdrawal for authorization ${authorizationId}`);

        // 1. Get authorization
        const auth = WithdrawalAuthorizationService.getAuthorizationById(authorizationId);
        if (!auth) throw new Error('Authorization not found');

        // 2. Fetch covenant UTXOs
        console.log(`[Covenant] Fetching UTXOs from ${this.COVENANT_ADDRESS}...`);
        const utxos = await this.fetchCovenantUtxos();
        if (utxos.length === 0) throw new Error('No funds in covenant vault');

        // 3. Select UTXOs (may combine multiple to cover amount + fee)
        const FEE_PER_INPUT = 2000; // safe flat fee per input for P2TR tapscript spend
        const { selectedUtxos, totalValue } = this.selectUtxos(utxos, auth.amount_sats, FEE_PER_INPUT);
        const fee = FEE_PER_INPUT * selectedUtxos.length;
        console.log(
            `[Covenant] Selected ${selectedUtxos.length} UTXO(s): ` +
            selectedUtxos.map(u => `${u.txid.slice(0,8)}…=${u.value}`).join(', ') +
            ` | total=${totalValue} fee=${fee}`
        );

        // 4. Build PSBT with all inputs
        const psbt = new bitcoin.Psbt({ network: OPCAT_SIGNET });

        for (const utxo of selectedUtxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: Buffer.from(utxo.scriptPubKey, 'hex'),
                    value: BigInt(utxo.value),
                },
                tapLeafScript: [{
                    leafVersion: 0xc0,
                    script: COVENANT.tapscript,
                    controlBlock: COVENANT.controlBlock,
                }],
            });
        }

        // Output to user
        psbt.addOutput({
            address: auth.bitcoin_address,
            value: BigInt(auth.amount_sats),
        });

        // Change output (if dust-worthy)
        const change = totalValue - auth.amount_sats - fee;
        if (change > 546) {
            psbt.addOutput({
                address: this.COVENANT_ADDRESS,
                value: BigInt(change),
            });
            console.log(`[Covenant] Change output: ${change} sats to ${this.COVENANT_ADDRESS}`);
        }

        // 5. Sign every input with the same tapscript leaf
        const keypair = ECPair.fromPrivateKey(COVENANT.privKey, { network: OPCAT_SIGNET });

        const leafHash = bitcoin.crypto.taggedHash(
            'TapLeaf',
            Buffer.concat([Buffer.from([0xc0]), this.varInt(COVENANT.tapscript.length), COVENANT.tapscript]),
        );

        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signTaprootInput(i, keypair as any, Buffer.from(leafHash));
            psbt.validateSignaturesOfInput(i, () => true);
        }

        psbt.finalizeAllInputs();

        // 6. Extract
        const txFinal = psbt.extractTransaction();
        const txHex = txFinal.toHex();
        const txid = txFinal.getId();

        console.log(`[Covenant] ✅ Transaction built:`);
        console.log(`[Covenant]    TXID: ${txid}`);
        console.log(`[Covenant]    Size: ${txHex.length / 2} bytes`);

        return { txHex, txid, witnessSize: 0 };
    }

    /**
     * Broadcast covenant transaction to network
     */
    static async broadcastCovenantTransaction(txHex: string): Promise<string> {
        console.log(`[Covenant] Broadcasting transaction...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${this.MEMPOOL_API}/tx`, {
                method: 'POST',
                body: txHex,
                headers: { 'Content-Type': 'text/plain' },
                signal: controller.signal as any,
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Broadcast failed: ${error}`);
            }

            const txid = await response.text();
            console.log(`[Covenant] ✅ Transaction broadcast:`);
            console.log(`[Covenant]    TXID: ${txid}`);
            console.log(`[Covenant]    Explorer: ${this.MEMPOOL_API.replace('/api', '')}/tx/${txid}`);

            return txid;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Complete covenant withdrawal (create + broadcast)
     */
    static async executeCovenantWithdrawal(authorizationId: string): Promise<string> {
        const { txHex } = await this.createCovenantWithdrawal(authorizationId);
        return this.broadcastCovenantTransaction(txHex);
    }

    /**
     * Get covenant status
     */
    static async getCovenantStatus(): Promise<{
        address: string;
        balance: number;
        utxoCount: number;
        network: string;
    }> {
        const utxos = await this.fetchCovenantUtxos().catch(() => []);
        const balance = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);
        return {
            address: this.COVENANT_ADDRESS,
            balance,
            utxoCount: utxos.length,
            network: 'opcat-signet',
        };
    }

    static async getCovenantBalance(): Promise<number> {
        try {
            const utxos = await this.fetchCovenantUtxos();
            return utxos.reduce((s: number, u: any) => s + u.value, 0);
        } catch {
            return 0;
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private static async fetchCovenantUtxos(): Promise<any[]> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const r = await fetch(`${this.MEMPOOL_API}/address/${this.COVENANT_ADDRESS}/utxo`, {
                signal: controller.signal as any,
            });
            if (!r.ok) throw new Error(`Failed to fetch UTXOs: ${r.statusText}`);
            const utxos = await r.json() as any[];

            for (const utxo of utxos) {
                const txRes = await fetch(`${this.MEMPOOL_API}/tx/${utxo.txid}`, {
                    signal: controller.signal as any,
                });
                const tx = await txRes.json() as any;
                utxo.scriptPubKey = tx.vout[utxo.vout].scriptpubkey;
            }
            return utxos;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Greedy UTXO selection — picks largest UTXOs first until total >= amount + fee.
     * Returns the selected UTXOs and their combined value.
     */
    private static selectUtxos(
        utxos: any[],
        amount: number,
        feePerInput: number
    ): { selectedUtxos: any[]; totalValue: number } {
        // Sort largest first for better fee efficiency
        const sorted = [...utxos].sort((a, b) => b.value - a.value);

        const selected: any[] = [];
        let totalValue = 0;

        for (const utxo of sorted) {
            selected.push(utxo);
            totalValue += utxo.value;
            const fee = feePerInput * selected.length;
            if (totalValue >= amount + fee) {
                return { selectedUtxos: selected, totalValue };
            }
        }

        // Not enough funds even using all UTXOs
        const totalFee = feePerInput * sorted.length;
        throw new Error(
            `Insufficient funds. Need ${amount + feePerInput} sats (incl. fee), ` +
            `covenant total: ${totalValue} sats across ${sorted.length} UTXO(s).`
        );
    }

    /** Encode a varint for use in BIP341 tagged-hash pre-images */
    private static varInt(n: number): Buffer {
        if (n < 0xfd) return Buffer.from([n]);
        if (n <= 0xffff) { const b = Buffer.alloc(3); b[0] = 0xfd; b.writeUInt16LE(n, 1); return b; }
        const b = Buffer.alloc(5); b[0] = 0xfe; b.writeUInt32LE(n, 1); return b;
    }

    /** Encode a witness stack into the serialised segment-by-segment format */
    private static encodeWitnessStack(witness: Buffer[]): Buffer {
        let buf = Buffer.alloc(0);
        const vi = (n: number) => {
            if (n < 0xfd) return Buffer.from([n]);
            if (n < 0x10000) { const b = Buffer.alloc(3); b.writeUInt8(0xfd, 0); b.writeUInt16LE(n, 1); return b; }
            if (n < 0x100000000) { const b = Buffer.alloc(5); b.writeUInt8(0xfe, 0); b.writeUInt32LE(n, 1); return b; }
            const b = Buffer.alloc(9); b.writeUInt8(0xff, 0); b.writeBigUInt64LE(BigInt(n), 1); return b;
        };
        buf = Buffer.concat([buf, vi(witness.length)]);
        for (const w of witness) buf = Buffer.concat([buf, vi(w.length), w]);
        return buf;
    }
}
