const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing CrynkPaymentSplitter Contract");
    console.log("========================================");

    // Get signers
    const [deployer, feeWallet, merchant, user] = await ethers.getSigners();
    
    console.log("👥 Test Accounts:");
    console.log("   Deployer:", deployer.address);
    console.log("   Fee Wallet:", feeWallet.address);
    console.log("   Merchant:", merchant.address);
    console.log("   User (payer):", user.address);

    // Contract address from deployment
    const splitterAddress = "0x76a999d5F7EFDE0a300e710e6f52Fb0A4b61aD58";
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC

    // Connect to contracts
    const splitter = await ethers.getContractAt("CrynkPaymentSplitter", splitterAddress);
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);

    console.log("\n🔍 Contract Info:");
    console.log("   Splitter:", splitterAddress);
    console.log("   USDC:", usdcAddress);
    console.log("   Fee Wallet:", await splitter.feeWallet());
    console.log("   Platform Fee Rate:", (await splitter.platformFeeRate()).toString());

    // Check user USDC balance
    const userBalance = await usdc.balanceOf(user.address);
    console.log("\n💰 Initial Balances:");
    console.log("   User USDC:", ethers.formatUnits(userBalance, 6));

    if (userBalance === 0n) {
        console.log("⚠️ User has no USDC balance. Please ensure USDC is transferred to test address");
        console.log("   You can run: npx hardhat run scripts/setup-usdc-fork.js --network localhost");
        return;
    }

    // Test amount (10 USDC)
    const testAmount = ethers.parseUnits("10.0", 6);
    
    // Calculate expected fees
    const [expectedPlatformFee, expectedMerchantAmount] = await splitter.calculateFees(testAmount);
    
    console.log("\n🧮 Expected Payment Breakdown:");
    console.log("   Total Amount:", ethers.formatUnits(testAmount, 6), "USDC");
    console.log("   Platform Fee:", ethers.formatUnits(expectedPlatformFee, 6), "USDC");
    console.log("   Merchant Amount:", ethers.formatUnits(expectedMerchantAmount, 6), "USDC");

    // Check if user has enough balance
    if (userBalance < testAmount) {
        console.log("❌ User doesn't have enough USDC for test");
        return;
    }

    try {
        // Connect as user
        const userSplitter = splitter.connect(user);
        const userUsdc = usdc.connect(user);

        // Check current allowance
        const currentAllowance = await userUsdc.allowance(user.address, splitterAddress);
        console.log("\n🔐 Current USDC allowance:", ethers.formatUnits(currentAllowance, 6));

        // Approve USDC if needed
        if (currentAllowance < testAmount) {
            console.log("📝 Approving USDC for splitter contract...");
            const approveTx = await userUsdc.approve(splitterAddress, testAmount);
            await approveTx.wait();
            console.log("✅ USDC approval confirmed");
        }

        // Record balances before payment
        const beforeBalances = {
            user: await usdc.balanceOf(user.address),
            feeWallet: await usdc.balanceOf(feeWallet.address),
            merchant: await usdc.balanceOf(merchant.address)
        };

        console.log("\n💰 Balances Before Payment:");
        console.log("   User:", ethers.formatUnits(beforeBalances.user, 6), "USDC");
        console.log("   Fee Wallet:", ethers.formatUnits(beforeBalances.feeWallet, 6), "USDC");
        console.log("   Merchant:", ethers.formatUnits(beforeBalances.merchant, 6), "USDC");

        // Generate unique payment ID
        const paymentId = ethers.keccak256(ethers.toUtf8Bytes(`test_payment_${Date.now()}`));

        // Execute split payment
        console.log("\n🚀 Executing split payment...");
        const splitTx = await userSplitter.splitPayment(
            paymentId,
            merchant.address,
            testAmount
        );

        const receipt = await splitTx.wait();
        console.log("✅ Payment completed! Transaction:", receipt.hash);

        // Check payment record
        const paymentRecord = await splitter.getPayment(paymentId);
        console.log("\n📋 Payment Record:");
        console.log("   ID:", paymentRecord.id);
        console.log("   User:", paymentRecord.user);
        console.log("   Merchant:", paymentRecord.merchant);
        console.log("   Total Amount:", ethers.formatUnits(paymentRecord.totalAmount, 6), "USDC");
        console.log("   Platform Fee:", ethers.formatUnits(paymentRecord.platformFee, 6), "USDC");
        console.log("   Merchant Amount:", ethers.formatUnits(paymentRecord.merchantAmount, 6), "USDC");
        console.log("   Completed:", paymentRecord.completed);

        // Record balances after payment
        const afterBalances = {
            user: await usdc.balanceOf(user.address),
            feeWallet: await usdc.balanceOf(feeWallet.address),
            merchant: await usdc.balanceOf(merchant.address)
        };

        console.log("\n💰 Balances After Payment:");
        console.log("   User:", ethers.formatUnits(afterBalances.user, 6), "USDC");
        console.log("   Fee Wallet:", ethers.formatUnits(afterBalances.feeWallet, 6), "USDC");
        console.log("   Merchant:", ethers.formatUnits(afterBalances.merchant, 6), "USDC");

        // Verify balance changes
        const userDecrease = beforeBalances.user - afterBalances.user;
        const feeIncrease = afterBalances.feeWallet - beforeBalances.feeWallet;
        const merchantIncrease = afterBalances.merchant - beforeBalances.merchant;

        console.log("\n📊 Balance Changes:");
        console.log("   User decrease:", ethers.formatUnits(userDecrease, 6), "USDC");
        console.log("   Fee wallet increase:", ethers.formatUnits(feeIncrease, 6), "USDC");
        console.log("   Merchant increase:", ethers.formatUnits(merchantIncrease, 6), "USDC");

        // Verify correct amounts
        const success = 
            userDecrease === testAmount &&
            feeIncrease === expectedPlatformFee &&
            merchantIncrease === expectedMerchantAmount;

        if (success) {
            console.log("\n🎉 TEST PASSED! Payment splitting worked correctly");
            console.log("✅ All balance changes match expected amounts");
        } else {
            console.log("\n❌ TEST FAILED! Balance changes don't match expected amounts");
        }

        // Parse event logs
        const splitterInterface = new ethers.Interface([
            "event PaymentSplit(bytes32 indexed paymentId, address indexed user, address indexed merchant, uint256 totalAmount, uint256 platformFee, uint256 merchantAmount)"
        ]);

        const logs = receipt.logs;
        for (const log of logs) {
            try {
                const parsed = splitterInterface.parseLog(log);
                if (parsed.name === 'PaymentSplit') {
                    console.log("\n🎯 PaymentSplit Event:");
                    console.log("   Payment ID:", parsed.args.paymentId);
                    console.log("   User:", parsed.args.user);
                    console.log("   Merchant:", parsed.args.merchant);
                    console.log("   Total Amount:", ethers.formatUnits(parsed.args.totalAmount, 6), "USDC");
                    console.log("   Platform Fee:", ethers.formatUnits(parsed.args.platformFee, 6), "USDC");
                    console.log("   Merchant Amount:", ethers.formatUnits(parsed.args.merchantAmount, 6), "USDC");
                }
            } catch (e) {
                // Not our event, skip
            }
        }

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }

    console.log("\n🏁 Test completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 