
import http from 'http';

function post(path: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(buffer));
                } catch (e) {
                    console.error('Failed to parse response:', buffer);
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function get(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET'
        }, (res) => {
            let buffer = '';
            res.on('data', chunk => buffer += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(buffer));
                } catch (e) {
                    console.error('Failed to parse response:', buffer);
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function verify() {
    console.log('🚀 Starting Backend Verification (HTTP)...');

    // 1. Create Vault
    console.log('\nTesting Vault Creation...');
    const userAddress = '0x1234567890123456789012345678901234567890';
    const amount = 0.5;
    const lockPeriod = 90;

    try {
        const createData = await post('/api/vaults', { userAddress, amount, lockPeriod });

        if (!createData.success) {
            console.error('❌ Create Vault Failed:', createData.error);
            return;
        }

        const { vaultId, commitment, randomness, txHash } = createData.data;
        console.log('✅ Vault Created:', vaultId);

        // 2. Verify Real Cryptography (SHA-256 = 64 hex chars)
        console.log('\nVerifying Cryptography...');
        const hexRegex = /^[a-f0-9]{64}$/i;

        if (hexRegex.test(commitment)) {
            console.log('✅ Commitment is valid SHA-256 (64 hex chars):', commitment);
        } else {
            console.error('❌ Commitment format invalid (Mock detected?):', commitment);
        }

        if (hexRegex.test(randomness)) {
            console.log('✅ Randomness is valid 32-byte hex:', randomness);
        } else {
            console.error('❌ Randomness format invalid:', randomness);
        }

        // 3. Fetch Vaults
        console.log('\nTesting Data Retrieval...');
        const getData = await get(`/api/vaults/${userAddress}`);

        if (!getData.success) {
            console.error('❌ Fetch Vaults Failed:', getData.error);
            return;
        }

        const vault = getData.data.find((v: any) => v.vaultId === vaultId);
        if (vault) {
            console.log('✅ Vault retrieved successfully');
            console.log('   Status:', vault.status);
            console.log('   Unlock Date:', new Date(vault.unlockAt).toISOString());
        } else {
            console.error('❌ Created vault not found in list!');
        }

        console.log('\n🎉 Verification Complete!');

    } catch (err) {
        console.error('❌ Test Failed:', err);
    }
}

verify().catch(console.error);
