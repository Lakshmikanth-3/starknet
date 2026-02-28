#!/bin/bash
export PATH="/home/sl/.asdf/installs/scarb/2.12.2/bin:/home/sl/.local/bin:/usr/bin:/bin:$PATH"
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/cairo2_proof
echo "Scarb version:"
scarb --version
echo ""
echo "Writing args..."
printf '["0xa77a50134bbbb1380604ce79b545a3b3648e0637be13c996630e0d2c9d084f", "0x0000000000000000000000000000000000000000000000000000000000000042"]' > /tmp/withdraw_args.json
cat /tmp/withdraw_args.json
echo ""
echo "Running scarb prove --execute..."
scarb prove --execute --arguments-file /tmp/withdraw_args.json 2>&1
echo "Exit code: $?"
