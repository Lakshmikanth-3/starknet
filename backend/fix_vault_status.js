/**
 * Fix vault status migration
 * Updates all vaults with 'pending' status that have a valid deposit_tx_hash to 'active'
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'privatebtc-production-v4.db');
console.log(`📂 Opening database: ${dbPath}`);

const db = new Database(dbPath);

try {
    // Find all pending vaults with a deposit transaction hash
    const pendingVaults = db.prepare(`
        SELECT id, commitment, deposit_tx_hash, nullifier_hash, bitcoin_txid
        FROM vaults 
        WHERE status = 'pending' AND deposit_tx_hash IS NOT NULL
    `).all();

    console.log(`\n🔍 Found ${pendingVaults.length} pending vault(s) with deposit transactions:\n`);

    if (pendingVaults.length === 0) {
        console.log('✅ No vaults need updating. All vaults are in correct status.');
        process.exit(0);
    }

    // Display vaults that will be updated
    pendingVaults.forEach((vault, idx) => {
        console.log(`${idx + 1}. Vault ID: ${vault.id}`);
        console.log(`   Commitment: ${vault.commitment}`);
        console.log(`   Starknet TX: ${vault.deposit_tx_hash}`);
        console.log(`   Bitcoin TXID: ${vault.bitcoin_txid || 'N/A'}`);
        console.log(`   Nullifier: ${vault.nullifier_hash || 'N/A'}`);
        console.log('');
    });

    // Update all pending vaults to active
    const updateStmt = db.prepare(`
        UPDATE vaults 
        SET status = 'active' 
        WHERE status = 'pending' AND deposit_tx_hash IS NOT NULL
    `);

    const result = updateStmt.run();

    console.log(`✅ Successfully updated ${result.changes} vault(s) to 'active' status!\n`);
    console.log('🎉 These vaults can now be used for withdrawals.\n');

} catch (error) {
    console.error('❌ Error updating vault status:', error.message);
    process.exit(1);
} finally {
    db.close();
}
