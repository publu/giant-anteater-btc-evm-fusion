import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import { BitcoinHTLC } from '../src/htlc.js'
import { SwapCoordinator } from '../src/swap-coordinator.js'

// Initialize ECC
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

console.log('🧪 Running Bitcoin HTLC Tests')
console.log('==============================\n')

const network = bitcoin.networks.testnet
let testsPassed = 0
let testsTotal = 0

function test(name, fn) {
  testsTotal++
  try {
    fn()
    console.log(`✅ ${name}`)
    testsPassed++
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

// Test HTLC creation
test('HTLC script creation', () => {
  const htlc = new BitcoinHTLC(network)
  const redeemer = ECPair.makeRandom({ network })
  const refunder = ECPair.makeRandom({ network })
  const secretHash = bitcoin.crypto.sha256(Buffer.from('test secret'))
  const locktime = Math.floor(Date.now() / 1000) + 3600

  const script = htlc.createHTLCScript(
    redeemer.publicKey,
    refunder.publicKey,
    secretHash,
    locktime
  )

  assert(Buffer.isBuffer(script), 'Script should be a Buffer')
  assert(script.length > 0, 'Script should not be empty')
})

// Test address generation
test('HTLC address generation', () => {
  const htlc = new BitcoinHTLC(network)
  const redeemer = ECPair.makeRandom({ network })
  const refunder = ECPair.makeRandom({ network })
  const secretHash = bitcoin.crypto.sha256(Buffer.from('test secret'))
  const locktime = Math.floor(Date.now() / 1000) + 3600

  const script = htlc.createHTLCScript(
    redeemer.publicKey,
    refunder.publicKey,
    secretHash,
    locktime
  )

  const { address } = htlc.getHTLCAddress(script)
  
  assert(typeof address === 'string', 'Address should be a string')
  assert(address.startsWith('tb1'), 'Testnet address should start with tb1')
})

// Test secret generation and verification
test('Secret generation and verification', () => {
  const htlc = new BitcoinHTLC(network)
  const { secret, hash } = htlc.generateSecret()
  
  assert(secret.length === 32, 'Secret should be 32 bytes')
  assert(hash.length === 32, 'Hash should be 32 bytes')
  assert(htlc.verifySecret(secret, hash), 'Secret should verify against hash')
  
  const wrongSecret = Buffer.from('wrong secret')
  assert(!htlc.verifySecret(wrongSecret, hash), 'Wrong secret should not verify')
})

// Test swap coordinator
test('BTC→ETH swap setup', () => {
  const coordinator = new SwapCoordinator(network)
  const user = ECPair.makeRandom({ network })
  const resolver = ECPair.makeRandom({ network })
  const secretHash = bitcoin.crypto.sha256(Buffer.from('test secret'))
  
  const swapConfig = coordinator.setupBTCtoETH(user, resolver.publicKey, secretHash, 24)
  
  assert(swapConfig.direction === 'BTC->ETH', 'Direction should be BTC->ETH')
  assert(swapConfig.redeemer === 'resolver', 'Resolver should be redeemer')
  assert(swapConfig.refunder === 'user', 'User should be refunder')
  assert(typeof swapConfig.address === 'string', 'Should have address')
})

// Test ETH→BTC swap setup
test('ETH→BTC swap setup', () => {
  const coordinator = new SwapCoordinator(network)
  const user = ECPair.makeRandom({ network })
  const resolver = ECPair.makeRandom({ network })
  const secretHash = bitcoin.crypto.sha256(Buffer.from('test secret'))
  
  const swapConfig = coordinator.setupETHtoBTC(user.publicKey, resolver, secretHash, 24)
  
  assert(swapConfig.direction === 'ETH->BTC', 'Direction should be ETH->BTC')
  assert(swapConfig.redeemer === 'user', 'User should be redeemer')
  assert(swapConfig.refunder === 'resolver', 'Resolver should be refunder')
  assert(typeof swapConfig.address === 'string', 'Should have address')
})

// Test witness creation
test('Witness creation', () => {
  const htlc = new BitcoinHTLC(network)
  const redeemer = ECPair.makeRandom({ network })
  const refunder = ECPair.makeRandom({ network })
  const secret = Buffer.from('test secret')
  const secretHash = bitcoin.crypto.sha256(secret)
  const locktime = Math.floor(Date.now() / 1000) + 3600

  const script = htlc.createHTLCScript(
    redeemer.publicKey,
    refunder.publicKey,
    secretHash,
    locktime
  )

  const mockSignature = Buffer.from('mock signature')
  
  const redeemWitness = htlc.createRedeemWitness(
    mockSignature,
    redeemer.publicKey,
    secret,
    script
  )
  
  const refundWitness = htlc.createRefundWitness(
    mockSignature,
    refunder.publicKey,
    script
  )
  
  assert(Array.isArray(redeemWitness), 'Redeem witness should be an array')
  assert(Array.isArray(refundWitness), 'Refund witness should be an array')
  assert(redeemWitness.length > 0, 'Redeem witness should not be empty')
  assert(refundWitness.length > 0, 'Refund witness should not be empty')
})

// Test error handling
test('Error handling for invalid secret hash', () => {
  const htlc = new BitcoinHTLC(network)
  const redeemer = ECPair.makeRandom({ network })
  const refunder = ECPair.makeRandom({ network })
  const invalidHash = Buffer.from('invalid hash') // Wrong length
  const locktime = Math.floor(Date.now() / 1000) + 3600

  let errorThrown = false
  try {
    htlc.createHTLCScript(
      redeemer.publicKey,
      refunder.publicKey,
      invalidHash,
      locktime
    )
  } catch (error) {
    errorThrown = true
    assert(error.message.includes('32 bytes'), 'Should mention 32 bytes requirement')
  }
  
  assert(errorThrown, 'Should throw error for invalid hash length')
})

console.log(`\n🏁 Tests Complete: ${testsPassed}/${testsTotal} passed`)

if (testsPassed === testsTotal) {
  console.log('🎉 All tests passed!')
} else {
  console.log('❌ Some tests failed')
  process.exit(1)
}