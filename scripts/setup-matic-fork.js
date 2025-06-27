// scripts/setup-matic-fork.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const maticAddress = "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0"; // MATIC on Ethereum
  const maticWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // Whale address with MATIC

  // Impersonate whale
  await ethers.provider.send("hardhat_impersonateAccount", [maticWhale]);
  const whaleSigner = await ethers.getSigner(maticWhale);

  // Fund whale with ETH for gas
  await deployer.sendTransaction({
    to: maticWhale,
    value: ethers.parseEther("1")
  });

  // Transfer MATIC to your test account
  const matic = await ethers.getContractAt("IERC20", maticAddress, whaleSigner);
  const amount = ethers.parseUnits("100", 18);
  const tx = await matic.transfer(deployer.address, amount);
  await tx.wait();

  console.log(`✅ Sent ${ethers.formatUnits(amount, 18)} MATIC to ${deployer.address}`);
}

main().catch(console.error);
