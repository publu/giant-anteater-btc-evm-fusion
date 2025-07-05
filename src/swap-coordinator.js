import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { BitcoinHTLC } from './htlc.js'

// Initialize ECC for ECPair usage
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

export class SwapCoordinator {
  constructor(network = bitcoin.networks.testnet) {
    this.network = network
    this.htlc = new BitcoinHTLC(network)
  }

  /**
   * Setup BTC -> ETH swap (User locks BTC, Resolver claims after revealing secret on ETH)
   * @param {bitcoin.ECPair} userKey - User's key pair
   * @param {Buffer} resolverPubKey - Resolver's public key
   * @param {Buffer} secretHash - Hash of the secret
   * @param {number} timeoutHours - Timeout in hours
   * @returns {Object} Swap configuration
   */
  setupBTCtoETH(userKey, resolverKeyOrPub, secretHash, timeoutHours = 24) {
    const locktime = Math.floor(Date.now() / 1000) + (timeoutHours * 3600)

    const resolverKey = resolverKeyOrPub.privateKey ? resolverKeyOrPub : null
    const resolverPubKey = resolverKey ? resolverKey.publicKey : resolverKeyOrPub
    
    // User is refunder, Resolver is redeemer
    const script = this.htlc.createHTLCScript(
      resolverPubKey,      // redeemer (resolver claims with secret)
      userKey.publicKey,   // refunder (user gets refund after timeout)
      secretHash,
      locktime
    )

    const { address, p2shAddress } = this.htlc.getHTLCAddress(script)

    return {
      direction: 'BTC->ETH',
      address,
      p2shAddress,
      script,
      locktime,
      redeemer: 'resolver',
      refunder: 'user',
      userKey,
      resolverPubKey,
      resolverKey
    }
  }

  /**
   * Setup ETH -> BTC swap (Resolver locks BTC, User claims after revealing secret on ETH)
   * @param {Buffer} userPubKey - User's public key
   * @param {bitcoin.ECPair} resolverKey - Resolver's key pair
   * @param {Buffer} secretHash - Hash of the secret
   * @param {number} timeoutHours - Timeout in hours
   * @returns {Object} Swap configuration
   */
  setupETHtoBTC(userPubKey, resolverKey, secretHash, timeoutHours = 24) {
    const locktime = Math.floor(Date.now() / 1000) + (timeoutHours * 3600)
    
    // Resolver is refunder, User is redeemer
    const script = this.htlc.createHTLCScript(
      userPubKey,              // redeemer (user claims with secret)
      resolverKey.publicKey,   // refunder (resolver gets refund after timeout)
      secretHash,
      locktime
    )

    const { address, p2shAddress } = this.htlc.getHTLCAddress(script)

    return {
      direction: 'ETH->BTC',
      address,
      p2shAddress,
      script,
      locktime,
      redeemer: 'user',
      refunder: 'resolver',
      userPubKey,
      resolverKey
    }
  }

  /**
   * Create redeem transaction for claiming with secret
   * @param {Object} swapConfig - Swap configuration
   * @param {string} fundingTxId - Funding transaction ID
   * @param {number} fundingVout - Funding output index
   * @param {number} fundingValue - Funding value in satoshis
   * @param {string} claimAddress - Address to send claimed funds
   * @param {Buffer} secret - The secret
   * @param {number} fee - Fee in satoshis
   * @returns {string} Signed transaction hex
   */
  createRedeemTransaction(swapConfig, fundingTxId, fundingVout, fundingValue, claimAddress, secret, fee = 1000) {
    const outputValue = fundingValue - fee
    
    let signingKey, witness
    
    if (swapConfig.redeemer === 'resolver') {
      // BTC->ETH: Resolver claims with secret
      signingKey = swapConfig.resolverKey || ECPair.fromPrivateKey(Buffer.alloc(32, 1)) // Placeholder
      const signature = bitcoin.script.signature.encode(
        signingKey.sign(Buffer.alloc(32)), // Placeholder hash
        bitcoin.Transaction.SIGHASH_ALL
      )
      witness = this.htlc.createRedeemWitness(signature, swapConfig.resolverPubKey, secret, swapConfig.script)
    } else {
      // ETH->BTC: User claims with secret
      signingKey = swapConfig.userKey || ECPair.fromPrivateKey(Buffer.alloc(32, 1)) // Placeholder
      const signature = bitcoin.script.signature.encode(
        signingKey.sign(Buffer.alloc(32)), // Placeholder hash
        bitcoin.Transaction.SIGHASH_ALL
      )
      witness = this.htlc.createRedeemWitness(signature, swapConfig.userPubKey, secret, swapConfig.script)
    }

    return this.htlc.createSignedTransaction(
      fundingTxId,
      fundingVout,
      fundingValue,
      claimAddress,
      outputValue,
      signingKey,
      swapConfig.script,
      witness
    )
  }

  /**
   * Create refund transaction for timeout claim
   * @param {Object} swapConfig - Swap configuration
   * @param {string} fundingTxId - Funding transaction ID
   * @param {number} fundingVout - Funding output index
   * @param {number} fundingValue - Funding value in satoshis
   * @param {string} refundAddress - Address to send refunded funds
   * @param {number} fee - Fee in satoshis
   * @returns {string} Signed transaction hex
   */
  createRefundTransaction(swapConfig, fundingTxId, fundingVout, fundingValue, refundAddress, fee = 1000) {
    const outputValue = fundingValue - fee
    
    let signingKey, witness
    
    if (swapConfig.refunder === 'user') {
      // BTC->ETH: User gets refund
      signingKey = swapConfig.userKey || ECPair.fromPrivateKey(Buffer.alloc(32, 1))
      const signature = bitcoin.script.signature.encode(
        signingKey.sign(Buffer.alloc(32)), // Placeholder hash
        bitcoin.Transaction.SIGHASH_ALL
      )
      witness = this.htlc.createRefundWitness(signature, swapConfig.userKey.publicKey, swapConfig.script)
    } else {
      // ETH->BTC: Resolver gets refund
      signingKey = swapConfig.resolverKey || ECPair.fromPrivateKey(Buffer.alloc(32, 1))
      const signature = bitcoin.script.signature.encode(
        signingKey.sign(Buffer.alloc(32)), // Placeholder hash
        bitcoin.Transaction.SIGHASH_ALL
      )
      witness = this.htlc.createRefundWitness(signature, swapConfig.resolverKey.publicKey, swapConfig.script)
    }

    return this.htlc.createSignedTransaction(
      fundingTxId,
      fundingVout,
      fundingValue,
      refundAddress,
      outputValue,
      signingKey,
      swapConfig.script,
      witness,
      swapConfig.locktime
    )
  }
}