// Test if user's withdrawal secret matches one of the vaults without nullifier
const { hash } = require('starknet');

const userSecret = '0x5e8e5cce7e68e2c8d8e1abda60d10eaef3825aba41b721d89442aa0485bF3';
const userNullifier = '0xfd18c853786bf4923be131056d3a2cf1017bf2861962927d541d161c5bc3e6';

const vault1Commitment = '0x30566d6c44793f19b4825380c00030d664968edf94188d5a74db36fdf17a42b';
const vault2Commitment = '0x35786dc770ed9ecfe7fa0a7e6688c8b9fd707139d4b955bc7f3a0146f5a420f';

console.log('\n=== TESTING USER SECRET AGAINST VAULTS WITHOUT NULLIFIER ===\n');
console.log(`User's secret: ${userSecret}`);
console.log(`User's nullifier: ${userNullifier}\n`);

function testVault(vaultNum, commitment) {
    console.log(`\nVault ${vaultNum}: ${commitment}`);
    
    // Compute nullifier from commitment + secret
    const computedNullifier = hash.computePedersenHash(commitment, userSecret);
    console.log(`  Computed nullifier: ${computedNullifier}`);
    console.log(`  User's nullifier:   ${userNullifier}`);
    
    const matches = computedNullifier.toLowerCase() === userNullifier.toLowerCase();
    console.log(`  Match: ${matches ? '✅ YES' : '❌ NO'}`);
    
    return  { matches, computedNullifier };
}

const result1 = testVault(1, vault1Commitment);
const result2 = testVault(2, vault2Commitment);

if (result1.matches) {
    console.log(`\n✅ MATCH FOUND! Vault 1 corresponds to the user's withdrawal secret.`);
    console.log(`   Vault ID: efecb516-c4d2-441f-b085-129b2809d946`);
    console.log(`   Commitment: ${vault1Commitment}`);
    console.log(`   Nullifier to backfill: ${result1.computedNullifier}\n`);
} else if (result2.matches) {
    console.log(`\n✅ MATCH FOUND! Vault 2 corresponds to the user's withdrawal secret.`);
    console.log(`   Vault ID: 561b25e9-ad40-462a-b536-8fdfe156304d`);
    console.log(`   Commitment: ${vault2Commitment}`);
    console.log(`   Nullifier to backfill: ${result2.computedNullifier}\n`);
} else {
    console.log(`\n❌ NO MATCH: The user's secret doesn't match either vault without nullifier.`);
    console.log(`   This means the user may be trying to withdraw from a different vault,`);
    console.log(`   or the secret was computed differently.\n`);
}
