#!/bin/bash
export PATH="/home/sl/.asdf/installs/scarb/2.12.2/bin:/home/sl/.local/bin:/usr/bin:/bin:$PATH"
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/cairo2_proof

printf '["0xa77a50134bbbb1380604ce79b545a3b3648e0637be13c996630e0d2c9d084f", "0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879", "0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879"]' > /tmp/withdraw3_args.json

echo "=== Running scarb prove --execute (capturing full output) ==="
OUTPUT=$(scarb prove --execute --arguments-file /tmp/withdraw3_args.json 2>&1)
echo "$OUTPUT"
echo ""
echo "=== Exit: $? ==="

# Try to find the proof path
PROOF_PATH=$(echo "$OUTPUT" | grep -i "proof" | grep -i "saving\|written\|output\|target" | head -1)
echo "=== Proof path line: $PROOF_PATH ==="

# List all proof files
echo "=== All proof files: ==="
find target/execute -name "proof.json" 2>/dev/null
echo "=== Newest: ==="
find target/execute -name "proof.json" 2>/dev/null | sort | tail -1
