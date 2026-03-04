const Database = require('better-sqlite3');
const db = new Database('./privatebtc-production-v4.db', { readonly: true });

console.log('\n=== VAULTS TABLE SCHEMA ===');
const schema = db.prepare('PRAGMA table_info(vaults)').all();
schema.forEach(col => {
    console.log(`  ${col.name.padEnd(20)} ${col.type}`);
});

console.log('\n=== RECENT VAULTS ===');
const vaults = db.prepare('SELECT * FROM vaults ORDER BY id DESC LIMIT 5').all();
if (vaults.length === 0) {
    console.log('  No vaults found in database!');
} else {
    vaults.forEach((vault, i) => {
        console.log(`\nVault ${i + 1}:`);
        console.log(`  ID: ${vault.id}`);
        console.log(`  Commitment: ${vault.commitment}`);
        console.log(`  Nullifier: ${vault.nullifier_hash ? vault.nullifier_hash.substring(0, 32) + '...' : 'NULL'}`);
        console.log(`  Status: ${vault.status}`);
        console.log(`  BTC TX: ${vault.bitcoin_tx_id || 'NULL'}`);
    });
}

console.log('\n=== VAULT COUNT BY STATUS ===');
const counts = db.prepare('SELECT status, COUNT(*) as count FROM vaults GROUP BY status').all();
counts.forEach(row => {
    console.log(`  ${row.status}: ${row.count}`);
});

db.close();
