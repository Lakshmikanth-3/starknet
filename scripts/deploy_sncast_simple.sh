#!/bin/bash

# Simple alternative deployment using sncast from config
set -e

cd /mnt/c/Users/sl/OneDrive/Documents/Hackathons/starknet/private_btc_core

echo "🚀 Attempting deployment with sncast using config..."
echo ""

# Try using the config file directly (without --url override)
/home/sl/.asdf/installs/starknet-foundry/0.56.0/bin/sncast \
  --account sepolia \
  declare \
  --contract-name MockBTC
