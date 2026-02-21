"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function get(path) {
    return new Promise((resolve, reject) => {
        const req = http_1.default.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET'
        }, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => resolve(JSON.parse(buffer)));
        });
        req.on('error', reject);
        req.end();
    });
}
async function run() {
    console.log('🔍 Verifying Vault Persistence...');
    try {
        const id = fs_1.default.readFileSync(path_1.default.join(__dirname, 'vault_id.txt'), 'utf8').trim();
        console.log(`Looking for Vault: ${id}`);
        const res = await get('/api/vaults/0xPERSISTENCE_TEST');
        if (res.success) {
            const vault = res.data.find((v) => v.vaultId === id);
            if (vault) {
                console.log('✅ SUCCESS: Vault found after restart!');
                console.log(`   ID: ${vault.vaultId}`);
                console.log(`   Status: ${vault.status}`);
            }
            else {
                console.error('❌ FAILED: Vault not found in list.');
                process.exit(1);
            }
        }
        else {
            console.error('❌ API Error:', res.error);
            process.exit(1);
        }
    }
    catch (e) {
        console.error('❌ Error reading ID file or connecting:', e);
        process.exit(1);
    }
}
run();
