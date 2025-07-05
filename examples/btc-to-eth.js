import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import { SwapCoordinator } from '../src/swap-coordinator.js'

// Initialize ECC
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

console.log('🔄 BTC → ETH Swap Example')
console.log('User locks BTC, Resolver claims after revealing secret on Ethereum\n')

const network = bitcoin.networks.testnet
const coordinator = new SwapCoordinator(network)

// Generate keys and secret
const userKey = ECPair.makeRandom({ network })
const resolverKey = ECPair.makeRandom({ network })
const { secret, hash: secretHash } = coordinator.htlc.generateSecret()

console.log('👤 User Public Key:', userKey.publicKey.toString('hex'))
console.log('🔧 Resolver Public Key:', resolverKey.publicKey.toString('hex'))
console.log('🔑 Secret Hash:', secretHash.toString('hex'))
console.log('🤐 Secret:', secret.toString('hex'))
console.log('')

// Setup swap
const swapConfig = coordinator.setupBTCtoETH(userKey, resolverKey.publicKey, secretHash, 24)

console.log('📍 HTLC Address:', swapConfig.address)
console.log('⏰ Timeout:', new Date(swapConfig.locktime * 1000).toISOString())
console.log('🎯 Direction:', swapConfig.direction)
console.log('')

console.log('📝 Next Steps:')
console.log('1. User sends BTC to HTLC address:', swapConfig.address)
console.log('2. Resolver sets up corresponding ETH HTLC with same secret hash')
console.log('3. User reveals secret on Ethereum to claim ETH')
console.log('4. Resolver uses revealed secret to claim BTC from this HTLC')
console.log('')

// Example redeem transaction (after secret is revealed)
console.log('🔓 Example Redeem Transaction:')
const mockFundingTxId = '0'.repeat(64)
const mockFundingVout = 0
const mockFundingValue = 100000 // 0.001 BTC
const mockClaimAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' // Example testnet address

try {
  const redeemTx = coordinator.createRedeemTransaction(
    swapConfig,
    mockFundingTxId,
    mockFundingVout,
    mockFundingValue,
    mockClaimAddress,
    secret,
    1000
  )
  console.log('✅ Redeem TX (hex):', redeemTx.slice(0, 100) + '...')
} catch (error) {
  console.log('⚠️  Redeem TX creation (requires real funding):', error.message)
}

console.log('')
console.log('🔒 The script ensures:')
console.log('  - Only resolver can claim with correct secret')
console.log('  - User gets refund after timeout if resolver fails')
console.log('  - Atomic swap guarantees both parties get their assets')