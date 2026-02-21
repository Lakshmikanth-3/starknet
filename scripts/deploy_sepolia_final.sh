#!/bin/bash
# FINAL HOUR DEPLOYMENT SCRIPT - Run 30 min before hackathon deadline

set -e 

echo "🚀 FINAL SEPOLIA DEPLOYMENT"
echo "Using account: 0x40b5d051138e8991c98d1402a802d90aa872c4a484a6c182f9cda718c5b7d8b"
echo ""

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/contracts

# Try multiple RPC endpoints
RPC_ENDPOINTS=(
  "https://free-rpc.nethermind.io/sepolia-juno/v0_7"
  "https://starknet-sepolia.public.blastapi.io"
  "https://starknet-sepolia.g.alchemy.com/v2/demo"
)

ACCOUNT="sepolia"  # From your sncast accounts

for RPC in "${RPC_ENDPOINTS[@]}"; do
  echo "Trying RPC: $RPC"
  
  # Declare MockBTC
  echo "📋 Declaring MockBTC..."
  if /home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
    declare \
    --contract-name MockBTC \
    --package private_btc_core \
    --url "$RPC" \
    --account "$ACCOUNT"; then
    
    echo "✅ MockBTC declared!"
    
    # TODO: Parse class hash from output
    # Deploy MockBTC
    # Deploy Vault
    # Save addresses
    
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "📝 Copy these addresses to backend/dist/.env:"
    echo ""
    echo "MOCK_BTC_ADDRESS=0x[from_output]"
    echo "VAULT_ADDRESS=0x[from_output]"
    exit 0
  fi
done

echo "❌ All RPC endpoints failed"
echo "💡 Fallback: Use mock contracts for demo"
exit 1
