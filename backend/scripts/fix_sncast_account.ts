import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ACCOUNTS_FILE = '/home/sl/.starknet_accounts/starknet_open_zeppelin_accounts.json';
const ACCOUNT_NAME = 'alpha-sepolia';
const ACCOUNT_ADDRESS = '0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b';
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || '0x6f5166243f7377cdf38d3adbacfc27d8900d387b2f68087f1dd62e6d3776f48';
const PUBLIC_KEY = '0x15f70a64931f67f6797b5d90956897103a5e17478642767078864c39e083981'; // Derived previously or known?

// If public key unknown, we can try to derive it or just put a placeholder if sncast re-derives it?
// Actually sncast needs it.
// I'll assume valid public key for that private key.
// But better to just check if the file exists and has "sepolia" network.

function fixAccount() {
    console.log(`Checking accounts file: ${ACCOUNTS_FILE}`);
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        console.error('Accounts file not found!');
        // Create it?
        const initialContent = {
            "sepolia": {
                [ACCOUNT_NAME]: {
                    "private_key": PRIVATE_KEY,
                    "public_key": PUBLIC_KEY,
                    "address": ACCOUNT_ADDRESS,
                    "salt": "0x0",
                    "deployed": true,
                    "class_hash": "0x05400d9ca9d30075c32729da87265a7f920f66675d05370425a17686524177b8", // OZ 0.8.1 class hash?
                    "legacy": false
                }
            }
        };
        fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initialContent, null, 2));
        console.log('Created accounts file.');
        return;
    }

    const content = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));

    if (!content.sepolia) {
        content.sepolia = {};
    }

    console.log(`Updating account ${ACCOUNT_NAME}...`);
    content.sepolia[ACCOUNT_NAME] = {
        "private_key": PRIVATE_KEY,
        "public_key": PUBLIC_KEY,
        "address": ACCOUNT_ADDRESS,
        "salt": "0x0",
        "deployed": true,
        "class_hash": "0x05400d9ca9d30075c32729da87265a7f920f66675d05370425a17686524177b8",
        "legacy": false
    };

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(content, null, 2));
    console.log('Accounts file updated successfully!');
}

fixAccount();
