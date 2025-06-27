const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking payment details...");
    
    // Get the contract addresses from the latest deployment
    const deploymentInfo = require("../deployment-fork-1750749418587.json");
    
    // The payment ID from the error logs
    const paymentId = "0xd07b23a90859a3bf541795223dfa576c9cde90093187752642447c45439fb2cd";
    const paymentContractAddress = deploymentInfo.paymentContract;
    
    console.log("📋 Setup Info:");
    console.log("- Payment ID:", paymentId);
    console.log("- Payment Contract:", paymentContractAddress);
    
    // Get contract instance
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(paymentContractAddress);
    
    try {
        // Check if payment exists
        const payment = await paymentContract.payments(paymentId);
        
        console.log("💳 Payment Details:");
        console.log("- ID:", payment.id);
        console.log("- User:", payment.user);
        console.log("- Merchant ID:", payment.merchantId.toString());
        console.log("- Total Amount:", ethers.formatUnits(payment.totalAmount, 18), "USD");
        console.log("- Platform Fee:", ethers.formatUnits(payment.platformFee, 18), "USD");
        console.log("- Status:", payment.status.toString());
        console.log("- Timestamp:", new Date(Number(payment.timestamp) * 1000).toISOString());
        
        if (payment.id === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            console.log("❌ Payment not found in contract!");
        } else {
            console.log("✅ Payment found in contract");
            
            // Check user's current allowances
            const userAddress = payment.user;
            console.log("👤 User Address:", userAddress);
            
            // Check ERC20 allowance for this user
            const USDC = await ethers.getContractAt("IERC20", deploymentInfo.tokens.USDC);
            const erc20Allowance = await USDC.allowance(userAddress, paymentContractAddress);
            console.log("🔓 User's ERC20 Allowance:", ethers.formatUnits(erc20Allowance, 6), "USDC");
            
            // Check delegated allowance for this user
            const delegatedAllowance = await paymentContract.delegatedAllowances(userAddress, paymentContractAddress);
            console.log("🤝 User's Delegated Allowance:", ethers.formatUnits(delegatedAllowance, 18), "USD");
        }
    } catch (error) {
        console.error("❌ Error checking payment:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 