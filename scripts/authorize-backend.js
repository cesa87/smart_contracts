const { ethers } = require("hardhat");

async function main() {
    console.log("🔑 Authorizing backend as delegate...");
    
    // Get the contract addresses from the latest deployment
    const deploymentInfo = require("../deployment-fork-1750753902319.json");
    
    console.log("📋 Setup Info:");
    console.log("- Payment Contract:", deploymentInfo.paymentContract);
    console.log("- Backend Address:", deploymentInfo.deployer); // Same as deployer for now
    
    // Get contract instance
    const PaymentContract = await ethers.getContractFactory("CrynkPaymentContract");
    const paymentContract = PaymentContract.attach(deploymentInfo.paymentContract);
    
    // Check current authorization status
    const backendAddress = deploymentInfo.deployer; // Using deployer address as backend
    const isAuthorized = await paymentContract.authorizedDelegates(backendAddress);
    console.log("- Current authorization status:", isAuthorized);
    
    if (!isAuthorized) {
        console.log("🔓 Authorizing backend address as delegate...");
        const tx = await paymentContract.setAuthorizedDelegate(backendAddress, true);
        await tx.wait();
        console.log("✅ Backend authorized as delegate");
    } else {
        console.log("✅ Backend already authorized as delegate");
    }
    
    // Verify authorization
    const finalStatus = await paymentContract.authorizedDelegates(backendAddress);
    console.log("- Final authorization status:", finalStatus);
    
    console.log("🎉 Backend authorization completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 