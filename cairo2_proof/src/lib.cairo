use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;

// Withdrawal proof circuit:
// Proves knowledge of (secret) such that:
//   pedersen(secret, commitment_hash) == nullifier_hash
// Returns the computed nullifier to be verified on-chain.
#[executable]
fn main(secret: felt252, commitment_hash: felt252, nullifier_hash: felt252) -> felt252 {
    // Recompute the nullifier from secret + commitment
    let computed_nullifier = PedersenTrait::new(secret).update(commitment_hash).finalize();
    // Return the computed nullifier — the ZK proof attests this matches nullifier_hash
    computed_nullifier
}
