const Database = require('better-sqlite3');
const db = new Database('./privatebtc-production-v4.db', { readonly: true });

const searchNullifier = '0xfd18c853786bf4923be131056d3a2cf1017bf2861962927d541d161c5bc3e6';

console.log('\n=== SEARCHING FOR MATCHING NULLIFIER ===\n');
console.log(`Target nullifier: ${searchNullifier}`);
console.log(`Target length: ${searchNullifier.length} characters\n`);

// Exact match
const exactMatch = db.prepare('SELECT * FROM vaults WHERE nullifier_hash = ?').get(searchNullifier);

if (exactMatch) {
    console.log('✅ EXACT MATCH FOUND:');
    console.log(JSON.stringify(exactMatch, null, 2));
} else {
    console.log('❌ No exact match found.\n');
    
    // Check for partial matches (prefix)
    console.log('Checking for partial matches...\n');
    
    const allVaults = db.prepare('SELECT id, commitment, nullifier_hash, status FROM vaults WHERE nullifier_hash IS NOT NULL').all();
    
    const partialMatches = allVaults.filter(v => 
        v.nullifier_hash && v.nullifier_hash.toLowerCase().startsWith(searchNullifier.toLowerCase().slice(0, 20))
    );
    
    if (partialMatches.length > 0) {
        console.log(`Found ${partialMatches.length} partial match(es):\n`);
        partialMatches.forEach((v, i) => {
            console.log(`Match ${i + 1}:`);
            console.log(`  ID: ${v.id}`);
            console.log(`  Nullifier: ${v.nullifier_hash}`);
            console.log(`  Target:    ${searchNullifier}`);
            console.log(`  Status: ${v.status}\n`);
        });
    } else {
        console.log('❌ No partial matches found either.\n');
        
        console.log('All nullifiers in database:');
        allVaults.forEach((v, i) => {
            if (v.nullifier_hash) {
                console.log(`  ${i + 1}. ${v.nullifier_hash.substring(0, 30)}... (${v.status})`);
            }
        });
    }
}

db.close();
