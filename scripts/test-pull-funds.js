const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing pullFunds function manually...");
    
    // Get the contract addresses from the latest deployment
    const deploymentInfo = require("../deployment-fork-1750749418587.json");
    
    // The payment ID from the error logs
    const paymentId = "0xd07b23a90859a3bf541795223dfa576c9cde90093187752642447c45439fb2cd";
    const paymentContractAddress = deploymentInfo.paymentContract;
    const userAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const usdcAddress = deploymentInfo.tokens.USDC;
    
    console.log("📋 Test Setup:");
    console.log("- Payment ID:", paymentId);
    console.log("- Payment Contract:", paymentContractAddress);
    console.log("- User Address:", userAddress);
    console.log("- USDC Address:", usdcAddress);
    
    // Get signers
    const [deployer] = await ethers.getSigners();
    console.log("- Deployer (calling pullFunds):", await deployer.getAddress());
    
    // Get contract instances
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(paymentContractAddress);
    
    const USDC = await ethers.getContractAt("IERC20", usdcAddress);
    
    try {
        // 1. Check payment details
        const payment = await paymentContract.payments(paymentId);
        console.log("\n💳 Payment Details:");
        console.log("- Total Amount (18 decimals):", ethers.formatUnits(payment.totalAmount, 18), "USD");
        console.log("- Platform Fee (18 decimals):", ethers.formatUnits(payment.platformFee, 18), "USD");
        console.log("- Status:", payment.status.toString());
        
        // 2. Calculate what the contract will try to transfer
        const platformFeeInUSD = ethers.formatUnits(payment.platformFee, 18);
        const platformFeeInUSDC = ethers.parseUnits(platformFeeInUSD, 6);
        const convertedFee = payment.platformFee / 1000000000000n; // Divide by 10^12 as in contract
        
        console.log("\n🔄 Fee Conversion Analysis:");
        console.log("- Platform fee (18 decimals):", payment.platformFee.toString());
        console.log("- Converted to USDC (6 decimals):", convertedFee.toString());
        console.log("- Should be (manual calc):", platformFeeInUSDC.toString());
        console.log("- Match?", convertedFee.toString() === platformFeeInUSDC.toString() ? "✅" : "❌");
        
        // 3. Check balances and allowances
        const userBalance = await USDC.balanceOf(userAddress);
        const erc20Allowance = await USDC.allowance(userAddress, paymentContractAddress);
        const delegatedAllowance = await paymentContract.delegatedAllowances(userAddress, paymentContractAddress);
        
        console.log("\n💰 Balances & Allowances:");
        console.log("- User USDC balance:", ethers.formatUnits(userBalance, 6), "USDC");
        console.log("- ERC20 allowance:", ethers.formatUnits(erc20Allowance, 6), "USDC");
        console.log("- Delegated allowance:", ethers.formatUnits(delegatedAllowance, 18), "USD");
        
        // 4. Check if user has enough for the converted fee
        console.log("\n🎯 Transfer Feasibility:");
        console.log("- Contract will try to transfer:", ethers.formatUnits(convertedFee, 6), "USDC as platform fee");
        console.log("- User has sufficient balance?", userBalance >= convertedFee ? "✅" : "❌");
        console.log("- ERC20 allowance sufficient?", erc20Allowance >= convertedFee ? "✅" : "❌");
        
        // 5. Check token payments array - need to access the payment struct data more directly
        console.log("\n📦 Token Payments Analysis:");
        
        try {
            // Try to access payment data to understand tokenPayments
            // We need to call getPayment if it exists, or analyze the payment creation
            
            console.log("- Trying to analyze token payment amounts...");
            
            // The issue might be that tokenPayments amounts are in 18 decimals (USD) but being treated as USDC (6 decimals)
            // If payment.totalAmount is 10 USD (10 * 10^18), and it's stored as token amount,
            // the contract would try to transfer 10 * 10^18 USDC units instead of 10 * 10^6 USDC units
            
            const totalAmountInWei = payment.totalAmount;
            const totalAmountAsUSDC = totalAmountInWei / 1000000000000n; // Convert 18 decimals to 6 decimals
            
            console.log("- Payment total amount (18 decimals):", totalAmountInWei.toString());
            console.log("- If used as USDC amount (6 decimals):", ethers.formatUnits(totalAmountAsUSDC, 6), "USDC");
            console.log("- User has enough for this amount?", userBalance >= totalAmountAsUSDC ? "✅" : "❌");
            console.log("- ERC20 allowance enough for this amount?", erc20Allowance >= totalAmountAsUSDC ? "✅" : "❌");
            
            // Calculate total required (platform fee + token amount)
            const totalRequired = convertedFee + totalAmountAsUSDC;
            console.log("\n💸 Total Transfer Analysis:");
            console.log("- Platform fee to transfer:", ethers.formatUnits(convertedFee, 6), "USDC");
            console.log("- Token amount to transfer:", ethers.formatUnits(totalAmountAsUSDC, 6), "USDC");
            console.log("- Total required:", ethers.formatUnits(totalRequired, 6), "USDC");
            console.log("- User balance sufficient?", userBalance >= totalRequired ? "✅" : "❌");
            console.log("- ERC20 allowance sufficient?", erc20Allowance >= totalRequired ? "✅" : "❌");
            
            if (erc20Allowance < totalRequired) {
                console.log("❌ FOUND THE ISSUE: ERC20 allowance is insufficient for total required transfer!");
                console.log("- Need:", ethers.formatUnits(totalRequired, 6), "USDC");
                console.log("- Have:", ethers.formatUnits(erc20Allowance, 6), "USDC");
                console.log("- Shortage:", ethers.formatUnits(totalRequired - erc20Allowance, 6), "USDC");
            }
            
        } catch (error) {
            console.log("- Error analyzing token payments:", error.message);
        }
        
        // 6. Check authorization
        const isAuthorized = await paymentContract.authorizedDelegates(await deployer.getAddress());
        console.log("\n🔑 Authorization:");
        console.log("- Deployer is authorized delegate:", isAuthorized ? "✅" : "❌");
        
        if (!isAuthorized) {
            console.log("❌ ERROR: Deployer is not authorized to call pullFunds!");
            return;
        }
        
        // 7. Try to call pullFunds
        console.log("\n🚀 Attempting pullFunds call...");
        
        try {
            // First, let's try a dry run
            const gasEstimate = await paymentContract.pullFunds.estimateGas(paymentId);
            console.log("- Gas estimate:", gasEstimate.toString());
            
            // Now try the actual call
            const tx = await paymentContract.pullFunds(paymentId);
            const receipt = await tx.wait();
            
            console.log("✅ SUCCESS! pullFunds executed successfully");
            console.log("- Transaction hash:", receipt.hash);
            console.log("- Block number:", receipt.blockNumber);
            
        } catch (error) {
            console.log("❌ FAILED! pullFunds call failed:");
            console.log("- Error:", error.message);
            
            // Try to decode the error
            if (error.data) {
                console.log("- Error data:", error.data);
            }
        }
        
    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 