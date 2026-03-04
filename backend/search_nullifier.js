const Database = require('better-sqlite3');
const db = new Database('./privatebtc-production-v4.db', { readonly: true });

// The nullifier from the user's withdrawal attempt
const searchNullifier = '0xfd18c853786bf4923be131056d3a2cf1017bf28619629927d541d161c5bc3e6';

console.log(`\nSearching for nullifier: ${searchNullifier}\n`);

const vault = db.prepare('SELECT * FROM vaults WHERE nullifier_hash = ?').get(searchNullifier);

if (vault) {
    console.log('✅ FOUND VAULT:');
    console.log(JSON.stringify(vault, null, 2));
} else {
    console.log('❌ NOT FOUND');
    console.log('\nLet me check all nullifier hashes in the database:\n');
    
    const allVaults = db.prepare('SELECT id, commitment, nullifier_hash, status FROM vaults').all();
    allVaults.forEach((v, i) => {
        console.log(`${i + 1}. ${v.nullifier_hash || 'NULL'} (${v.status})`);
    });
    
    // Check if any vault has no nullifier
    const noNullifier = allVaults.filter(v => !v.nullifier_hash);
    if (noNullifier.length > 0) {
        console.log(`\n⚠️  Found ${noNullifier.length} vault(s) WITHOUT nullifier_hash:`);
        noNullifier.forEach(v => {
            console.log(`  - ID: ${v.id}, Commitment: ${v.commitment}`);
        });
    }
}

db.close();
