const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("🚀 Deploying CrynkPaymentSplitter Contract");
    console.log("==========================================");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    // Get account balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("🌐 Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");

    // Fee wallet address (use deployer for now)
    const FEE_WALLET = deployer.address;
    
    // USDC address for Sepolia testnet
    const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    
    console.log("💼 Fee wallet address:", FEE_WALLET);
    console.log("💰 USDC address:", USDC_ADDRESS);

    try {
        // Deploy CrynkPaymentSplitter
        console.log("\n🔄 Deploying CrynkPaymentSplitter...");
        const CrynkPaymentSplitter = await ethers.getContractFactory("CrynkPaymentSplitter");
        const splitter = await CrynkPaymentSplitter.deploy(FEE_WALLET, USDC_ADDRESS);
        await splitter.waitForDeployment();

        const splitterAddress = await splitter.getAddress();
        console.log("✅ CrynkPaymentSplitter deployed to:", splitterAddress);

        // Verify deployment by calling some read functions
        console.log("\n🔍 Verifying deployment...");
        const feeWallet = await splitter.feeWallet();
        const feeRate = await splitter.platformFeeRate();
        const usdcAddress = await splitter.usdcAddress();

        console.log("📋 Contract verification:");
        console.log("   - Fee Wallet:", feeWallet);
        console.log("   - Platform Fee Rate:", feeRate.toString(), "(1% = 100)");
        console.log("   - USDC Address:", usdcAddress);

        // Test fee calculation
        const testAmount = ethers.parseUnits("10.0", 6); // 10 USDC
        const [platformFee, merchantAmount] = await splitter.calculateFees(testAmount);
        
        console.log("\n🧮 Fee calculation test (10 USDC):");
        console.log("   - Platform Fee:", ethers.formatUnits(platformFee, 6), "USDC");
        console.log("   - Merchant Amount:", ethers.formatUnits(merchantAmount, 6), "USDC");

        // Save deployment info
        const deploymentInfo = {
            network: network.name,
            chainId: network.chainId.toString(),
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: {
                CrynkPaymentSplitter: {
                    address: splitterAddress,
                    feeWallet: feeWallet,
                    feeRate: feeRate.toString(),
                    usdcAddress: usdcAddress
                }
            },
            transactionHashes: {
                splitter: splitter.deploymentTransaction()?.hash
            }
        };

        const filename = `deployment-splitter-${network.name}-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\n💾 Deployment info saved to: ${filename}`);

        console.log("\n🎉 Deployment completed successfully!");
        console.log("📋 Summary:");
        console.log(`   📄 CrynkPaymentSplitter: ${splitterAddress}`);
        console.log(`   💼 Fee Wallet: ${feeWallet}`);
        console.log(`   📊 Platform Fee: ${feeRate}% (${ethers.formatUnits(feeRate, 2)}%)`);

        console.log("\n🔧 Next steps:");
        console.log("1. Update frontend environment variables:");
        console.log(`   REACT_APP_PAYMENT_SPLITTER_ADDRESS=${splitterAddress}`);
        console.log("2. Users need to approve USDC to the splitter contract");
        console.log("3. Call splitPayment() for single-transaction payments");

        return deploymentInfo;

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 