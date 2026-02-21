"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http_1.default.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        }, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => resolve(JSON.parse(buffer)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}
async function run() {
    console.log('📝 Creating Vault for Persistence Test...');
    const res = await post('/api/vaults', {
        userAddress: '0xPERSISTENCE_TEST',
        amount: 0.1,
        lockPeriod: 30
    });
    if (res.success) {
        const id = res.data.vaultId;
        console.log(`✅ Vault Created: ${id}`);
        fs_1.default.writeFileSync(path_1.default.join(__dirname, 'vault_id.txt'), id);
    }
    else {
        console.error('❌ Failed:', res.error);
        process.exit(1);
    }
}
run();
