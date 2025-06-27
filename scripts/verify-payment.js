const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Verifying Payment Status on Blockchain");
    console.log("========================================");
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // USDC contract address (mainnet/forked mainnet)
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    
    // Your wallet address (the one that made the payment)
    const USER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    
    // Platform fee wallet (where fees should go)
    const FEE_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Second hardhat account
    
    // Merchant wallet (where merchant amount should go)
    const MERCHANT_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Third hardhat account
    
    // USDC contract ABI (minimal)
    const USDC_ABI = [
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
    
    try {
        // Connect to USDC contract
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, ethers.provider);
        const decimals = await usdcContract.decimals();
        
        console.log(`💰 USDC Contract: ${USDC_ADDRESS}`);
        console.log(`🔢 Decimals: ${decimals}`);
        
        // Check balances
        console.log("\n📊 Current USDC Balances:");
        console.log("========================");
        
        const userBalance = await usdcContract.balanceOf(USER_ADDRESS);
        const feeWalletBalance = await usdcContract.balanceOf(FEE_WALLET);
        const merchantWalletBalance = await usdcContract.balanceOf(MERCHANT_WALLET);
        
        console.log(`👤 User (${USER_ADDRESS.slice(0,6)}...${USER_ADDRESS.slice(-4)}): ${ethers.formatUnits(userBalance, decimals)} USDC`);
        console.log(`💼 Fee Wallet (${FEE_WALLET.slice(0,6)}...${FEE_WALLET.slice(-4)}): ${ethers.formatUnits(feeWalletBalance, decimals)} USDC`);
        console.log(`🏪 Merchant (${MERCHANT_WALLET.slice(0,6)}...${MERCHANT_WALLET.slice(-4)}): ${ethers.formatUnits(merchantWalletBalance, decimals)} USDC`);
        
        // Get recent Transfer events to/from user address
        console.log("\n📝 Recent USDC Transfer Events:");
        console.log("===============================");
        
        const currentBlock = await ethers.provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks
        
        // Get transfers FROM user (payments made)
        const transfersFrom = await usdcContract.queryFilter(
            usdcContract.filters.Transfer(USER_ADDRESS, null),
            fromBlock,
            currentBlock
        );
        
        // Get transfers TO user (payments received)
        const transfersTo = await usdcContract.queryFilter(
            usdcContract.filters.Transfer(null, USER_ADDRESS),
            fromBlock,
            currentBlock
        );
        
        console.log(`\n🔴 Outgoing Transfers (Last ${transfersFrom.length} transactions):`);
        for (const event of transfersFrom.slice(-5)) { // Show last 5
            const block = await ethers.provider.getBlock(event.blockNumber);
            const timestamp = new Date(block.timestamp * 1000).toLocaleString();
            console.log(`   📤 ${ethers.formatUnits(event.args.value, decimals)} USDC to ${event.args.to.slice(0,6)}...${event.args.to.slice(-4)} (Block: ${event.blockNumber}, ${timestamp})`);
        }
        
        console.log(`\n🟢 Incoming Transfers (Last ${transfersTo.length} transactions):`);
        for (const event of transfersTo.slice(-5)) { // Show last 5
            const block = await ethers.provider.getBlock(event.blockNumber);
            const timestamp = new Date(block.timestamp * 1000).toLocaleString();
            console.log(`   📥 ${ethers.formatUnits(event.args.value, decimals)} USDC from ${event.args.from.slice(0,6)}...${event.args.from.slice(-4)} (Block: ${event.blockNumber}, ${timestamp})`);
        }
        
        // Check if any payments match our expected amounts
        console.log("\n🔍 Payment Verification:");
        console.log("========================");
        
        const expectedTotal = ethers.parseUnits("10.10", decimals); // ~$10.10 total payment
        const expectedFee = ethers.parseUnits("0.10", decimals);    // ~$0.10 platform fee
        const expectedMerchant = ethers.parseUnits("10.00", decimals); // ~$10.00 to merchant
        
        // Look for payments matching our amounts in recent transfers
        const recentPayments = transfersFrom.filter(event => {
            const amount = event.args.value;
            return amount >= expectedFee && amount <= expectedTotal; // Any payment in our range
        });
        
        if (recentPayments.length > 0) {
            console.log("✅ Found recent payments that could match your transaction:");
            for (const payment of recentPayments) {
                const block = await ethers.provider.getBlock(payment.blockNumber);
                const timestamp = new Date(block.timestamp * 1000).toLocaleString();
                console.log(`   💸 ${ethers.formatUnits(payment.args.value, decimals)} USDC to ${payment.args.to.slice(0,6)}...${payment.args.to.slice(-4)}`);
                console.log(`      📅 Time: ${timestamp}`);
                console.log(`      🧾 Tx Hash: ${payment.transactionHash}`);
            }
        } else {
            console.log("❌ No payments found matching expected amounts ($0.10 - $10.10)");
            console.log("💡 This confirms the payment was simulated, not actual blockchain transfer");
        }
        
        console.log("\n📋 Summary:");
        console.log("===========");
        if (recentPayments.length === 0) {
            console.log("🔸 Status: SIMULATED PAYMENT");
            console.log("🔸 No actual USDC transfers found matching your payment");
            console.log("🔸 The success message was from the API response, not blockchain");
            console.log("🔸 To make real payments, you need to implement actual token transfers");
        } else {
            console.log("🔸 Status: REAL PAYMENT DETECTED");
            console.log("🔸 Found blockchain transactions matching payment amounts");
            console.log("🔸 Verify the transaction hashes above to confirm");
        }
        
    } catch (error) {
        console.error("❌ Error verifying payment:", error.message);
        
        if (error.message.includes("could not detect network")) {
            console.log("\n💡 Troubleshooting:");
            console.log("- Make sure your hardhat fork is running on port 8545");
            console.log("- Run: npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 