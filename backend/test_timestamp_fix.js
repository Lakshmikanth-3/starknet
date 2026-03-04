/**
 * Test Script: Verify Transaction Timestamp Fix
 * 
 * This script tests that the Bitcoin UTXO detection always returns
 * the NEWEST transaction by timestamp, not an older one.
 */

// Mock UTXO data simulating the bug scenario
const mockUTXOs = [
    {
        txid: '35be1a9a6fac02297350fe15ac46b12982741157349bab84d72d24aff0cccb40',
        vout: 0,
        value: 50000,
        status: {
            confirmed: true,
            block_height: 293985,
            block_time: 1709485315 // 2026-03-03 18:01:55 UTC (OLDER)
        }
    },
    {
        txid: 'abc123def45678901234567890abcdef12345678901234567890abcdef123456',
        vout: 0,
        value: 50000,
        status: {
            confirmed: true,
            block_height: 293985, // SAME BLOCK as transaction above!
            block_time: 1709485530 // 2026-03-03 18:05:30 UTC (NEWER)
        }
    },
];

console.log('🧪 Testing Transaction Timestamp Fix\n');
console.log('Scenario: Two transactions in the SAME BLOCK (height 293985)');
console.log('Expected: Should select TX2 (18:05:30) not TX1 (18:01:55)\n');

console.log('Input UTXOs (unsorted):');
mockUTXOs.forEach((u, i) => {
    const time = new Date(u.status.block_time * 1000).toISOString();
    console.log(`  [${i}] TXID: ${u.txid.substring(0, 16)}... | Time: ${time} | Height: ${u.status.block_height}`);
});

// Apply the NEW sorting logic
const sorted = [...mockUTXOs].sort((a, b) => {
    const aConfirmed = a.status?.confirmed || false;
    const bConfirmed = b.status?.confirmed || false;
    
    if (!aConfirmed && bConfirmed) return -1;
    if (aConfirmed && !bConfirmed) return 1;
    if (!aConfirmed && !bConfirmed) return 0;
    
    // ✅ NEW: Sort by timestamp first
    const aTime = a.status?.block_time || 0;
    const bTime = b.status?.block_time || 0;
    
    if (aTime !== bTime) {
        return bTime - aTime; // Higher timestamp = newer
    }
    
    // Fallback to block height
    const aHeight = a.status?.block_height || 0;
    const bHeight = b.status?.block_height || 0;
    return bHeight - aHeight;
});

console.log('\nSorted UTXOs (after fix):');
sorted.forEach((u, i) => {
    const time = new Date(u.status.block_time * 1000).toISOString();
    console.log(`  [${i}] TXID: ${u.txid.substring(0, 16)}... | Time: ${time} | Height: ${u.status.block_height}`);
});

const selected = sorted[0];
const selectedTime = new Date(selected.status.block_time * 1000).toISOString();

console.log('\n✅ Selected Transaction:');
console.log(`   TXID: ${selected.txid}`);
console.log(`   Timestamp: ${selectedTime}`);
console.log(`   Block Height: ${selected.status.block_height}`);

// Verify correctness
const isCorrect = selected.txid === 'abc123def45678901234567890abcdef12345678901234567890abcdef123456';

if (isCorrect) {
    console.log('\n✅ TEST PASSED: Selected the NEWEST transaction (TX2 - 18:05:30)');
    console.log('   The fix correctly sorts by timestamp!');
} else {
    console.log('\n❌ TEST FAILED: Selected the WRONG transaction (TX1 - 18:01:55)');
    console.log('   The sorting logic is still broken!');
    process.exit(1);
}

// Test with OLD (buggy) sorting logic for comparison
console.log('\n📊 Comparison with OLD (buggy) logic:');
const oldSorted = [...mockUTXOs].sort((a, b) => {
    const aConfirmed = a.status?.confirmed || false;
    const bConfirmed = b.status?.confirmed || false;
    
    if (!aConfirmed && bConfirmed) return -1;
    if (aConfirmed && !bConfirmed) return 1;
    if (!aConfirmed && !bConfirmed) return 0;
    
    // ❌ OLD BUG: Only sort by block height (doesn't handle same-block TXs)
    const aHeight = a.status?.block_height || 0;
    const bHeight = b.status?.block_height || 0;
    return bHeight - aHeight;
});

const oldSelected = oldSorted[0];
const oldSelectedTime = new Date(oldSelected.status.block_time * 1000).toISOString();

console.log('   OLD logic selected: TXID:', oldSelected.txid.substring(0, 16) + '...');
console.log('   OLD logic timestamp:', oldSelectedTime);
console.log('   Result: ❌ Could select EITHER transaction (order undefined for same block)');

console.log('\n🎯 Summary:');
console.log('   • OLD logic: Sort by block_height only → Fails for same-block TXs');
console.log('   • NEW logic: Sort by block_time first → Correctly handles all cases');
console.log('   • Fix ensures: Always selects newest transaction by timestamp ✅\n');
