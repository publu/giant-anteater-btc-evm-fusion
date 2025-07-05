import { ethers } from 'ethers'
import fs from 'fs'
import { CrossChainSwapTester } from './cross-chain-test.js'

async function deployAndTest() {
  console.log('🚀 Deploy Contracts and Run Cross-Chain Test')
  console.log('==============================================\n')
  
  const INFURA_KEY = process.env.INFURA_KEY
  const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY
  
  if (!INFURA_KEY || !ETH_PRIVATE_KEY) {
    console.log('❌ Missing environment variables:')
    console.log('   ETH_PRIVATE_KEY - Ethereum private key')
    console.log('   INFURA_KEY - Infura API key')
    return
  }
  
  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_KEY}`)
  const signer = new ethers.Wallet(ETH_PRIVATE_KEY, provider)
  
  console.log('📡 Connected to Sepolia')
  console.log('   Address:', signer.address)
  
  const balance = await provider.getBalance(signer.address)
  console.log('   Balance:', ethers.formatEther(balance), 'ETH')
  
  if (balance < ethers.parseEther('0.01')) {
    console.log('⚠️  Low balance! Get Sepolia ETH from faucet:')
    console.log('   https://sepoliafaucet.com/')
    console.log('   https://faucet.sepolia.dev/')
    return
  }
  
  try {
    // Deploy factory (this would use the compiled contracts)
    console.log('\n🏗️  Deploying contracts...')
    console.log('   (In real scenario, use hardhat deploy script)')
    
    // For now, just show the test setup
    console.log('\n🧪 Setting up test scenario...')
    
    const tester = new CrossChainSwapTester()
    
    // Load test config and update with deployed addresses
    const config = JSON.parse(fs.readFileSync('config/test-config.json', 'utf8'))
    
    // In real scenario, these would be the deployed contract addresses
    config.contracts.factoryAddress = '0x...' // Would be set after deployment
    
    console.log('✅ Test setup complete')
    console.log('\n📋 To run full test:')
    console.log('1. Deploy contracts with: cd evm-crossing && npm run deploy:sepolia')
    console.log('2. Update config/test-config.json with deployed addresses')
    console.log('3. Set environment variables and run: npm run test:cross-chain')
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployAndTest()
}