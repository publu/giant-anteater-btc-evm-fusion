import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import { randomBytes, createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { keccak256 } from 'keccak'

// Initialize ECC
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

class KeyGenerator {
  constructor() {
    this.btcNetwork = bitcoin.networks.testnet
  }

  /**
   * Generate a secure random private key
   * @returns {Buffer} 32-byte private key
   */
  generatePrivateKey() {
    return randomBytes(32)
  }

  /**
   * Generate Bitcoin key pair
   * @param {Buffer} privateKey - Optional private key, generates random if not provided
   * @returns {Object} Bitcoin key information
   */
  generateBitcoinKey(privateKey = null) {
    const privKey = privateKey || this.generatePrivateKey()
    const keyPair = ECPair.fromPrivateKey(privKey, { network: this.btcNetwork })
    
    // Generate different address types
    const p2wpkh = bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey, 
      network: this.btcNetwork 
    })
    
    const p2sh = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ 
        pubkey: keyPair.publicKey, 
        network: this.btcNetwork 
      }),
      network: this.btcNetwork
    })

    return {
      privateKey: privKey.toString('hex'),
      publicKey: keyPair.publicKey.toString('hex'),
      wif: keyPair.toWIF(),
      addresses: {
        bech32: p2wpkh.address,      // Native SegWit (tb1...)
        p2sh: p2sh.address,          // SegWit wrapped (2...)
      },
      network: 'testnet'
    }
  }

  /**
   * Generate Ethereum key pair
   * @param {Buffer} privateKey - Optional private key, generates random if not provided
   * @returns {Object} Ethereum key information
   */
  generateEthereumKey(privateKey = null) {
    const privKey = privateKey || this.generatePrivateKey()
    
    // Generate Ethereum key using secp256k1
    const keyPair = ECPair.fromPrivateKey(privKey)
    
    // Get uncompressed public key (remove 0x04 prefix)
    const publicKeyFull = keyPair.publicKey
    let publicKeyUncompressed
    
    if (publicKeyFull.length === 33) {
      // Compressed key - need to decompress
      const point = ecc.pointFromScalar(privKey, false) // false = uncompressed
      publicKeyUncompressed = point.slice(1) // Remove 0x04 prefix
    } else {
      // Already uncompressed
      publicKeyUncompressed = publicKeyFull.slice(1) // Remove 0x04 prefix
    }
    
    // Ethereum address is last 20 bytes of keccak256(uncompressed_public_key)
    const keccakHash = keccak256(publicKeyUncompressed)
    const address = '0x' + keccakHash.slice(-20).toString('hex')

    return {
      privateKey: privKey.toString('hex'),
      publicKey: publicKeyUncompressed.toString('hex'),
      address: address,
      checksumAddress: this.toChecksumAddress(address),
      network: 'sepolia'
    }
  }

  /**
   * Convert address to checksum format (EIP-55)
   * @param {string} address - Ethereum address
   * @returns {string} Checksummed address
   */
  toChecksumAddress(address) {
    const addr = address.toLowerCase().replace('0x', '')
    const hash = keccak256(addr).toString('hex')
    let checksumAddr = '0x'
    
    for (let i = 0; i < addr.length; i++) {
      if (parseInt(hash[i], 16) >= 8) {
        checksumAddr += addr[i].toUpperCase()
      } else {
        checksumAddr += addr[i]
      }
    }
    
    return checksumAddr
  }

  /**
   * Generate a complete key set for testing
   * @param {Object} options - Generation options
   * @returns {Object} Complete key information
   */
  generateTestKeySet(options = {}) {
    console.log('🔐 Generating Test Key Set...\n')
    
    // Generate master entropy
    const entropy = this.generatePrivateKey()
    console.log('🎲 Master Entropy:', entropy.toString('hex'))
    console.log('')
    
    // Derive keys from entropy (simple derivation for demo)
    const btcSeed = this.deriveKey(entropy, 'btc')
    const ethSeed = this.deriveKey(entropy, 'eth')
    
    const btcKey = this.generateBitcoinKey(btcSeed)
    const ethKey = this.generateEthereumKey(ethSeed)
    
    return {
      entropy: entropy.toString('hex'),
      bitcoin: btcKey,
      ethereum: ethKey,
      generated: new Date().toISOString(),
      purpose: options.purpose || 'testing'
    }
  }

  /**
   * Simple key derivation function
   * @param {Buffer} entropy - Master entropy
   * @param {string} purpose - Purpose string for derivation
   * @returns {Buffer} Derived key
   */
  deriveKey(entropy, purpose) {
    const data = Buffer.concat([entropy, Buffer.from(purpose, 'utf8')])
    return createHash('sha256').update(data).digest()
  }

  /**
   * Generate keys from mnemonic-like seed phrase
   * @param {string} seedPhrase - Seed phrase
   * @returns {Object} Key set
   */
  generateFromSeed(seedPhrase) {
    console.log('🌱 Generating keys from seed phrase...\n')
    
    const entropy = createHash('sha256').update(seedPhrase).digest()
    const btcSeed = this.deriveKey(entropy, 'btc')
    const ethSeed = this.deriveKey(entropy, 'eth')
    
    const btcKey = this.generateBitcoinKey(btcSeed)
    const ethKey = this.generateEthereumKey(ethSeed)
    
    return {
      seedPhrase,
      entropy: entropy.toString('hex'),
      bitcoin: btcKey,
      ethereum: ethKey,
      generated: new Date().toISOString(),
      purpose: 'seed-derived'
    }
  }

  /**
   * Save keys to file securely
   * @param {Object} keySet - Generated key set
   * @param {string} filename - Optional filename
   */
  saveKeys(keySet, filename = null) {
    const keysDir = path.join(process.cwd(), 'keys')
    
    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const keyFile = filename || `test-keys-${timestamp}.json`
    const keyPath = path.join(keysDir, keyFile)
    
    // Save with restricted permissions
    fs.writeFileSync(keyPath, JSON.stringify(keySet, null, 2), { mode: 0o600 })
    
    console.log(`🔒 Keys saved securely to: ${keyPath}`)
    console.log('⚠️  Keep this file safe and never commit to version control!')
    
    return keyPath
  }

  /**
   * Generate environment file
   * @param {Object} keySet - Generated key set
   */
  generateEnvFile(keySet) {
    const envContent = `# Generated Test Keys - ${keySet.generated}
# ⚠️  FOR TESTING ONLY - DO NOT USE IN PRODUCTION

# Bitcoin Testnet RPC Configuration
BTC_RPC_URL=https://blockstream.info/testnet/api
# Alternative Bitcoin testnet RPC endpoints:
# BTC_RPC_URL=https://api.blockcypher.com/v1/btc/test3
# BTC_RPC_URL=https://testnet.blockexplorer.com/api
# BTC_RPC_URL=https://mempool.space/testnet/api

# Bitcoin Configuration
BTC_PRIVATE_KEY=${keySet.bitcoin.privateKey}

# Ethereum Configuration  
ETH_PRIVATE_KEY=${keySet.ethereum.privateKey}

# Sepolia RPC URL (update with your provider)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Contract Deployment (same as ETH_PRIVATE_KEY for testing)
DEPLOYER=${keySet.ethereum.privateKey}

# Etherscan API (get from https://etherscan.io/apis)
ETHERSCAN_API=YOUR_ETHERSCAN_API_KEY

# FUNDING ADDRESSES:
# Bitcoin Testnet (Bech32): ${keySet.bitcoin.addresses.bech32}
# Bitcoin Testnet (P2SH):   ${keySet.bitcoin.addresses.p2sh}
# Ethereum Sepolia:         ${keySet.ethereum.checksumAddress}
#
# Get testnet funds:
# Bitcoin: https://coinfaucet.eu/en/btc-testnet/
# Sepolia: https://sepoliafaucet.com/
`

    const envPath = path.join(process.cwd(), '.env.generated')
    fs.writeFileSync(envPath, envContent, { mode: 0o600 })
    
    console.log(`📝 Environment file created: .env.generated`)
    console.log('   Copy values to your .env file or rename to .env')
    
    return envPath
  }

  /**
   * Display key information in a readable format
   * @param {Object} keySet - Generated key set
   */
  displayKeys(keySet) {
    console.log('🔑 Generated Key Information')
    console.log('============================\n')
    
    console.log('📊 Bitcoin (Testnet):')
    console.log('   Private Key:', keySet.bitcoin.privateKey)
    console.log('   Public Key: ', keySet.bitcoin.publicKey)
    console.log('   WIF:        ', keySet.bitcoin.wif)
    console.log('   Bech32:     ', keySet.bitcoin.addresses.bech32)
    console.log('   P2SH:       ', keySet.bitcoin.addresses.p2sh)
    console.log('')
    
    console.log('🔷 Ethereum (Sepolia):')
    console.log('   Private Key:', keySet.ethereum.privateKey)
    console.log('   Public Key: ', keySet.ethereum.publicKey)
    console.log('   Address:    ', keySet.ethereum.checksumAddress)
    console.log('')
    
    console.log('💰 Get Test Funds:')
    console.log('   Bitcoin Testnet: https://coinfaucet.eu/en/btc-testnet/')
    console.log('   Sepolia ETH:     https://sepoliafaucet.com/')
    console.log('')
    
    console.log('🔒 Security Notes:')
    console.log('   - These keys are for TESTING ONLY')
    console.log('   - Never use on mainnet')
    console.log('   - Keep private keys secure')
    console.log('   - Never commit to version control')
  }

  /**
   * Validate a private key
   * @param {string} privateKeyHex - Private key in hex format
   * @returns {Object} Validation result
   */
  validatePrivateKey(privateKeyHex) {
    try {
      if (privateKeyHex.length !== 64) {
        return { valid: false, error: 'Private key must be 32 bytes (64 hex characters)' }
      }
      
      const privateKey = Buffer.from(privateKeyHex, 'hex')
      
      // Test Bitcoin key
      const btcKey = ECPair.fromPrivateKey(privateKey, { network: this.btcNetwork })
      
      // Test Ethereum key (basic validation)
      const ethKey = this.generateEthereumKey(privateKey)
      
      return {
        valid: true,
        bitcoin: {
          address: bitcoin.payments.p2wpkh({ 
            pubkey: btcKey.publicKey, 
            network: this.btcNetwork 
          }).address
        },
        ethereum: {
          address: ethKey.checksumAddress
        }
      }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }
}

// CLI interface
async function main() {
  const generator = new KeyGenerator()
  const args = process.argv.slice(2)
  const command = args[0]
  
  switch (command) {
    case 'generate':
    case 'new':
      const keySet = generator.generateTestKeySet()
      generator.displayKeys(keySet)
      
      const keyPath = generator.saveKeys(keySet)
      const envPath = generator.generateEnvFile(keySet)
      
      console.log('✅ Key generation complete!')
      console.log(`   Keys saved: ${keyPath}`)
      console.log(`   Env file:   ${envPath}`)
      break
      
    case 'from-seed':
      const seedPhrase = args[1]
      if (!seedPhrase) {
        console.log('❌ Please provide a seed phrase')
        console.log('   Usage: npm run generate-keys from-seed "your seed phrase"')
        break
      }
      
      const seedKeySet = generator.generateFromSeed(seedPhrase)
      generator.displayKeys(seedKeySet)
      generator.saveKeys(seedKeySet, 'seed-derived-keys.json')
      generator.generateEnvFile(seedKeySet)
      break
      
    case 'validate':
      const privateKey = args[1]
      if (!privateKey) {
        console.log('❌ Please provide a private key to validate')
        console.log('   Usage: npm run generate-keys validate <private_key_hex>')
        break
      }
      
      const validation = generator.validatePrivateKey(privateKey)
      if (validation.valid) {
        console.log('✅ Private key is valid')
        console.log('   Bitcoin address:', validation.bitcoin.address)
        console.log('   Ethereum address:', validation.ethereum.address)
      } else {
        console.log('❌ Invalid private key:', validation.error)
      }
      break
      
    case 'test-eth':
      // Test with a known private key to verify correctness
      const testKey = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
      const testResult = generator.generateEthereumKey(Buffer.from(testKey, 'hex'))
      console.log('🧪 Testing with known private key:')
      console.log('   Private Key:', testKey)
      console.log('   Generated Address:', testResult.checksumAddress)
      console.log('   Expected Address: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23')
      console.log('   Match:', testResult.checksumAddress.toLowerCase() === '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'.toLowerCase() ? '✅' : '❌')
      break
      
    case 'env-only':
      const envKeySet = generator.generateTestKeySet()
      generator.generateEnvFile(envKeySet)
      console.log('✅ Environment file generated: .env.generated')
      break
      
    default:
      console.log('🔑 Private Key Generator for Testing')
      console.log('====================================\n')
      console.log('Commands:')
      console.log('  generate, new          - Generate new key pair')
      console.log('  addresses <filename>   - Show addresses from saved keys')
      console.log('  list                   - List all saved key files')
      console.log('  from-seed <phrase>     - Generate from seed phrase')
      console.log('  validate <private_key> - Validate a private key')
      console.log('  env-only              - Generate only .env file')
      console.log('  test-eth              - Test Ethereum key generation')
      console.log('')
      console.log('Examples:')
      console.log('  npm run generate-keys')
      console.log('  npm run generate-keys list')
      console.log('  npm run generate-keys addresses test-keys-2024-01-01.json')
      console.log('  npm run generate-keys from-seed "my test phrase"')
      console.log('  npm run generate-keys validate 1234...abcd')
      console.log('')
      console.log('⚠️  Generated keys are for TESTING ONLY')
  }
}

export { KeyGenerator }

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}