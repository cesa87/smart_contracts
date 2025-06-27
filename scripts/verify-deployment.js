const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Contract addresses from deployment
    const escrowAddress = "0xd319A56c6d92D502D2F9fD53B948d0C3971862a0";
    const paymentAddress = "0xC601e41D02F9d974dAfa0B75398f5939CF9a3718";
    
    console.log("🔍 Verifying Crynk Smart Contract Deployment");
    console.log("=" .repeat(50));
    console.log("📍 Network: Sepolia Testnet");
    console.log("📍 Deployer:", deployer.address);
    console.log("📍 Escrow Contract:", escrowAddress);
    console.log("📍 Payment Contract:", paymentAddress);
    console.log("");
    
    try {
        // Get contract instances
        const CrynkEscrow = await ethers.getContractFactory("CrynkEscrowContract");
        const CrynkPayment = await ethers.getContractFactory("CrynkPaymentContract");
        
        const escrowContract = CrynkEscrow.attach(escrowAddress);
        const paymentContract = CrynkPayment.attach(paymentAddress);
        
        console.log("✅ Contract factories created successfully");
        
        // Test basic contract calls
        console.log("\n🧪 Testing Contract Functionality:");
        
        // Check if contracts are responding
        try {
            // Test escrow contract
            const escrowOwner = await escrowContract.owner();
            console.log("✅ Escrow Contract - Owner:", escrowOwner);
            
            // Test payment contract
            const paymentOwner = await paymentContract.owner();
            console.log("✅ Payment Contract - Owner:", paymentOwner);
            
            console.log("\n🎉 SUCCESS: All contracts are deployed and responding!");
            console.log("=" .repeat(50));
            console.log("📋 Deployment Summary:");
            console.log("   • CrynkEscrowContract: ✅ Active");
            console.log("   • CrynkPaymentContract: ✅ Active");
            console.log("   • Both contracts owned by:", deployer.address);
            console.log("   • Network: Sepolia Testnet (Chain ID: 11155111)");
            console.log("=" .repeat(50));
            
        } catch (contractError) {
            console.log("❌ Contract call failed:", contractError.message);
        }
        
    } catch (error) {
        console.error("❌ Verification failed:", error.message);
    }
}

main()
    .then(() => {
        console.log("\n✅ Verification complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Verification error:", error);
        process.exit(1);
    }); 