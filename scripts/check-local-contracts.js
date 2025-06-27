const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Local Contract Deployments");
    console.log("=====================================");
    
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer address:", deployer.address);
    
    const network = await ethers.provider.getNetwork();
    console.log("📍 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Check environment addresses
    const paymentAddress = "0x02e8910B3B89690d4aeC9fcC0Ae2cD16fB6A4828";
    const escrowAddress = "0x564Db7a11653228164FD03BcA60465270E67b3d7";
    const splitterAddress = "0x76a999d5F7EFDE0a300e710e6f52Fb0A4b61aD58";
    
    console.log("\n🏢 Checking Contract Addresses:");
    console.log("- Payment Contract:", paymentAddress);
    console.log("- Escrow Contract:", escrowAddress);
    console.log("- Splitter Contract:", splitterAddress);
    
    // Check if contracts have code
    console.log("\n🔍 Checking if contracts exist:");
    
    const paymentCode = await ethers.provider.getCode(paymentAddress);
    console.log("- Payment Contract code:", paymentCode === "0x" ? "❌ No code" : "✅ Has code");
    
    const escrowCode = await ethers.provider.getCode(escrowAddress);
    console.log("- Escrow Contract code:", escrowCode === "0x" ? "❌ No code" : "✅ Has code");
    
    const splitterCode = await ethers.provider.getCode(splitterAddress);
    console.log("- Splitter Contract code:", splitterCode === "0x" ? "❌ No code" : "✅ Has code");
    
    // If payment contract exists, test its functions
    if (paymentCode !== "0x") {
        try {
            console.log("\n🧪 Testing Payment Contract Functions:");
            const CrynkPaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
            const paymentContract = CrynkPaymentContract.attach(paymentAddress);
            
            console.log("- Testing owner()...");
            const owner = await paymentContract.owner();
            console.log("  ✅ Owner:", owner);
            
            console.log("- Testing validMerchants(123)...");
            const isValidMerchant = await paymentContract.validMerchants(123);
            console.log("  ✅ Merchant 123 valid:", isValidMerchant);
            
            console.log("- Testing calculateFees(1000000000000000000)...");
            const fee = await paymentContract.calculateFees("1000000000000000000");
            console.log("  ✅ Fee for 1 ETH:", ethers.formatEther(fee));
            
        } catch (error) {
            console.log("  ❌ Payment contract function test failed:", error.message);
        }
    }
    
    // If splitter contract exists, test its functions
    if (splitterCode !== "0x") {
        try {
            console.log("\n🧪 Testing Splitter Contract Functions:");
            const CrynkPaymentSplitter = await ethers.getContractFactory("CrynkPaymentSplitter");
            const splitterContract = CrynkPaymentSplitter.attach(splitterAddress);
            
            console.log("- Testing calculateFees(10000000)..."); // 10 USDC in 6 decimals
            const [platformFee, merchantAmount] = await splitterContract.calculateFees("10000000");
            console.log("  ✅ Platform Fee:", ethers.formatUnits(platformFee, 6), "USDC");
            console.log("  ✅ Merchant Amount:", ethers.formatUnits(merchantAmount, 6), "USDC");
            
        } catch (error) {
            console.log("  ❌ Splitter contract function test failed:", error.message);
        }
    }
    
    console.log("\n✅ Contract check complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 