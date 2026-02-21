#!/bin/bash

# Deploy MockBTC and PrivateBTCVault to Sepolia using sncast + RPC v0.10
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🚀 Deploying to Starknet Sepolia Testnet"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Wallet: 0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1"
echo "RPC: Alchemy v0.10 (compatible!)"
echo ""

# Build contracts with scarb 2.15.1
echo "📦 Building contracts..."
/home/sl/.asdf/installs/scarb/2.15.1/bin/scarb build
echo "✅ Build complete"
echo ""

# Declare MockBTC
echo "📝 Declaring MockBTC..."
MOCK_BTC_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account sepolia \
  declare \
  --url https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ \
  --contract-name MockBTC 2>&1)

echo "$MOCK_BTC_OUTPUT"

# Extract class hash
if echo "$MOCK_BTC_OUTPUT" | grep -q "class_hash"; then
    MOCK_BTC_CLASS_HASH=$(echo "$MOCK_BTC_OUTPUT" | grep -oP 'class_hash: 0x[0-9a-f]+' | head -1 | awk '{print $2}')
    echo ""
    echo "✅ MockBTC Class Hash: $MOCK_BTC_CLASS_HASH"
    echo ""
    
    # Deploy MockBTC
    echo "🚢 Deploying MockBTC..."
    MOCK_BTC_DEPLOY=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
      --account sepolia \
      deploy \
      --url https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ \
      --class-hash "$MOCK_BTC_CLASS_HASH" 2>&1)
    
    echo "$MOCK_BTC_DEPLOY"
    
    if echo "$MOCK_BTC_DEPLOY" | grep -q "contract_address"; then
        MOCK_BTC_ADDRESS=$(echo "$MOCK_BTC_DEPLOY" | grep -oP 'contract_address: 0x[0-9a-f]+' | awk '{print $2}')
        echo ""
        echo "✅ MockBTC Deployed: $MOCK_BTC_ADDRESS"
        echo ""
        
        # Declare PrivateBTCVault
        echo "📝 Declaring PrivateBTCVault..."
        VAULT_OUTPUT=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
          --account sepolia \
          declare \
          --url https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ \
          --contract-name PrivateBTCVault 2>&1)
        
        echo "$VAULT_OUTPUT"
        
        if echo "$VAULT_OUTPUT" | grep -q "class_hash"; then
            VAULT_CLASS_HASH=$(echo "$VAULT_OUTPUT" | grep -oP 'class_hash: 0x[0-9a-f]+' | head -1 | awk '{print $2}')
            echo ""
            echo "✅ PrivateBTCVault Class Hash: $VAULT_CLASS_HASH"
            echo ""
            
            # Deploy PrivateBTCVault with MockBTC address as constructor arg
            echo "🚢 Deploying PrivateBTCVault..."
            VAULT_DEPLOY=$(/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
              --account sepolia \
              deploy \
              --url https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/PoSTfSa4MmSbEbXRWyHoQ \
              --class-hash "$VAULT_CLASS_HASH" \
              --constructor-calldata "$MOCK_BTC_ADDRESS" 2>&1)
            
            echo "$VAULT_DEPLOY"
            
            if echo "$VAULT_DEPLOY" | grep -q "contract_address"; then
                VAULT_ADDRESS=$(echo "$VAULT_DEPLOY" | grep -oP 'contract_address: 0x[0-9a-f]+' | awk '{print $2}')
                
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "🎉 DEPLOYMENT COMPLETE!"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "📦 Contract Addresses:"
                echo "   MockBTC:          $MOCK_BTC_ADDRESS"
                echo "   PrivateBTCVault:  $VAULT_ADDRESS"
                echo ""
                echo "🔍 Voyager Links:"
                echo "   MockBTC:          https://sepolia.voyager.online/contract/$MOCK_BTC_ADDRESS"
                echo "   PrivateBTCVault:  https://sepolia.voyager.online/contract/$VAULT_ADDRESS"
                echo ""
                echo "📝 Update your backend .env file:"
                echo "   MOCK_BTC_ADDR=$MOCK_BTC_ADDRESS"
                echo "   VAULT_ADDR=$VAULT_ADDRESS"
                echo ""
                
                # Save deployment info
                cat > deployment-sepolia.json <<EOF
{
  "network": "starknet-sepolia",
  "deployedAt": "$(date -Iseconds)",
  "wallet": "0x0054078d8ca0fe77c572ad15021a8bcc85b84f30a56a4a4e9ff721a0ba012ef1",
  "contracts": {
    "MockBTC": {
      "classHash": "$MOCK_BTC_CLASS_HASH",
      "address": "$MOCK_BTC_ADDRESS",
      "voyagerUrl": "https://sepolia.voyager.online/contract/$MOCK_BTC_ADDRESS"
    },
    "PrivateBTCVault": {
      "classHash": "$VAULT_CLASS_HASH",
      "address": "$VAULT_ADDRESS",
      "voyagerUrl": "https://sepolia.voyager.online/contract/$VAULT_ADDRESS"
    }
  }
}
EOF
                
                echo "✅ Deployment info saved to deployment-sepolia.json"
            else
                echo "❌ Failed to deploy PrivateBTCVault"
                exit 1
            fi
        else
            echo "❌ Failed to declare PrivateBTCVault"
            exit 1
        fi
    else
        echo "❌ Failed to deploy MockBTC"
        exit 1
    fi
else
    echo "❌ Failed to declare MockBTC"
    echo "Check that your private key is correctly set in sepolia_account.json"
    exit 1
fi
