import fetch from 'node-fetch';

async function testApi() {
    const baseUrl = 'http://localhost:3001';
    const userAddress = '0x07f43f07a67f0f62e6e16a5d43f07a67f0f62e6e16a5d43f07a67f0f62e6e16';

    console.log('1. Creating Vault...');
    const createRes = await fetch(`${baseUrl}/api/vaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userAddress,
            amount: 0.1,
            lockPeriod: 30
        })
    });

    const createData = await createRes.json();
    console.log('Create Response:', JSON.stringify(createData, null, 2));

    if (!createData.success) {
        console.error('Failed to create vault');
        return;
    }

    const { vaultId, randomness } = createData.data;

    console.log('\n2. Fetching Withdrawal Payload...');
    const payloadRes = await fetch(`${baseUrl}/api/vaults/${vaultId}/withdrawal-payload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userAddress,
            randomness
        })
    });

    const payloadData = await payloadRes.json();
    console.log('Payload Response:', JSON.stringify(payloadData, null, 2));

    if (payloadData.success) {
        console.log('\n✅ Success! Withdrawal payload generated correctly.');
        console.log('Nullifier:', payloadData.data.nullifier);
        console.log('Amount (u256):', payloadData.data.amount);
    } else {
        console.error('\n❌ Failed to generate withdrawal payload:', payloadData.error);
    }
}

testApi().catch(console.error);
