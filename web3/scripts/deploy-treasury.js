import hre from "hardhat";

async function main() {
  console.log("Deploying TreasuryDAO contract to Arc Testnet...");

  // USDC address on Arc Testnet
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

  // Get the contract factory
  const TreasuryDAO = await hre.ethers.getContractFactory("TreasuryDAOPermissionless");

  // Deploy the contract
  console.log("Deploying with USDC address:", USDC_ADDRESS);
  const treasury = await TreasuryDAO.deploy(USDC_ADDRESS);

  await treasury.waitForDeployment();

  const treasuryAddress = await treasury.getAddress();
  console.log("TreasuryDAO deployed to:", treasuryAddress);

  // Officer addresses (will be populated from Circle wallets)
  const michaelBurry = "0x5a79daf48e3b02e62bdaf8554b50083617f4a359"; // ARC-TESTNET wallet 1
  const richardBranson = "0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37"; // ARC-TESTNET wallet 2 (SCA)
  const cathieWood = "0x3c4b268b88ca7374e2f597b6627011225263d8b4"; // ETH-SEPOLIA wallet

  console.log("\nInitializing shares...");
  console.log("Michael Burry:", michaelBurry, "- 50 shares (50%)");
  console.log("Richard Branson:", richardBranson, "- 30 shares (30%)");
  console.log("Cathie Wood:", cathieWood, "- 20 shares (20%)");

  // Initialize shares: Michael 50%, Richard 30%, Cathie 20%
  const initTx = await treasury.initializeShares(
    [michaelBurry, richardBranson, cathieWood],
    [50, 30, 20]
  );

  await initTx.wait();
  console.log("Shares initialized!");

  // Verify shares
  const michaelShares = await treasury.shares(michaelBurry);
  const richardShares = await treasury.shares(richardBranson);
  const cathieShares = await treasury.shares(cathieWood);
  const totalShares = await treasury.totalShares();

  console.log("\nShare Verification:");
  console.log("Michael Burry shares:", michaelShares.toString());
  console.log("Richard Branson shares:", richardShares.toString());
  console.log("Cathie Wood shares:", cathieShares.toString());
  console.log("Total shares:", totalShares.toString());

  const michaelPercentage = await treasury.getSharePercentage(michaelBurry);
  const richardPercentage = await treasury.getSharePercentage(richardBranson);
  const cathiePercentage = await treasury.getSharePercentage(cathieWood);

  console.log("\nPercentages:");
  console.log("Michael Burry:", (michaelPercentage / 100).toString() + "%");
  console.log("Richard Branson:", (richardPercentage / 100).toString() + "%");
  console.log("Cathie Wood:", (cathiePercentage / 100).toString() + "%");

  console.log("\n✅ Deployment complete!");
  console.log("\nContract addresses:");
  console.log("TreasuryDAO:", treasuryAddress);
  console.log("USDC:", USDC_ADDRESS);

  console.log("\nNext steps:");
  console.log("1. Fund the treasury with USDC");
  console.log("2. Update DAO House config with treasury address");
  console.log("3. Test profit distribution with small amount");

  return treasuryAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
