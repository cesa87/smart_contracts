const { ethers } = require("hardhat");

async function main() {
  console.log("💰 Setting up USDC for testing on forked mainnet...");
  
  // Mainnet USDC contract address
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  
  // USDC whale address (has lots of USDC) - Binance Hot Wallet
  const USDC_WHALE = "0x28C6c06298d514Db089934071355E5743bf21d60";
  
  // Get signers
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("📋 Setup Info:");
  console.log("- Deployer address:", deployerAddress);
  console.log("- USDC contract:", USDC_ADDRESS);
  console.log("- USDC whale (source):", USDC_WHALE);
  
  // Verify network
  const network = await ethers.provider.getNetwork();
  console.log("- Network:", network.name);
  console.log("- Chain ID:", network.chainId.toString());
  
  // Accept both mainnet (1) and hardhat fork (31337) chain IDs
  const isForkedMainnet = network.chainId === 1n || network.chainId === 31337n;
  
  if (!isForkedMainnet) {
    throw new Error(`Expected chain ID 1 (mainnet) or 31337 (hardhat fork), got ${network.chainId}`);
  }
  
  // Gas settings for forked mainnet
  const gasSettings = {
    gasLimit: 500000, // 500k gas limit for transfers
    gasPrice: ethers.parseUnits("20", "gwei") // 20 gwei
  };
  
  console.log("⛽ Using gas settings:", {
    gasLimit: gasSettings.gasLimit,
    gasPrice: ethers.formatUnits(gasSettings.gasPrice, "gwei") + " gwei"
  });
  
  // USDC contract ABI (minimal)
  const usdcAbi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  
  // Get USDC contract
  const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, ethers.provider);
  
  // Check USDC details
  try {
    const symbol = await usdcContract.symbol();
    const decimals = await usdcContract.decimals();
    console.log(`- Token: ${symbol} (${decimals} decimals)`);
    
    // Check whale balance
    const whaleBalance = await usdcContract.balanceOf(USDC_WHALE);
    console.log(`- Whale balance: ${ethers.formatUnits(whaleBalance, decimals)} ${symbol}`);
    
    // Check deployer's current balance
    const deployerBalance = await usdcContract.balanceOf(deployerAddress);
    console.log(`- Deployer current balance: ${ethers.formatUnits(deployerBalance, decimals)} ${symbol}`);
    
    // Amount to transfer (1000 USDC for testing)
    const transferAmount = ethers.parseUnits("1000", decimals);
    
    if (deployerBalance >= transferAmount) {
      console.log("✅ Deployer already has sufficient USDC for testing");
      return {
        deployerAddress,
        usdcBalance: ethers.formatUnits(deployerBalance, decimals),
        ethBalance: ethers.formatEther(await ethers.provider.getBalance(deployerAddress)),
        usdcAddress: USDC_ADDRESS,
        alreadyHadFunds: true
      };
    }
    
    console.log("\n💸 Transferring USDC from whale to deployer...");
    
    // Impersonate the whale account
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    const whaleSigner = await ethers.getSigner(USDC_WHALE);
    
    // Fund the whale with ETH for gas (since we're impersonating)
    console.log("⛽ Funding whale with ETH for gas...");
    await deployer.sendTransaction({
      to: USDC_WHALE,
      value: ethers.parseEther("1.0"), // Send 1 ETH for gas
      ...gasSettings
    });
    
    // Transfer USDC from whale to deployer
    console.log("📤 Executing USDC transfer...");
    const usdcAsWhale = usdcContract.connect(whaleSigner);
    const transferTx = await usdcAsWhale.transfer(deployerAddress, transferAmount, gasSettings);
    await transferTx.wait();
    
    console.log(`✅ Transferred ${ethers.formatUnits(transferAmount, decimals)} ${symbol} to deployer`);
    
    // Stop impersonating
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [USDC_WHALE]);
    
    // Verify final balance
    const finalBalance = await usdcContract.balanceOf(deployerAddress);
    console.log(`✅ Deployer final balance: ${ethers.formatUnits(finalBalance, decimals)} ${symbol}`);
    
    console.log("\n🎉 USDC setup completed!");
    console.log("\n📝 Test Account Info:");
    console.log("- Address:", deployerAddress);
    console.log("- USDC Balance:", ethers.formatUnits(finalBalance, decimals), symbol);
    console.log("- ETH Balance:", ethers.formatEther(await ethers.provider.getBalance(deployerAddress)), "ETH");
    
    console.log("\n🔧 For MetaMask:");
    console.log("1. Add custom token with address:", USDC_ADDRESS);
    console.log("2. Symbol: USDC");
    console.log("3. Decimals: 6");
    
    return {
      deployerAddress,
      usdcBalance: ethers.formatUnits(finalBalance, decimals),
      ethBalance: ethers.formatEther(await ethers.provider.getBalance(deployerAddress)),
      usdcAddress: USDC_ADDRESS,
      transferredAmount: ethers.formatUnits(transferAmount, decimals)
    };
    
  } catch (error) {
    console.error("❌ Error accessing USDC contract:", error.message);
    console.log("\n⚠️ This suggests the network is not properly forked from mainnet.");
    console.log("Make sure you started hardhat with: npx hardhat node --fork <MAINNET_RPC_URL>");
    throw error;
  }
}

main()
  .then((result) => {
    console.log("\n✅ Setup completed successfully:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }); 