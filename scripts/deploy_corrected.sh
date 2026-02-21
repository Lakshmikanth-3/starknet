#!/bin/bash

# CORRECT SOLUTION: Using sncast with updated snfoundry.toml configuration
set -e

echo "🚀 Deploying PrivateBTC contracts to Sepolia"
echo ""

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

# Build contracts
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Now sncast will use the configuration from snfoundry.toml
# which points to devnet_accounts.json with admin account
echo "📝 Declaring MockBTC..."
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account sepolia \
  declare \
  --contract-name MockBTC

echo ""
echo "✅ Declaration should complete above"
echo "If successful, copy the class_hash and continue with deployment"
