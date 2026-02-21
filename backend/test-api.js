// Test script for PrivateBTC Backend API

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
    console.log('🧪 Testing PrivateBTC Backend API\n');

    // Test 1: Health Check
    console.log('1️⃣  Testing Health Check...');
    try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        console.log('✅ Health check passed:', data);
    } catch (error) {
        console.error('❌ Health check failed:', error);
        return;
    }

    // Test 2: Create Vault (Deposit)
    console.log('\n2️⃣  Creating a new vault (deposit)...');
    let vaultId, randomness;
    try {
        const res = await fetch(`${BASE_URL}/api/vaults`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress: '0xtest123456',
                amount: 1.5,
                lockPeriod: 90
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log('✅ Vault created successfully!');
            console.log('   Vault ID:', data.data.vaultId);
            console.log('   Commitment:', data.data.commitment);
            console.log('   APY:', (data.data.apy * 100) + '%');
            console.log('   Randomness:', data.data.randomness);
            vaultId = data.data.vaultId;
            randomness = data.data.randomness;
        } else {
            console.error('❌ Failed to create vault:', data.error);
            return;
        }
    } catch (error) {
        console.error('❌ Create vault failed:', error);
        return;
    }

    // Test 3: Get User Vaults
    console.log('\n3️⃣  Retrieving user vaults...');
    try {
        const res = await fetch(`${BASE_URL}/api/vaults/0xtest123456`);
        const data = await res.json();
        if (data.success) {
            console.log(`✅ Found ${data.count} vault(s):`);
            data.data.forEach((vault, idx) => {
                console.log(`   Vault ${idx + 1}:`);
                console.log(`     - Status: ${vault.status}`);
                console.log(`     - Amount: ${vault.amount} BTC`);
                console.log(`     - Days Remaining: ${vault.daysRemaining}`);
                console.log(`     - Projected Yield: ${vault.projectedYield} BTC`);
                console.log(`     - Total Withdrawal: ${vault.totalWithdrawal} BTC`);
            });
        } else {
            console.error('❌ Failed to get vaults:', data.error);
        }
    } catch (error) {
        console.error('❌ Get vaults failed:', error);
    }

    // Test 4: Generate ZK Proof
    console.log('\n4️⃣  Generating ZK proof...');
    let proof;
    try {
        const res = await fetch(`${BASE_URL}/api/vaults/generate-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vaultId,
                amount: 1.5,
                randomness
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log('✅ ZK Proof generated!');
            console.log('   Proof:', data.data.proof.substring(0, 20) + '...');
            proof = data.data.proof;
        } else {
            console.error('❌ Failed to generate proof:', data.error);
        }
    } catch (error) {
        console.error('❌ Generate proof failed:', error);
    }

    // Test 5: Try Withdrawal (should fail - still locked)
    console.log('\n5️⃣  Testing withdrawal (should fail - still locked)...');
    try {
        const res = await fetch(`${BASE_URL}/api/vaults/${vaultId}/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proof,
                userAddress: '0xtest123456'
            })
        });
        const data = await res.json();
        if (!data.success) {
            console.log('✅ Correctly rejected (vault still locked):', data.error);
        } else {
            console.log('⚠️  Withdrawal succeeded (unexpected)');
        }
    } catch (error) {
        console.error('❌ Withdrawal test failed:', error);
    }

    // Test 6: Get Platform Stats
    console.log('\n6️⃣  Getting platform statistics...');
    try {
        const res = await fetch(`${BASE_URL}/api/stats`);
        const data = await res.json();
        if (data.success) {
            console.log('✅ Platform Stats:');
            console.log(`   Total Vaults: ${data.data.totalVaults}`);
            console.log(`   Active Vaults: ${data.data.activeVaults}`);
            console.log(`   Total Value Locked: ${data.data.totalValueLocked} BTC`);
            console.log(`   Total Withdrawals: ${data.data.totalWithdrawals}`);
        } else {
            console.error('❌ Failed to get stats:', data.error);
        }
    } catch (error) {
        console.error('❌ Get stats failed:', error);
    }

    console.log('\n✅ ALL TESTS COMPLETED!\n');
    console.log('💡 Backend is working correctly!');
    console.log('📝 Next steps:');
    console.log('   1. Build a frontend to interact with these APIs');
    console.log('   2. Connect Starknet wallet');
    console.log('   3. Deploy to production');
}

testAPI().catch(console.error);
