import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'
import { ethers } from 'ethers'
import { SwapCoordinator } from '../src/swap-coordinator.js'
import fs from 'fs'
import path from 'path'

// Initialize ECC
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

class CrossChainSwapTester {
  constructor() {
    this.config = JSON.parse(fs.readFileSync('config/test-config.json', 'utf8'))
    this.btcNetwork = bitcoin.networks.testnet
    this.swapCoordinator = new SwapCoordinator(this.btcNetwork)
    
    // Will be set from environment or user input
    this.btcPrivateKey = null
    this.ethPrivateKey = null
    this.ethProvider = null
    this.ethSigner = null
  }

  async initialize(btcSeed, ethSeed, infuraKey) {
    console.log('🔧 Initializing Cross-Chain Swap Tester...\n')
    
    // Setup Bitcoin
    if (btcSeed) {
      this.btcPrivateKey = ECPair.fromPrivateKey(Buffer.from(btcSeed, 'hex'), { network: this.btcNetwork })
      console.log('✅ Bitcoin key loaded')
      console.log('   Address:', bitcoin.payments.p2wpkh({ 
        pubkey: this.btcPrivateKey.publicKey, 
        network: this.btcNetwork 
      }).address)
    }
    
    // Setup Ethereum
    if (ethSeed && infuraKey) {
      const rpcUrl = this.config.networks.ethereum.rpcUrl.replace('YOUR_INFURA_KEY', infuraKey)
      this.ethProvider = new ethers.JsonRpcProvider(rpcUrl)
      this.ethSigner = new ethers.Wallet(ethSeed, this.ethProvider)
      
      console.log('✅ Ethereum connection established')
      console.log('   Address:', this.ethSigner.address)
      console.log('   Network:', await this.ethProvider.getNetwork())
      
      const balance = await this.ethProvider.getBalance(this.ethSigner.address)
      console.log('   Balance:', ethers.formatEther(balance), 'ETH')
    }
    
    console.log('')
  }

  async setupBTCtoETHSwap() {
    console.log('🔄 Setting up BTC → ETH Atomic Swap')
    console.log('=====================================\n')
    
    if (!this.btcPrivateKey || !this.ethSigner) {
      throw new Error('Both BTC and ETH keys must be initialized')
    }
    
    // Generate secret for the swap
    const { secret, hash: secretHash } = this.swapCoordinator.htlc.generateSecret()
    
    console.log('🔑 Swap Parameters:')
    console.log('   Secret Hash:', secretHash.toString('hex'))
    console.log('   Secret (keep safe!):', secret.toString('hex'))
    console.log('')
    
    // Setup Bitcoin HTLC (User locks BTC)
    const resolverPubKey = ECPair.makeRandom({ network: this.btcNetwork }).publicKey // In real scenario, this would be the resolver's actual pubkey
    const btcSwapConfig = this.swapCoordinator.setupBTCtoETH(
      this.btcPrivateKey,
      resolverPubKey,
      secretHash,
      2 // 2 hour timeout
    )
    
    console.log('📍 Bitcoin HTLC:')
    console.log('   Address:', btcSwapConfig.address)
    console.log('   Timeout:', new Date(btcSwapConfig.locktime * 1000).toISOString())
    console.log('   Direction:', btcSwapConfig.direction)
    console.log('')
    
    // Setup Ethereum escrow (Resolver locks ETH)
    const ethSwapConfig = await this.setupEthereumEscrow(secretHash, 'destination')
    
    console.log('📍 Ethereum Escrow:')
    console.log('   Address:', ethSwapConfig.address)
    console.log('   Token:', ethSwapConfig.token)
    console.log('   Amount:', ethers.formatEther(ethSwapConfig.amount))
    console.log('')
    
    return {
      secret,
      secretHash,
      btcSwapConfig,
      ethSwapConfig
    }
  }

  async setupETHtoBTCSwap() {
    console.log('🔄 Setting up ETH → BTC Atomic Swap')
    console.log('=====================================\n')
    
    if (!this.btcPrivateKey || !this.ethSigner) {
      throw new Error('Both BTC and ETH keys must be initialized')
    }
    
    // Generate secret for the swap
    const { secret, hash: secretHash } = this.swapCoordinator.htlc.generateSecret()
    
    console.log('🔑 Swap Parameters:')
    console.log('   Secret Hash:', secretHash.toString('hex'))
    console.log('   Secret (keep safe!):', secret.toString('hex'))
    console.log('')
    
    // Setup Ethereum escrow (User locks ETH)
    const ethSwapConfig = await this.setupEthereumEscrow(secretHash, 'source')
    
    console.log('📍 Ethereum Escrow:')
    console.log('   Address:', ethSwapConfig.address)
    console.log('   Token:', ethSwapConfig.token)
    console.log('   Amount:', ethers.formatEther(ethSwapConfig.amount))
    console.log('')
    
    // Setup Bitcoin HTLC (Resolver locks BTC)
    const btcSwapConfig = this.swapCoordinator.setupETHtoBTC(
      this.btcPrivateKey.publicKey,
      ECPair.makeRandom({ network: this.btcNetwork }), // In real scenario, this would be the resolver's actual key
      secretHash,
      2 // 2 hour timeout
    )
    
    console.log('📍 Bitcoin HTLC:')
    console.log('   Address:', btcSwapConfig.address)
    console.log('   Timeout:', new Date(btcSwapConfig.locktime * 1000).toISOString())
    console.log('   Direction:', btcSwapConfig.direction)
    console.log('')
    
    return {
      secret,
      secretHash,
      btcSwapConfig,
      ethSwapConfig
    }
  }

  async setupEthereumEscrow(secretHash, type) {
    // Load factory contract
    const factoryABI = [
      "function createSrcEscrow((bytes32,bytes32,address,address,address,uint256,uint256,uint256)) external payable",
      "function createDstEscrow((bytes32,bytes32,address,address,address,uint256,uint256,uint256), uint256) external payable",
      "function addressOfEscrowSrc((bytes32,bytes32,address,address,address,uint256,uint256,uint256)) external view returns (address)",
      "function addressOfEscrowDst((bytes32,bytes32,address,address,address,uint256,uint256,uint256)) external view returns (address)"
    ]
    
    const factory = new ethers.Contract(this.config.contracts.factoryAddress, factoryABI, this.ethSigner)
    
    // Pack timelocks
    const timeouts = this.config.timeouts
    let packedTimelocks = BigInt(0)
    packedTimelocks |= BigInt(timeouts.srcWithdrawal)
    packedTimelocks |= BigInt(timeouts.srcPublicWithdrawal) << BigInt(32)
    packedTimelocks |= BigInt(timeouts.srcCancellation) << BigInt(64)
    packedTimelocks |= BigInt(timeouts.srcPublicCancellation) << BigInt(96)
    packedTimelocks |= BigInt(timeouts.dstWithdrawal) << BigInt(128)
    packedTimelocks |= BigInt(timeouts.dstPublicWithdrawal) << BigInt(160)
    packedTimelocks |= BigInt(timeouts.dstCancellation) << BigInt(192)
    
    const immutables = {
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(`swap_${Date.now()}`)),
      hashlock: '0x' + secretHash.toString('hex'),
      maker: this.ethSigner.address,
      taker: this.ethSigner.address, // In real scenario, this would be different
      token: ethers.ZeroAddress, // ETH
      amount: ethers.parseEther(this.config.amounts.swapAmount),
      safetyDeposit: ethers.parseEther(this.config.amounts.safetyDeposit),
      timelocks: packedTimelocks.toString()
    }
    
    let escrowAddress
    if (type === 'source') {
      escrowAddress = await factory.addressOfEscrowSrc(immutables)
    } else {
      escrowAddress = await factory.addressOfEscrowDst(immutables)
    }
    
    return {
      address: escrowAddress,
      immutables,
      token: immutables.token,
      amount: immutables.amount,
      factory
    }
  }

  async executeSwapStep(step, swapData) {
    console.log(`\n🎯 Executing Step: ${step}`)
    console.log('================================')
    
    switch (step) {
      case 'fund-btc':
        console.log('📤 Fund Bitcoin HTLC')
        console.log('   Send BTC to:', swapData.btcSwapConfig.address)
        console.log('   Amount: 0.001 BTC (example)')
        console.log('   ⚠️  Manual step - use your Bitcoin wallet')
        break
        
      case 'fund-eth':
        console.log('📤 Fund Ethereum Escrow')
        try {
          const totalValue = swapData.ethSwapConfig.amount + swapData.ethSwapConfig.immutables.safetyDeposit
          const tx = await swapData.ethSwapConfig.factory.createSrcEscrow(
            swapData.ethSwapConfig.immutables,
            { value: totalValue }
          )
          console.log('   Transaction:', tx.hash)
          await tx.wait()
          console.log('   ✅ Ethereum escrow funded')
        } catch (error) {
          console.log('   ❌ Error:', error.message)
        }
        break
        
      case 'reveal-secret':
        console.log('🔓 Reveal Secret and Claim')
        console.log('   Secret:', swapData.secret.toString('hex'))
        console.log('   Use this secret to claim from the other chain')
        break
        
      default:
        console.log('   Unknown step')
    }
  }

  async monitorSwap(swapData) {
    console.log('\n👀 Monitoring Swap Status')
    console.log('==========================')
    
    // Check Bitcoin HTLC funding
    console.log('🔍 Bitcoin HTLC Status:')
    console.log('   Address:', swapData.btcSwapConfig.address)
    console.log('   ⚠️  Check manually with Bitcoin explorer')
    
    // Check Ethereum escrow
    console.log('\n🔍 Ethereum Escrow Status:')
    console.log('   Address:', swapData.ethSwapConfig.address)
    
    try {
      const balance = await this.ethProvider.getBalance(swapData.ethSwapConfig.address)
      console.log('   Balance:', ethers.formatEther(balance), 'ETH')
      
      if (balance > 0) {
        console.log('   ✅ Escrow is funded')
      } else {
        console.log('   ⏳ Waiting for funding...')
      }
    } catch (error) {
      console.log('   ❌ Error checking balance:', error.message)
    }
  }
}

// Example usage
async function runTest() {
  const tester = new CrossChainSwapTester()
  
  console.log('🚀 Cross-Chain Atomic Swap Tester')
  console.log('==================================\n')
  
  // These would come from environment variables or user input
  const BTC_SEED = process.env.BTC_PRIVATE_KEY // 32-byte hex string
  const ETH_SEED = process.env.ETH_PRIVATE_KEY // 32-byte hex string  
  const INFURA_KEY = process.env.INFURA_KEY
  
  if (!BTC_SEED || !ETH_SEED || !INFURA_KEY) {
    console.log('❌ Missing required environment variables:')
    console.log('   BTC_PRIVATE_KEY - Bitcoin private key (32-byte hex)')
    console.log('   ETH_PRIVATE_KEY - Ethereum private key (32-byte hex)')
    console.log('   INFURA_KEY - Infura API key for Sepolia')
    console.log('\nExample:')
    console.log('   export BTC_PRIVATE_KEY="your_btc_private_key_hex"')
    console.log('   export ETH_PRIVATE_KEY="your_eth_private_key_hex"')
    console.log('   export INFURA_KEY="your_infura_key"')
    return
  }
  
  try {
    await tester.initialize(BTC_SEED, ETH_SEED, INFURA_KEY)
    
    // Example: BTC → ETH swap
    const swapData = await tester.setupBTCtoETHSwap()
    
    console.log('📋 Next Steps:')
    console.log('1. Fund the Bitcoin HTLC')
    console.log('2. Fund the Ethereum escrow')
    console.log('3. Reveal secret to claim from both sides')
    console.log('')
    
    // Monitor the swap
    await tester.monitorSwap(swapData)
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

export { CrossChainSwapTester, runTest }

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest()
}