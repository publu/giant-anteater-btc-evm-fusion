import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { BitcoinHTLC } from './src/htlc.js'
import { SwapCoordinator } from './src/swap-coordinator.js'

// Initialize bitcoinjs-lib with ECC library
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

console.log('🚀 Bitcoin HTLC Atomic Swaps Repository')
console.log('=====================================\n')

const network = bitcoin.networks.testnet
const coordinator = new SwapCoordinator(network)

// Demo: Generate a complete swap setup
console.log('🔧 Setting up demo swap...')

// Create parties
const alice = ECPair.makeRandom({ network })
const bob = ECPair.makeRandom({ network })

// Generate secret
const { secret, hash: secretHash } = coordinator.htlc.generateSecret()

console.log('👥 Parties:')
console.log('  Alice (User):', alice.publicKey.toString('hex').slice(0, 16) + '...')
console.log('  Bob (Resolver):', bob.publicKey.toString('hex').slice(0, 16) + '...')
console.log('  Secret Hash:', secretHash.toString('hex').slice(0, 16) + '...')
console.log('')

// Setup both directions
const btcToEth = coordinator.setupBTCtoETH(alice, bob.publicKey, secretHash, 24)
const ethToBtc = coordinator.setupETHtoBTC(alice.publicKey, bob, secretHash, 24)

console.log('📍 HTLC Addresses:')
console.log('  BTC→ETH:', btcToEth.address)
console.log('  ETH→BTC:', ethToBtc.address)
console.log('')

console.log('🎯 Swap Scenarios:')
console.log('1. BTC→ETH: Alice locks BTC, Bob claims after revealing secret on ETH')
console.log('2. ETH→BTC: Bob locks BTC, Alice claims after revealing secret on ETH')
console.log('')

console.log('📚 Available Scripts:')
console.log('  npm run example:btc-to-eth  - Run BTC→ETH swap example')
console.log('  npm run example:eth-to-btc  - Run ETH→BTC swap example')
console.log('  npm test                    - Run test suite')
console.log('')

console.log('🔒 Security Features:')
console.log('  ✅ Hash-locked: Requires secret to claim')
console.log('  ✅ Time-locked: Refund after timeout')
console.log('  ✅ Atomic: Both parties get their assets or none')
console.log('  ✅ Trustless: No third party required')