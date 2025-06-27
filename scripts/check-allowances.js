const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking allowances...");
    
    // Get the contract addresses from the latest deployment
    const deploymentInfo = require("../deployment-fork-1750746880740.json");
    
    const userAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const paymentContractAddress = deploymentInfo.paymentContract;
    const usdcAddress = deploymentInfo.tokens.USDC;
    
    console.log("📋 Setup Info:");
    console.log("- User Address:", userAddress);
    console.log("- Payment Contract:", paymentContractAddress);
    console.log("- USDC Address:", usdcAddress);
    
    // Get contracts
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(paymentContractAddress);
    
    const USDC = await ethers.getContractAt("IERC20", usdcAddress);
    
    // Check USDC balance
    const balance = await USDC.balanceOf(userAddress);
    console.log("💰 USDC Balance:", ethers.formatUnits(balance, 6), "USDC");
    
    // Check ERC20 allowance
    const erc20Allowance = await USDC.allowance(userAddress, paymentContractAddress);
    console.log("🔓 ERC20 Allowance:", ethers.formatUnits(erc20Allowance, 6), "USDC");
    
    // Check delegated allowance
    const delegatedAllowance = await paymentContract.delegatedAllowances(userAddress, paymentContractAddress);
    console.log("🤝 Delegated Allowance:", ethers.formatUnits(delegatedAllowance, 18), "USD");
    
    // Calculate what's needed for a 10 USDC payment
    const orderAmount = ethers.parseUnits("10", 6); // 10 USDC
    const platformFee = orderAmount * 100n / 10000n; // 1% fee
    const totalRequired = orderAmount + platformFee;
    
    console.log("💸 For 10 USDC payment:");
    console.log("- Order amount:", ethers.formatUnits(orderAmount, 6), "USDC");
    console.log("- Platform fee:", ethers.formatUnits(platformFee, 6), "USDC");
    console.log("- Total required:", ethers.formatUnits(totalRequired, 6), "USDC");
    
    console.log("✅ Status:");
    console.log("- ERC20 allowance sufficient:", erc20Allowance >= totalRequired ? "✅" : "❌");
    console.log("- Delegated allowance sufficient:", delegatedAllowance >= ethers.parseUnits(ethers.formatUnits(totalRequired, 6), 18) ? "✅" : "❌");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 