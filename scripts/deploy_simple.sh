#!/bin/bash

# Simple 2-step manual deployment guide
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "════════════════════════════════════════════════════════════"
echo "STEP 1: Create Keystore (You'll need to paste the key)"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Private key to paste when asked:"
echo "0x71d7bb07b9a64f6f78ac4c816aff4da9"
echo ""
echo "Creating keystore..."

mkdir -p ~/.starkli-wallets/deployer

starkli signer keystore from-key ~/.starkli-wallets/deployer/keystore.json

# After keystore is created, create account file
cat > ~/.starkli-wallets/deployer/account.json << 'EOF'
{
  "version": 1,
  "variant": {
    "type": "open_zeppelin",
    "version": 1,
    "public_key": "0x39d9e6ce352ad4530a0ef5d5a18fd3303c3606a7fa6ac5b620020ad681cc33b"
  },
  "deployment": {
    "status": "deployed",
    "class_hash": "0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564",
    "address": "0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
  }
}
EOF

echo ""
echo "✅ Keystore and account set up!"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "STEP 2: Now run the declare command"
echo "════════════════════════════════════════════════════════════"
echo ""

# Build
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build

# Declare
echo ""
echo "Declaring MockBTC..."
starkli declare \
  --rpc https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/PoSTfSa4MmSbEbXRWyHoQ \
  --account ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json \
  target/dev/private_btc_core_MockBTC.contract_class.json
