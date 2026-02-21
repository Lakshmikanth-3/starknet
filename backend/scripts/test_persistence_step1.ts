
import http from 'http';
import fs from 'fs';
import path from 'path';

function post(path: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
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
        fs.writeFileSync(path.join(__dirname, 'vault_id.txt'), id);
    } else {
        console.error('❌ Failed:', res.error);
        process.exit(1);
    }
}

run();
