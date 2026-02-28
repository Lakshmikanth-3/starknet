/**
 * Fix vault stuck in 'withdrawn' status when Bitcoin payout actually failed
 * Reset to 'active' so user can retry Bitcoin payout
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'privatebtc-production-v4.db');
console.log(`📂 Opening database: ${dbPath}\n`);

const db = new Database(dbPath);

try {
    // Find vaults that are 'withdrawn' but have no bitcoin_withdrawal_address
    // This means Starknet withdrawal succeeded but Bitcoin payout failed
    const stuckVaults = db.prepare(`
        SELECT id, commitment, withdraw_tx_hash, nullifier_hash, bitcoin_withdrawal_address
        FROM vaults 
        WHERE status = 'withdrawn' 
        AND (bitcoin_withdrawal_address IS NULL OR bitcoin_withdrawal_address = '')
    `).all();

    console.log(`🔍 Found ${stuckVaults.length} vault(s) stuck in 'withdrawn' status without Bitcoin payout:\n`);

    if (stuckVaults.length === 0) {
        console.log('✅ No stuck vaults found. All good!');
        process.exit(0);
    }

    // Display vaults that will be reset
    stuckVaults.forEach((vault, idx) => {
        console.log(`${idx + 1}. Vault ID: ${vault.id}`);
        console.log(`   Commitment: ${vault.commitment}`);
        console.log(`   Starknet Withdraw TX: ${vault.withdraw_tx_hash}`);
        console.log(`   Nullifier: ${vault.nullifier_hash || 'N/A'}`);
        console.log(`   Bitcoin Address: ${vault.bitcoin_withdrawal_address || 'NOT SET (Bitcoin payout failed!)'}`);
        console.log('');
    });

    console.log('🔧 Resetting these vaults to "active" status so Bitcoin payout can be retried...\n');

    // Reset status to 'active' so user can retry
    const updateStmt = db.prepare(`
        UPDATE vaults 
        SET status = 'active'
        WHERE status = 'withdrawn' 
        AND (bitcoin_withdrawal_address IS NULL OR bitcoin_withdrawal_address = '')
    `);

    const result = updateStmt.run();

    console.log(`✅ Successfully reset ${result.changes} vault(s) to 'active' status!`);
    console.log('📝 These vaults can now retry Bitcoin payout without redoing Starknet withdrawal.\n');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
} finally {
    db.close();
}
