import { BitcoinSDKHTLC } from '../src/bitcoin-sdk-htlc.js'
import { BitcoinSDKCoordinator } from '../src/bitcoin-sdk-coordinator.js'

console.log('🧪 Testing Bitcoin SDK HTLC Implementation')
console.log('==========================================\n')

let testsPassed = 0
let testsTotal = 0

function test(name, fn) {
  testsTotal++
  console.log(`🔄 Testing: ${name}`)
  
  fn()
    .then(() => {
      console.log(`✅ ${name}`)
      testsPassed++
    })
    .catch(error => {
      console.log(`❌ ${name}: ${error.message}`)
    })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

// Test key generation
test('Key pair generation', async () => {
  const htlc = new BitcoinSDKHTLC('testnet')
  const keyPair = await htlc.generateKeyPair()
  
  assert(keyPair.publicKey, 'Should have public key')
  assert(keyPair.privateKey, 'Should have private key')
  assert(keyPair.address, 'Should have address')
  assert(typeof keyPair.address === 'string', 'Address should be string')
})

// Test secret generation
test('Secret generation', async () => {
  const htlc = new BitcoinSDKHTLC('testnet')
  const { secret, hash } = htlc.generateSecret()
  
  assert(secret, 'Should have secret')
  assert(hash, 'Should have hash')
  assert(typeof secret === 'string', 'Secret should be string')
  assert(typeof hash === 'string', 'Hash should be string')
})

// Test HTLC script creation
test('HTLC script creation', async () => {
  const htlc = new BitcoinSDKHTLC('testnet')
  const keyPair1 = await htlc.generateKeyPair()
  const keyPair2 = await htlc.generateKeyPair()
  const { hash } = htlc.generateSecret()
  const locktime = Math.floor(Date.now() / 1000) + 3600
  
  const script = await htlc.createHTLCScript(
    keyPair1.publicKey,
    keyPair2.publicKey,
    hash,
    locktime
  )
  
  assert(script, 'Should create HTLC script')
  assert(typeof script === 'string', 'Script should be string')
})

// Test address generation
test('HTLC address generation', async () => {
  const htlc = new BitcoinSDKHTLC('testnet')
  const keyPair1 = await htlc.generateKeyPair()
  const keyPair2 = await htlc.generateKeyPair()
  const { hash } = htlc.generateSecret()
  const locktime = Math.floor(Date.now() / 1000) + 3600
  
  const script = await htlc.createHTLCScript(
    keyPair1.publicKey,
    keyPair2.publicKey,
    hash,
    locktime
  )
  
  const address = await htlc.getHTLCAddress(script)
  
  assert(address, 'Should generate address')
  assert(typeof address === 'string', 'Address should be string')
  // Note: Address format depends on bitcoin-sdk-js implementation
})

// Test coordinator setup
test('BTC→ETH swap setup', async () => {
  const coordinator = new BitcoinSDKCoordinator('testnet')
  const userKeyPair = await coordinator.htlc.generateKeyPair()
  const resolverKeyPair = await coordinator.htlc.generateKeyPair()
  const { hash } = coordinator.htlc.generateSecret()
  
  const swapConfig = await coordinator.setupBTCtoETH(
    userKeyPair.privateKey,
    resolverKeyPair.publicKey,
    hash,
    24
  )
  
  assert(swapConfig.direction === 'BTC->ETH', 'Direction should be BTC->ETH')
  assert(swapConfig.redeemer === 'resolver', 'Resolver should be redeemer')
  assert(swapConfig.refunder === 'user', 'User should be refunder')
  assert(swapConfig.address, 'Should have address')
})

// Test ETH→BTC swap setup
test('ETH→BTC swap setup', async () => {
  const coordinator = new BitcoinSDKCoordinator('testnet')
  const userKeyPair = await coordinator.htlc.generateKeyPair()
  const resolverKeyPair = await coordinator.htlc.generateKeyPair()
  const { hash } = coordinator.htlc.generateSecret()
  
  const swapConfig = await coordinator.setupETHtoBTC(
    userKeyPair.publicKey,
    resolverKeyPair.privateKey,
    hash,
    24
  )
  
  assert(swapConfig.direction === 'ETH->BTC', 'Direction should be ETH->BTC')
  assert(swapConfig.redeemer === 'user', 'User should be redeemer')
  assert(swapConfig.refunder === 'resolver', 'Resolver should be refunder')
  assert(swapConfig.address, 'Should have address')
})

// Run all tests
setTimeout(() => {
  console.log(`\n🏁 Tests Complete: ${testsPassed}/${testsTotal} passed`)
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('❌ Some tests failed')
    console.log('\n💡 Note: Some tests may fail if bitcoin-sdk-js is not properly installed')
    console.log('   Run: npm install bitcoin-sdk-js')
  }
}, 2000) // Give async tests time to complete