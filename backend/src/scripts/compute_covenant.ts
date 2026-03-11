import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const TESTNET = bitcoin.networks.testnet;

const seqPriv = Buffer.from('44de67db6c5dde6d912d58a1ecadc0e0c33409b6f9be7c68ca0e241c00b3491e', 'hex');
const seqPub = Buffer.from(ecc.pointFromScalar(seqPriv, true)!);
const seqXOnly = seqPub.slice(1);

// OP_CHECKSIG tapscript
const covenantScript = bitcoin.script.compile([seqXOnly, bitcoin.opcodes.OP_CHECKSIG]);
const NUMS = Buffer.from('50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0', 'hex');

// Build p2tr with bitcoinjs
const p2trInfo = bitcoin.payments.p2tr({
  internalPubkey: NUMS,
  scriptTree: { output: covenantScript },
  network: TESTNET
});

const p2trSpend = bitcoin.payments.p2tr({
  internalPubkey: NUMS,
  scriptTree: { output: covenantScript },
  redeem: { output: covenantScript, redeemVersion: 0xc0 },
  network: TESTNET
});

const controlBlock = p2trSpend.witness ? Buffer.from(p2trSpend.witness[p2trSpend.witness.length - 1]) : Buffer.alloc(0);
const merkleRoot = p2trInfo.hash ? Buffer.from(p2trInfo.hash).toString('hex') : '';

console.log('=== NEW COVENANT CONFIG ===');
console.log('COVENANT_ADDRESS=' + p2trInfo.address);
console.log('COVENANT_SCRIPT_HEX=' + covenantScript.toString('hex'));
console.log('COVENANT_MERKLE_ROOT=' + merkleRoot);
console.log('COVENANT_CONTROL_BLOCK=' + controlBlock.toString('hex'));
console.log('SEQUENCER_XONLY_PUBKEY=' + seqXOnly.toString('hex'));
