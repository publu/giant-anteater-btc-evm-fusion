import { BitcoinSDKCoordinator } from '../src/bitcoin-sdk-coordinator.js'
import { KeyGenerator } from '../scripts/generate-keys.js'

console.log('🚀 Bitcoin SDK HTLC Demo')
console.log('========================\n')

async function runDemo() {
  const coordinator = new BitcoinSDKCoordinator('testnet')
  
  // Generate or load keys from environment
  let userPrivateKey = process.env.BTC_PRIVATE_KEY
  let resolverPrivateKey
  
  if (!userPrivateKey) {
    console.log('🔑 No BTC_PRIVATE_KEY found, generating new keys...')
    const generator = new KeyGenerator()
    const keySet = generator.generateTestKeySet()
    
    userPrivateKey = keySet.bitcoin.privateKey
    resolverPrivateKey = generator.generateBitcoinKey().privateKey
    
    console.log('👤 User Private Key:', userPrivateKey)
    console.log('🔧 Resolver Private Key:', resolverPrivateKey)
    console.log('💰 Fund these addresses:')
    console.log('   User:', keySet.bitcoin.addresses.bech32)
    console.log('')
  } else {
    console.log('✅ Using BTC_PRIVATE_KEY from environment')
    const generator = new KeyGenerator()
    resolverPrivateKey = generator.generateBitcoinKey().privateKey
  }

  // Generate secret for the swap
  const { secret, hash: secretHash } = coordinator.htlc.generateSecret()
  
  console.log('🔑 Swap Parameters:')
  console.log('   Secret Hash:', secretHash)
  console.log('   Secret:', secret)
  console.log('')

  // Demo: BTC → ETH swap setup
  console.log('📍 Setting up BTC → ETH swap...')
  
  try {
    // Generate resolver's public key (in real scenario, this would be provided)
    const resolverKeyPair = await coordinator.htlc.generateKeyPair()
    
    const btcToEthSwap = await coordinator.setupBTCtoETH(
      userPrivateKey,
      resolverKeyPair.publicKey,
      secretHash,
      2 // 2 hour timeout
    )

    console.log('✅ BTC → ETH Swap Created:')
    console.log('   HTLC Address:', btcToEthSwap.address)
    console.log('   Direction:', btcToEthSwap.direction)
    console.log('   Timeout:', new Date(btcToEthSwap.locktime * 1000).toISOString())
    console.log('   Explorer:', `https://mempool.space/testnet/address/${btcToEthSwap.address}`)
    console.log('')

    // Check HTLC status
    console.log('🔍 Checking HTLC status...')
    const status = await coordinator.monitorHTLC(btcToEthSwap)
    
    console.log('📊 HTLC Status:')
    console.log('   Funded:', status.funded ? '✅' : '❌')
    console.log('   Balance:', status.balance.total, 'satoshis')
    console.log('   UTXOs:', status.utxos.length)
    console.log('')

    if (status.funded && status.utxos.length > 0) {
      console.log('💰 HTLC is funded! Creating example transactions...')
      
      const utxo = status.utxos[0]
      const claimAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' // Example address
      
      // Create redeem transaction (claim with secret)
      console.log('🔓 Creating redeem transaction...')
      const redeemTx = await coordinator.createRedeemTransaction(
        btcToEthSwap,
        utxo.txid,
        utxo.vout,
        utxo.value,
        claimAddress,
        secret,
        1000
      )
      
      console.log('✅ Redeem TX created:', redeemTx.slice(0, 60) + '...')
      
      // Create refund transaction (timeout claim)
      console.log('⏰ Creating refund transaction...')
      const refundTx = await coordinator.createRefundTransaction(
        btcToEthSwap,
        utxo.txid,
        utxo.vout,
        utxo.value,
        claimAddress,
        1000
      )
      
      console.log('✅ Refund TX created:', refundTx.slice(0, 60) + '...')
      console.log('')
      console.log('🚀 Broadcast these transactions at:')
      console.log('   https://mempool.space/testnet/tx/push')
    } else {
      console.log('💸 HTLC not funded. Send Bitcoin to:', btcToEthSwap.address)
      console.log('   Get testnet BTC: https://coinfaucet.eu/en/btc-testnet/')
    }

  } catch (error) {
    console.error('❌ Demo failed:', error.message)
    console.log('\n🔧 Make sure you have:')
    console.log('   - bitcoin-sdk-js installed')
    console.log('   - Valid private keys')
    console.log('   - Network connectivity')
  }
}

// Demo: ETH → BTC swap setup
async function demoETHtoBTC() {
  console.log('\n📍 Setting up ETH → BTC swap...')
  
  const coordinator = new BitcoinSDKCoordinator('testnet')
  const { secret, hash: secretHash } = coordinator.htlc.generateSecret()
  
  try {
    // Generate user's public key (in real scenario, this would be provided)
    const userKeyPair = await coordinator.htlc.generateKeyPair()
    const resolverPrivateKey = process.env.BTC_PRIVATE_KEY || 'mock_private_key'
    
    const ethToBtcSwap = await coordinator.setupETHtoBTC(
      userKeyPair.publicKey,
      resolverPrivateKey,
      secretHash,
      2 // 2 hour timeout
    )

    console.log('✅ ETH → BTC Swap Created:')
    console.log('   HTLC Address:', ethToBtcSwap.address)
    console.log('   Direction:', ethToBtcSwap.direction)
    console.log('   Timeout:', new Date(ethToBtcSwap.locktime * 1000).toISOString())
    console.log('')

  } catch (error) {
    console.error('❌ ETH → BTC demo failed:', error.message)
  }
}

// Run demos
runDemo()
  .then(() => demoETHtoBTC())
  .catch(error => {
    console.error('❌ Demo failed:', error.message)
  })