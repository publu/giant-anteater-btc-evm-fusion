import { execSync } from 'child_process'
import { checkDeploymentStatus } from './load-contracts.js'

async function quickDeploy() {
  console.log('🚀 Quick Deploy & Test Setup')
  console.log('============================\n')
  
  // Check if already deployed
  const status = checkDeploymentStatus()
  if (status.isReady) {
    console.log('✅ Contracts already deployed and ready!')
    console.log('   Factory:', status.deployment.factoryAddress)
    console.log('   Test Token:', status.deployment.testTokenAddress)
    console.log('\n🧪 Ready for testing:')
    console.log('   npm run test:cross-chain')
    return
  }
  
  console.log('📦 Deploying contracts to Sepolia...')
  
  try {
    // Deploy contracts
    execSync('cd evm-crossing && npm run deploy:sepolia', { 
      stdio: 'inherit',
      env: { ...process.env }
    })
    
    console.log('\n✅ Deployment complete!')
    
    // Verify deployment
    const newStatus = checkDeploymentStatus()
    if (newStatus.isReady) {
      console.log('✅ Contracts verified and ready for testing')
      console.log('\n🧪 Next steps:')
      console.log('1. Set environment variables:')
      console.log('   export BTC_PRIVATE_KEY="your_btc_key"')
      console.log('   export ETH_PRIVATE_KEY="your_eth_key"')
      console.log('   export INFURA_KEY="your_infura_key"')
      console.log('2. Run cross-chain test:')
      console.log('   npm run test:cross-chain')
    } else {
      console.log('❌ Deployment verification failed')
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message)
    console.log('\n🔧 Manual deployment:')
    console.log('   cd evm-crossing')
    console.log('   npm run deploy:sepolia')
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickDeploy()
}

export { quickDeploy }