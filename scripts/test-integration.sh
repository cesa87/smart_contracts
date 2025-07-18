#!/bin/bash

echo "🧪 Testing Stellar Payment Splitter Integration"
echo "=============================================="

CONTRACT_ID="CBQPFXE7TLM6KU3GXU43II7B5WK2OU4NOROS7NGXNBVQCSPGO5Z6KEBP"
ACCOUNT="alice"
NETWORK="testnet"

echo "📍 Contract Address: $CONTRACT_ID"
echo "🌐 Network: $NETWORK"
echo "👤 Account: $ACCOUNT"
echo ""

echo "1️⃣ Testing get_payment_count..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  -- get_payment_count

echo ""
echo "2️⃣ Testing initialize contract..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  --send=yes \
  -- initialize \
  --admin "$(soroban keys address $ACCOUNT)" \
  --platform_fee_rate 100 \
  --platform_wallet "$(soroban keys address $ACCOUNT)"

echo ""
echo "3️⃣ Testing get_payment_count after init..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  -- get_payment_count

echo ""
echo "4️⃣ Testing split_payment_fixed..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  --send=yes \
  -- split_payment_fixed \
  --payment_id "test_payment_001" \
  --merchant "$(soroban keys address $ACCOUNT)" \
  --merchant_amount 1000000 \
  --platform_fee_amount 10000

echo ""
echo "5️⃣ Testing get_payment_count after payment..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  -- get_payment_count

echo ""
echo "6️⃣ Testing get_payment details..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source-account $ACCOUNT \
  --network $NETWORK \
  -- get_payment \
  --payment_id "test_payment_001"

echo ""
echo "✅ Integration test complete!"
echo "🔗 View contract on Stellar Expert:"
echo "https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID" 