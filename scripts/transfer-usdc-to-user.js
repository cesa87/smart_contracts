const { ethers } = require("hardhat");

async function main() {
    console.log("💸 Transferring USDC to test user...");

    // Get signers
    const [deployer, feeWallet, merchant, user] = await ethers.getSigners();
    
    console.log("👥 Accounts:");
    console.log("   Deployer (sender):", deployer.address);
    console.log("   User (receiver):", user.address);

    // USDC contract
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);

    // Check deployer balance
    const deployerBalance = await usdc.balanceOf(deployer.address);
    console.log("\n💰 Deployer USDC balance:", ethers.formatUnits(deployerBalance, 6));

    if (deployerBalance === 0n) {
        console.log("❌ Deployer has no USDC to transfer");
        return;
    }

    // Transfer 100 USDC to user for testing
    const transferAmount = ethers.parseUnits("100.0", 6);
    
    if (deployerBalance < transferAmount) {
        console.log("❌ Deployer doesn't have enough USDC for transfer");
        return;
    }

    console.log("📤 Transferring 100 USDC to user...");
    const transferTx = await usdc.connect(deployer).transfer(user.address, transferAmount);
    await transferTx.wait();

    // Check final balances
    const finalDeployerBalance = await usdc.balanceOf(deployer.address);
    const finalUserBalance = await usdc.balanceOf(user.address);

    console.log("\n✅ Transfer completed!");
    console.log("💰 Final balances:");
    console.log("   Deployer:", ethers.formatUnits(finalDeployerBalance, 6), "USDC");
    console.log("   User:", ethers.formatUnits(finalUserBalance, 6), "USDC");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 