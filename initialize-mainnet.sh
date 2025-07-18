#!/bin/bash

# Initialize the Crynk Payment Splitter contract on Stellar MAINNET
set -e

# Configuration
CONTRACT_ADDRESS="CBQPFXE7TLM6KU3GXU43II7B5WK2OU4NOROS7NGXNBVQCSPGO5Z6KEBP"
NETWORK="mainnet"
ADMIN_ADDRESS="GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
FEE_WALLET="GASLZGE5HZXAOCVTVSLNFX44P53MT6BIJ4ZVB5WTOA4QTFMMGV27NEWE"
USDC_MAINNET="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
PLATFORM_FEE_RATE="100"  # 1% = 100 basis points

echo "🚀 Initializing Crynk Payment Splitter on Stellar MAINNET"
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Admin Address: $ADMIN_ADDRESS"
echo "Fee Wallet: $FEE_WALLET"
echo "USDC Token: $USDC_MAINNET"
echo "Platform Fee Rate: $PLATFORM_FEE_RATE basis points (1%)"
echo ""

# Initialize contract
echo "⚙️ Initializing contract..."
soroban contract invoke \
    --id $CONTRACT_ADDRESS \
    --source-account default \
    --network $NETWORK \
    -- \
    initialize \
    --admin $ADMIN_ADDRESS \
    --fee_wallet $FEE_WALLET \
    --token_address $USDC_MAINNET \
    --platform_fee_rate $PLATFORM_FEE_RATE

if [ $? -eq 0 ]; then
    echo "✅ Contract initialized successfully!"
    
    # Verify initialization
    echo "🔍 Verifying contract initialization..."
    
    echo "Checking fee wallet..."
    soroban contract invoke \
        --id $CONTRACT_ADDRESS \
        --source-account default \
        --network $NETWORK \
        -- \
        get_fee_wallet
    
    echo "Checking platform fee rate..."
    soroban contract invoke \
        --id $CONTRACT_ADDRESS \
        --source-account default \
        --network $NETWORK \
        -- \
        get_platform_fee_rate
    
    echo "✅ Contract is now ready for use!"
else
    echo "❌ Contract initialization failed"
    exit 1
fi 