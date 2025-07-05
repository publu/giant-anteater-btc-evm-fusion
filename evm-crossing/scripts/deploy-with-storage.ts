import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentResult {
  factoryAddress: string;
  srcImplementation: string;
  dstImplementation: string;
  testTokenAddress: string;
  deploymentBlock: number;
  deploymentTime: string;
  network: string;
  deployer: string;
}

async function saveDeploymentResult(result: DeploymentResult) {
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const configPath = path.join(__dirname, "../../config/test-config.json");
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save detailed deployment info
  const deploymentFile = path.join(deploymentsDir, `${result.network}-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(result, null, 2));
  
  // Save latest deployment for easy access
  const latestFile = path.join(deploymentsDir, `${result.network}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(result, null, 2));
  
  // Update test config
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.contracts = {
      factoryAddress: result.factoryAddress,
      srcImplementation: result.srcImplementation,
      dstImplementation: result.dstImplementation,
      testToken: result.testTokenAddress
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("✅ Updated test-config.json with new contract addresses");
  }
  
  console.log(`📁 Deployment saved to: ${deploymentFile}`);
  console.log(`📁 Latest deployment: ${latestFile}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("🚀 Deploying contracts with auto-storage...");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("");

  const RESCUE_DELAY_SRC = 7 * 24 * 60 * 60; // 7 days
  const RESCUE_DELAY_DST = 7 * 24 * 60 * 60; // 7 days

  // Deploy MinimalEscrowFactory
  console.log("📦 Deploying MinimalEscrowFactory...");
  const MinimalEscrowFactory = await ethers.getContractFactory("MinimalEscrowFactory");
  const factory = await MinimalEscrowFactory.deploy(RESCUE_DELAY_SRC, RESCUE_DELAY_DST);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  const srcImplementation = await factory.ESCROW_SRC_IMPLEMENTATION();
  const dstImplementation = await factory.ESCROW_DST_IMPLEMENTATION();
  
  console.log("✅ MinimalEscrowFactory deployed:", factoryAddress);
  console.log("   Source Implementation:", srcImplementation);
  console.log("   Destination Implementation:", dstImplementation);

  // Deploy test token
  console.log("\n📦 Deploying MockBooToken...");
  const MockBooToken = await ethers.getContractFactory("MockBooToken");
  const testToken = await MockBooToken.deploy("Test Swap Token", "TST");
  await testToken.waitForDeployment();
  
  const testTokenAddress = await testToken.getAddress();
  console.log("✅ MockBooToken deployed:", testTokenAddress);

  // Mint some tokens to deployer
  const mintAmount = ethers.parseUnits("1000000", 18);
  await testToken.mint(deployer.address, mintAmount);
  console.log("✅ Minted", ethers.formatUnits(mintAmount, 18), "TST to deployer");

  // Get deployment info
  const deploymentBlock = await ethers.provider.getBlockNumber();
  const deploymentTime = new Date().toISOString();

  // Save deployment result
  const result: DeploymentResult = {
    factoryAddress,
    srcImplementation,
    dstImplementation,
    testTokenAddress,
    deploymentBlock,
    deploymentTime,
    network: network.name,
    deployer: deployer.address
  };

  await saveDeploymentResult(result);

  console.log("\n🎉 Deployment complete!");
  console.log("📋 Contract addresses automatically saved to:");
  console.log("   - config/test-config.json (for testing)");
  console.log("   - deployments/ directory (for records)");
  
  // Show example usage
  console.log("\n🧪 Ready for testing:");
  console.log("   npm run test:cross-chain");
  console.log("   npm run test:factory");
  
  return result;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });