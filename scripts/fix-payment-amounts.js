const { ethers } = require("hardhat");

async function main() {
    console.log("🔧 Fixing payment amount issues...");
    
    // Get the contract addresses from the latest deployment
    const deploymentInfo = require("../deployment-fork-1750746880740.json");
    
    // The payment ID from the error logs
    const paymentId = "0xb68332602332770332a3030c5d3bb752e1474b61316c1d725032bc30cbee4641";
    const paymentContractAddress = deploymentInfo.paymentContract;
    
    console.log("📋 Setup Info:");
    console.log("- Payment ID:", paymentId);
    console.log("- Payment Contract:", paymentContractAddress);
    
    // Get contract instance
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(paymentContractAddress);
    
    // Check payment details
    const payment = await paymentContract.payments(paymentId);
    
    console.log("💳 Payment Details:");
    console.log("- Total Amount (18 decimals):", ethers.formatUnits(payment.totalAmount, 18), "USD");
    console.log("- Platform Fee (18 decimals):", ethers.formatUnits(payment.platformFee, 18), "USD");
    
    // The issue: platform fee in 18 decimals but USDC token in 6 decimals
    // Platform fee: 0.1 USD = 100000000000000000 (18 decimals)
    // Should be: 0.1 USDC = 100000 (6 decimals)
    
    const platformFeeInUSD = ethers.formatUnits(payment.platformFee, 18);
    const platformFeeInUSDC = ethers.parseUnits(platformFeeInUSD, 6);
    
    console.log("🔄 Conversion:");
    console.log("- Platform fee in USD (18 decimals):", payment.platformFee.toString());
    console.log("- Platform fee in USDC (6 decimals):", platformFeeInUSDC.toString());
    console.log("- Conversion factor:", (payment.platformFee / platformFeeInUSDC).toString());
    
    // Check user's actual USDC balance to see if the transfer is feasible
    const USDC = await ethers.getContractAt("IERC20", deploymentInfo.tokens.USDC);
    const userBalance = await USDC.balanceOf(payment.user);
    
    console.log("💰 User Balance Check:");
    console.log("- User's USDC balance:", ethers.formatUnits(userBalance, 6), "USDC");
    console.log("- Trying to transfer (wrong):", ethers.formatUnits(payment.platformFee, 6), "USDC");
    console.log("- Should transfer (correct):", ethers.formatUnits(platformFeeInUSDC, 6), "USDC");
    
    if (payment.platformFee > userBalance) {
        console.log("❌ ERROR: Contract is trying to transfer more USDC than user has!");
        console.log("- This is because platform fee is in 18 decimals but being transferred as 6 decimals");
        console.log("- Platform fee should be:", ethers.formatUnits(platformFeeInUSDC, 6), "USDC");
        console.log("- But contract is trying to transfer:", ethers.formatUnits(payment.platformFee, 6), "USDC");
    } else {
        console.log("✅ User has sufficient balance for the transfer");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 