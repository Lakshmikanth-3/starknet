#!/bin/bash
export PATH="/home/sl/.asdf/installs/scarb/2.12.2/bin:/home/sl/.local/bin:/usr/bin:/bin:$PATH"
cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/cairo2_proof

printf '["0xa77a50134bbbb1380604ce79b545a3b3648e0637be13c996630e0d2c9d084f", "0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879", "0x170742102eeb1ed0d841ef87ed26059e9375d8bbe94515fa053e96074d6879"]' > /tmp/withdraw3_args.json

OUTPUT=$(scarb prove --execute --arguments-file /tmp/withdraw3_args.json 2>&1)
echo "FULL OUTPUT START"
echo "$OUTPUT"
echo "FULL OUTPUT END"
