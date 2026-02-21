import { poseidonHash } from 'micro-starknet'; // or similar library

/**
 * Generates a Poseidon hashlock from a preimage.
 * In Cairo 1, poseidon_hash_span(array![preimage].span()) is used.
 */
function generateHashlock(preimage: bigint): string {
    // Note: ensure preimage is a felt252 compatible value
    const hash = poseidonHash([preimage]);
    return '0x' + hash.toString(16);
}

const secretPreimage = BigInt("123456789123456789");
console.log("Preimage:", secretPreimage.toString());
console.log("Hashlock:", generateHashlock(secretPreimage));
