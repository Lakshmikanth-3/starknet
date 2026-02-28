/**
 * Add bitcoin_withdrawal_address column to vaults table
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'privatebtc-production-v4.db');
console.log(`📂 Opening database: ${dbPath}\n`);

const db = new Database(dbPath);

try {
    // Check if column already exists
    const columns = db.prepare(`PRAGMA table_info(vaults)`).all();
    const hasColumn = columns.some(col => col.name === 'bitcoin_withdrawal_address');

    if (hasColumn) {
        console.log('✅ Column bitcoin_withdrawal_address already exists');
        process.exit(0);
    }

    // Add the column
    db.prepare(`
        ALTER TABLE vaults 
        ADD COLUMN bitcoin_withdrawal_address TEXT DEFAULT NULL
    `).run();

    console.log('✅ Successfully added bitcoin_withdrawal_address column to vaults table!');
    console.log('📝 This will store the Bitcoin signet address to send funds back during withdrawal.\n');

} catch (error) {
    console.error('❌ Error adding column:', error.message);
    process.exit(1);
} finally {
    db.close();
}
