const Database = require('better-sqlite3');
const db = new Database('./privatebtc-production-v4.db', { readonly: true });

console.log('\n=== VAULTS MISSING NULLIFIER ===\n');

const vaultsWithoutNullifier = db.prepare(`
    SELECT id, owner_address, commitment, status, deposit_tx_hash, bitcoin_txid, created_at 
    FROM vaults 
    WHERE nullifier_hash IS NULL
    ORDER BY created_at DESC
`).all();

if (vaultsWithoutNullifier.length === 0) {
    console.log('No vaults found without nullifier_hash');
} else {
    console.log(`Found ${vaultsWithoutNullifier.length} vault(s) without nullifier_hash:\n`);
    vaultsWithoutNullifier.forEach((vault, i) => {
        console.log(`Vault ${i + 1}:`);
        console.log(`  ID: ${vault.id}`);
        console.log(`  Commitment: ${vault.commitment}`);
        console.log(`  Status: ${vault.status}`);
        console.log(`  Deposit TX: ${vault.deposit_tx_hash || 'NULL'}`);
        console.log(`  Bitcoin TX: ${vault.bitcoin_txid || 'NULL'}`);
        console.log(`  Created: ${new Date(vault.created_at).toISOString()}`);
        console.log('');
    });
    
    console.log('⚠️  ISSUE: These vaults cannot be withdrawn because they have no nullifier_hash stored.');
    console.log('   The deposit likely completed before the frontend started sending secrets.');
    console.log('   To fix: Need to backfill nullifier_hash if the user has their original secret.\n');
}

db.close();
