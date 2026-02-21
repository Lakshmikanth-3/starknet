#!/bin/bash

# Use the PREDEPLOYED account from devnet (no account file needed)
RPC_URL="http://127.0.0.1:5060"
ACCOUNT_ADDR="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
PRIVATE_KEY="0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"

# Already declared class hashes from previous run
MOCK_CLASS_HASH="0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b"
VAULT_CLASS_HASH="0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2"

echo "🚢 Deploying MockBTC..."
# Constructor: recipient address (using the account itself)
~/.starkli/bin/starkli invoke "$MOCK_CLASS_HASH" \
  --rpc "$RPC_URL" \
  --account "$ACCOUNT_ADDR" \
  --private-key "$PRIVATE_KEY" || echo "Deploy via invoke failed, trying UDC..."

# Alternative: Use Universal Deployer Contract (UDC) 
echo "Attempting deployment via transaction..."

# Just output the command for manual execution
echo ""
echo "📋 MANUAL DEPLOYMENT COMMANDS:"
echo ""
echo "1. Deploy MockBTC:"
echo "   Contract Class Hash: $MOCK_CLASS_HASH"
echo "   Constructor Args: $ACCOUNT_ADDR"
echo ""
echo "2. Deploy PrivateBTCVault:"  
echo "   Contract Class Hash: $VAULT_CLASS_HASH"
echo "   Constructor Args: [MockBTC_Address from step 1]"
echo ""
echo "💡 Use Voyager/Starkscan devnet explorer or starkli deploy command"
