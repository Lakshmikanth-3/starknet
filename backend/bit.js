const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');

const { BIP32Factory } = bip32;
const bip32Instance = BIP32Factory(ecc);

const mnemonic = "budget spike prize fruit sudden target swamp mechanic like finish concert total";
const seed = bip39.mnemonicToSeedSync(mnemonic);

const SIGNET = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
};

// Testnet Native Segwit path: m/84'/1'/0'/0/0
const root = bip32Instance.fromSeed(seed, SIGNET);
const child = root.derivePath("m/84'/1'/0'/0/0");

const { address } = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network: SIGNET });
const wif = child.toWIF();

console.log("Address:", address);
console.log("WIF_Private_Key:", wif);

const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');
envContent = envContent.replace('REPLACE_ME_WITH_YOUR_WIF_PRIVATE_KEY', wif);
fs.writeFileSync(envPath, envContent);

console.log("✅ Successfully injected WIF into .env!");
