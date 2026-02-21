%builtins output pedersen

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.hash import hash2

// Step 1: Cairo 0 Commitment Program for SHARP
// Takes two private inputs (secret and salt) and outputs their Pedersen hash.
func main{output_ptr : felt*, pedersen_ptr : HashBuiltin*}() {
    alloc_locals;

    local secret : felt;
    local salt : felt;

    // Load inputs from program_input
    %{
        ids.secret = program_input['secret']
        ids.salt = program_input['salt']
    %}

    // Compute Pedersen hash of (secret, salt)
    let (commitment) = hash2{hash_ptr=pedersen_ptr}(secret, salt);

    // Output the commitment hash for on-chain verification
    assert [output_ptr] = commitment;
    let output_ptr = output_ptr + 1;

    return ();
}
