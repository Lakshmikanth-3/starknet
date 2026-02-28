/**
 * Check vault status in database
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'privatebtc-production-v4.db');
console.log(`📂 Opening database: ${dbPath}\n`);

const db = new Database(dbPath);

try {
    // Get all vaults
    const allVaults = db.prepare(`
        SELECT id, owner_address, commitment, status, deposit_tx_hash, bitcoin_txid, nullifier_hash, created_at
        FROM vaults 
        ORDER BY created_at DESC
        LIMIT 10
    `).all();

    console.log(`🔍 Found ${allVaults.length} vault(s) in database:\n`);

    if (allVaults.length === 0) {
        console.log('⚠️  No vaults found in database!');
        process.exit(0);
    }

    allVaults.forEach((vault, idx) => {
        console.log(`${idx + 1}. Status: ${vault.status.toUpperCase()}`);
        console.log(`   Vault ID: ${vault.id}`);
        console.log(`   Owner: ${vault.owner_address}`);
        console.log(`   Commitment: ${vault.commitment}`);
        console.log(`   Nullifier: ${vault.nullifier_hash || 'N/A'}`);
        console.log(`   Starknet TX: ${vault.deposit_tx_hash || 'N/A'}`);
        console.log(`   Bitcoin TXID: ${vault.bitcoin_txid || 'N/A'}`);
        console.log(`   Created: ${new Date(vault.created_at).toLocaleString()}`);
        console.log('');
    });

    // Count by status
    const statusCounts = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM vaults
        GROUP BY status
    `).all();

    console.log('📊 Vault Status Summary:');
    statusCounts.forEach(({ status, count }) => {
        console.log(`   ${status}: ${count}`);
    });

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
} finally {
    db.close();
}
