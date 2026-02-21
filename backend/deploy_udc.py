#!/usr/bin/env python3
import json
import requests
from hashlib import sha256

RPC_URL = "http://127.0.0.1:5060"
ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"

# Declared class hashes
MOCK_CLASS_HASH = "0x04dbf6009feb48d7a1100d9c5aeb7607f7dfc02d8f984fe7f8ac8d7d79a5189b"
VAULT_CLASS_HASH = "0x067f2255713ea2c7abdafcfa8978013c0856e2f77841432e1b9598a66b0df9a2"

# Universal Deployer Contract Address (standard on all networks)
UDC_ADDRESS = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"

def deploy_contract(class_hash, constructor_calldata, salt="0x0"):
    """Deploy a contract via UDC"""
    
    # UDC deployContract parameters:
    # classHash, salt, unique, calldata
    calldata = [
        class_hash,
        salt,
        "0x0",  # unique = false
        str(len(constructor_calldata)),  # calldata length
        *constructor_calldata
    ]
    
    # Just use starkli for simplicity
    import subprocess
    cmd = [
        "wsl", 
        "/home/sl/.starkli/bin/starkli",
        "invoke",
        UDC_ADDRESS,
        "deployContract",
        *calldata,
        "--rpc", RPC_URL,
        "--account", ACCOUNT_ADDRESS,
        "--private-key", PRIVATE_KEY
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)
    return result

print("🚢 Deploying MockBTC...")
result = deploy_contract(MOCK_CLASS_HASH, [ACCOUNT_ADDRESS])

print("\n📝 Check transaction on devnet and get contract address")
print("Then deploy vault with that address as constructor arg")
