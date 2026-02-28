#!/bin/bash
set -e
export PATH="/home/sl/.asdf/installs/scarb/2.12.2/bin:/home/sl/.local/bin:/usr/bin:/bin:$PATH"

PROJECT="/mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/cairo2_proof"

SECRET="0xa77a50134bbbb1380604ce79b545a3b3648e0637be13c996630e0d2c9d084f"
COMMITMENT="0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879"
NULLIFIER="0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879"

ARGS_FILE="/tmp/e2e_withdraw_test.json"
printf '["%s", "%s", "%s"]' "$SECRET" "$COMMITMENT" "$NULLIFIER" > "$ARGS_FILE"

echo "=== Args file contents ==="
cat "$ARGS_FILE"
echo ""

echo "=== Running scarb prove --execute ==="
cd "$PROJECT"
scarb prove --execute --arguments-file "$ARGS_FILE" 2>&1
PROVE_EXIT=$?
echo ""
echo "=== Prove exit code: $PROVE_EXIT ==="

if [ $PROVE_EXIT -eq 0 ]; then
    PROOF_FILE=$(find "$PROJECT/target/execute" -name "proof.json" 2>/dev/null | sort | tail -1)
    echo "=== Newest proof.json: $PROOF_FILE ==="
    echo "=== Proof file size: $(wc -c < "$PROOF_FILE") bytes ==="
    echo "=== First 200 chars of proof: ==="
    head -c 200 "$PROOF_FILE"
    echo ""
    echo ""
    echo "SUCCESS: ZK proof generated successfully!"
else
    echo "FAILED: scarb prove returned non-zero exit code"
fi

rm -f "$ARGS_FILE"
