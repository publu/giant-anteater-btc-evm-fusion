import fs from 'fs'
import path from 'path'

/**
 * Load the latest deployed contract addresses for a given network
 */
export function loadLatestDeployment(network = 'sepolia') {
  const deploymentFile = path.join(process.cwd(), 'deployments', `${network}-latest.json`)
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found for network: ${network}. Run deployment first.`)
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'))
  console.log(`📁 Loaded deployment from: ${deployment.deploymentTime}`)
  console.log(`   Network: ${deployment.network}`)
  console.log(`   Factory: ${deployment.factoryAddress}`)
  
  return deployment
}

/**
 * Load contract addresses from test config
 */
export function loadTestConfig() {
  const configPath = path.join(process.cwd(), 'config', 'test-config.json')
  
  if (!fs.existsSync(configPath)) {
    throw new Error('Test config not found. Run deployment first.')
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  
  if (!config.contracts.factoryAddress) {
    throw new Error('No contract addresses in config. Run deployment first.')
  }
  
  return config
}

/**
 * Get all deployments for a network
 */
export function getAllDeployments(network = 'sepolia') {
  const deploymentsDir = path.join(process.cwd(), 'deployments')
  
  if (!fs.existsSync(deploymentsDir)) {
    return []
  }
  
  const files = fs.readdirSync(deploymentsDir)
    .filter(file => file.startsWith(`${network}-`) && file.endsWith('.json') && !file.includes('latest'))
    .map(file => {
      const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, file), 'utf8'))
      return { ...deployment, filename: file }
    })
    .sort((a, b) => new Date(b.deploymentTime).getTime() - new Date(a.deploymentTime).getTime())
  
  return files
}

/**
 * Check if contracts are deployed and ready
 */
export function checkDeploymentStatus(network = 'sepolia') {
  try {
    const deployment = loadLatestDeployment(network)
    const config = loadTestConfig()
    
    const isReady = deployment.factoryAddress && 
                   config.contracts.factoryAddress === deployment.factoryAddress
    
    return {
      isReady,
      deployment,
      config
    }
  } catch (error) {
    return {
      isReady: false,
      error: error.message
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2]
  const network = process.argv[3] || 'sepolia'
  
  switch (command) {
    case 'latest':
      try {
        const deployment = loadLatestDeployment(network)
        console.log(JSON.stringify(deployment, null, 2))
      } catch (error) {
        console.error('❌', error.message)
      }
      break
      
    case 'all':
      const deployments = getAllDeployments(network)
      console.log(`Found ${deployments.length} deployments for ${network}:`)
      deployments.forEach((dep, i) => {
        console.log(`${i + 1}. ${dep.deploymentTime} - ${dep.factoryAddress}`)
      })
      break
      
    case 'status':
      const status = checkDeploymentStatus(network)
      if (status.isReady) {
        console.log('✅ Contracts deployed and ready for testing')
        console.log('   Factory:', status.deployment.factoryAddress)
      } else {
        console.log('❌ Contracts not ready:', status.error || 'Unknown error')
      }
      break
      
    default:
      console.log('Usage:')
      console.log('  node scripts/load-contracts.js latest [network]')
      console.log('  node scripts/load-contracts.js all [network]')
      console.log('  node scripts/load-contracts.js status [network]')
  }
}