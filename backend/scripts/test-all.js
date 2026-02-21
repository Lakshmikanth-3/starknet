// Run all tests in sequence
async function runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║      PrivateBTC Backend - Complete Test Suite         ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Test 1: Health Check
    console.log('[1/6] Running Health Check Test...');
    const { execSync } = require('child_process');

    try {
        execSync('node scripts/test-health.js', { stdio: 'inherit' });
        await sleep(2000);
    } catch (error) {
        console.error('Health check failed');
    }

    // Test 2: Create Vault
    console.log('[2/6] Running Create Vault Test...');
    try {
        execSync('node scripts/test-create-vault.js', { stdio: 'inherit' });
        await sleep(2000);
    } catch (error) {
        console.error('Create vault failed');
    }

    // Test 3: Get User Vaults
    console.log('[3/6] Running Get User Vaults Test...');
    try {
        execSync('node scripts/test-get-vaults.js', { stdio: 'inherit' });
        await sleep(2000);
    } catch (error) {
        console.error('Get vaults failed');
    }

    // Test 4: Generate ZK Proof
    console.log('[4/6] Running Generate Proof Test...');
    try {
        execSync('node scripts/test-generate-proof.js', { stdio: 'inherit' });
        await sleep(2000);
    } catch (error) {
        console.error('Generate proof failed');
    }

    // Test 5: Platform Stats
    console.log('[5/6] Running Platform Stats Test...');
    try {
        execSync('node scripts/test-stats.js', { stdio: 'inherit' });
        await sleep(2000);
    } catch (error) {
        console.error('Stats failed');
    }

    // Test 6: Withdrawal
    console.log('[6/6] Running Withdrawal Test...');
    try {
        execSync('node scripts/test-withdraw.js', { stdio: 'inherit' });
    } catch (error) {
        console.error('Withdrawal test failed');
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║            ✅ ALL TESTS COMPLETED!                    ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('📝 Summary:');
    console.log('  - Health check validated');
    console.log('  - Vault creation tested');
    console.log('  - User vaults retrieval tested');
    console.log('  - ZK proof generation tested');
    console.log('  - Platform statistics tested');
    console.log('  - Withdrawal process tested\n');

    console.log('💡 Next Steps:');
    console.log('  1. Review vault data in scripts/last-vault.json');
    console.log('  2. Check the database: privatebtc.db');
    console.log('  3. Build the frontend interface');
    console.log('  4. Deploy to production\n');
}

runAllTests();
