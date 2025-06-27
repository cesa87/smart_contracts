const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Contract addresses from deployment
    const escrowAddress = "0xd319A56c6d92D502D2F9fD53B948d0C3971862a0";
    const paymentAddress = "0xC601e41D02F9d974dAfa0B75398f5939CF9a3718";
    
    console.log("🔗 Linking Crynk Smart Contracts...");
    console.log("📍 Deployer:", deployer.address);
    console.log("📍 Escrow Contract:", escrowAddress);
    console.log("📍 Payment Contract:", paymentAddress);
    
    try {
        // Get contract instances
        const CrynkEscrow = await ethers.getContractFactory("CrynkEscrowContract");
        const escrowContract = CrynkEscrow.attach(escrowAddress);
        
        console.log("\n🔄 Linking escrow to payment contract...");
        
        // Link the payment contract to the escrow contract
        const linkTx = await escrowContract.updatePaymentContract(paymentAddress);
        console.log("⏳ Transaction sent:", linkTx.hash);
        
        const receipt = await linkTx.wait();
        console.log("✅ Contracts linked successfully!");
        console.log("📊 Gas used:", receipt.gasUsed.toString());
        
        // Verify the link
        console.log("\n🔍 Verifying contract link...");
        const linkedPaymentContract = await escrowContract.paymentContract();
        console.log("💡 Linked Payment Contract:", linkedPaymentContract);
        
        if (linkedPaymentContract.toLowerCase() === paymentAddress.toLowerCase()) {
            console.log("✅ Contract linking verified successfully!");
        } else {
            console.log("❌ Contract linking verification failed!");
        }
        
    } catch (error) {
        console.error("❌ Error linking contracts:", error.message);
        
        // Check if contracts are already linked
        try {
            const CrynkEscrow = await ethers.getContractFactory("CrynkEscrowContract");
            const escrowContract = CrynkEscrow.attach(escrowAddress);
            const currentPaymentContract = await escrowContract.paymentContract();
            
            if (currentPaymentContract.toLowerCase() === paymentAddress.toLowerCase()) {
                console.log("💡 Contracts are already linked correctly!");
            } else {
                console.log("🔄 Current payment contract:", currentPaymentContract);
            }
        } catch (checkError) {
            console.error("❌ Error checking contract state:", checkError.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 