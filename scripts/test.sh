#!/bin/bash

# Test script for Crynk Payment Splitter Soroban Contract

set -e

echo "🧪 Testing Crynk Payment Splitter Contract"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if contract address exists
if [ ! -f "contract-address.txt" ]; then
    echo -e "${RED}❌ Contract address file not found. Please deploy the contract first.${NC}"
    exit 1
fi

CONTRACT_ADDRESS=$(cat contract-address.txt)
echo -e "${GREEN}📍 Using contract address: $CONTRACT_ADDRESS${NC}"

# Test configuration
NETWORK="testnet"
ADMIN_ADDRESS="GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"  # Replace with your admin address
FEE_WALLET="GFXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"    # Replace with fee wallet
MERCHANT_ADDRESS="GMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" # Replace with test merchant
TOKEN_ADDRESS="CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"   # Replace with USDC token address

# Function to invoke contract
invoke_contract() {
    local function_name=$1
    shift
    soroban contract invoke \
        --id $CONTRACT_ADDRESS \
        --source-account default \
        --network $NETWORK \
        -- \
        $function_name \
        "$@"
}

# Function to simulate contract call (read-only)
simulate_contract() {
    local function_name=$1
    shift
    soroban contract invoke \
        --id $CONTRACT_ADDRESS \
        --source-account default \
        --network $NETWORK \
        --simulate-only \
        -- \
        $function_name \
        "$@"
}

echo -e "${YELLOW}⚙️ Testing contract initialization...${NC}"
if [ -n "$ADMIN_ADDRESS" ] && [ -n "$FEE_WALLET" ] && [ -n "$TOKEN_ADDRESS" ]; then
    invoke_contract initialize \
        --admin $ADMIN_ADDRESS \
        --fee_wallet $FEE_WALLET \
        --token_address $TOKEN_ADDRESS \
        --platform_fee_rate 100
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Contract initialized successfully${NC}"
    else
        echo -e "${RED}❌ Contract initialization failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Skipping initialization - please set addresses in the script${NC}"
fi

echo -e "${YELLOW}📊 Testing contract getters...${NC}"

# Test get_platform_fee_rate
echo "Testing get_platform_fee_rate..."
simulate_contract get_platform_fee_rate

# Test get_payment_count
echo "Testing get_payment_count..."
simulate_contract get_payment_count

# Test get_fee_wallet
echo "Testing get_fee_wallet..."
simulate_contract get_fee_wallet

# Test get_token_address
echo "Testing get_token_address..."
simulate_contract get_token_address

echo -e "${YELLOW}💳 Testing payment split (simulation only)...${NC}"
if [ -n "$MERCHANT_ADDRESS" ]; then
    # Test split_payment
    echo "Testing split_payment with 1000 units..."
    simulate_contract split_payment \
        --payment_id "test-payment-123" \
        --merchant $MERCHANT_ADDRESS \
        --total_amount 1000
    
    # Test split_payment_fixed
    echo "Testing split_payment_fixed with 900 merchant + 100 fee..."
    simulate_contract split_payment_fixed \
        --payment_id "test-payment-456" \
        --merchant $MERCHANT_ADDRESS \
        --merchant_amount 900 \
        --platform_fee_amount 100
else
    echo -e "${YELLOW}⚠️ Skipping payment tests - please set MERCHANT_ADDRESS${NC}"
fi

echo -e "${GREEN}🎉 Contract testing completed!${NC}"
echo ""
echo "Available contract functions:"
echo "- initialize(admin, fee_wallet, token_address, platform_fee_rate)"
echo "- split_payment(payment_id, merchant, total_amount)"
echo "- split_payment_fixed(payment_id, merchant, merchant_amount, platform_fee_amount)"
echo "- get_payment(payment_id)"
echo "- get_payment_count()"
echo "- get_fee_wallet()"
echo "- get_platform_fee_rate()"
echo "- get_token_address()"
echo "- update_fee_wallet(new_fee_wallet) [admin only]"
echo "- update_platform_fee_rate(new_rate) [admin only]" 