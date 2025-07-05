import { BitcoinSDKHTLC } from './bitcoin-sdk-htlc.js'

/**
 * High-level coordinator for Bitcoin SDK HTLC swaps
 */
export class BitcoinSDKCoordinator {
  constructor(network = 'testnet') {
    this.network = network
    this.htlc = new BitcoinSDKHTLC(network)
  }

  /**
   * Setup BTC → ETH swap (User locks BTC, Resolver claims after revealing secret on ETH)
   * @param {string} userPrivateKey - User's private key (hex)
   * @param {string} resolverPublicKey - Resolver's public key
   * @param {string} secretHash - Hash of the secret
   * @param {number} timeoutHours - Timeout in hours
   * @returns {Promise<Object>} Swap configuration
   */
  async setupBTCtoETH(userPrivateKey, resolverPublicKey, secretHash, timeoutHours = 24) {
    const locktime = Math.floor(Date.now() / 1000) + (timeoutHours * 3600)
    
    // Generate user's public key from private key
    const userKeyPair = await this.htlc.generateKeyPair()
    // Note: In real implementation, derive public key from private key
    
    // Create HTLC script: resolver can claim with secret, user can refund after timeout
    const htlcScript = await this.htlc.createHTLCScript(
      resolverPublicKey, // redeemer (resolver claims with secret)
      userKeyPair.publicKey, // refunder (user gets refund after timeout)
      secretHash,
      locktime
    )

    const address = await this.htlc.getHTLCAddress(htlcScript)

    return {
      direction: 'BTC->ETH',
      address,
      htlcScript,
      locktime,
      redeemer: 'resolver',
      refunder: 'user',
      userPrivateKey,
      resolverPublicKey,
      secretHash
    }
  }

  /**
   * Setup ETH → BTC swap (Resolver locks BTC, User claims after revealing secret on ETH)
   * @param {string} userPublicKey - User's public key
   * @param {string} resolverPrivateKey - Resolver's private key (hex)
   * @param {string} secretHash - Hash of the secret
   * @param {number} timeoutHours - Timeout in hours
   * @returns {Promise<Object>} Swap configuration
   */
  async setupETHtoBTC(userPublicKey, resolverPrivateKey, secretHash, timeoutHours = 24) {
    const locktime = Math.floor(Date.now() / 1000) + (timeoutHours * 3600)
    
    // Generate resolver's public key from private key
    const resolverKeyPair = await this.htlc.generateKeyPair()
    // Note: In real implementation, derive public key from private key
    
    // Create HTLC script: user can claim with secret, resolver can refund after timeout
    const htlcScript = await this.htlc.createHTLCScript(
      userPublicKey, // redeemer (user claims with secret)
      resolverKeyPair.publicKey, // refunder (resolver gets refund after timeout)
      secretHash,
      locktime
    )

    const address = await this.htlc.getHTLCAddress(htlcScript)

    return {
      direction: 'ETH->BTC',
      address,
      htlcScript,
      locktime,
      redeemer: 'user',
      refunder: 'resolver',
      userPublicKey,
      resolverPrivateKey,
      secretHash
    }
  }

  /**
   * Create redeem transaction for claiming with secret
   * @param {Object} swapConfig - Swap configuration
   * @param {string} fundingTxId - Funding transaction ID
   * @param {number} fundingVout - Funding output index
   * @param {number} fundingValue - Funding value in satoshis
   * @param {string} claimAddress - Address to send claimed funds
   * @param {string} secretHex - The secret (hex string)
   * @param {number} fee - Fee in satoshis
   * @returns {Promise<string>} Signed transaction hex
   */
  async createRedeemTransaction(swapConfig, fundingTxId, fundingVout, fundingValue, claimAddress, secretHex, fee = 1000) {
    const privateKey = swapConfig.redeemer === 'resolver' 
      ? swapConfig.resolverPrivateKey 
      : swapConfig.userPrivateKey

    return await this.htlc.createRedeemTransaction({
      htlcScript: swapConfig.htlcScript,
      txId: fundingTxId,
      outputIndex: fundingVout,
      value: fundingValue,
      toAddress: claimAddress,
      fee,
      locktime: swapConfig.locktime,
      privateKey,
      secretHex,
      executeIf: true
    })
  }

  /**
   * Create refund transaction for timeout claim
   * @param {Object} swapConfig - Swap configuration
   * @param {string} fundingTxId - Funding transaction ID
   * @param {number} fundingVout - Funding output index
   * @param {number} fundingValue - Funding value in satoshis
   * @param {string} refundAddress - Address to send refunded funds
   * @param {number} fee - Fee in satoshis
   * @returns {Promise<string>} Signed transaction hex
   */
  async createRefundTransaction(swapConfig, fundingTxId, fundingVout, fundingValue, refundAddress, fee = 1000) {
    const privateKey = swapConfig.refunder === 'user' 
      ? swapConfig.userPrivateKey 
      : swapConfig.resolverPrivateKey

    return await this.htlc.createRefundTransaction({
      htlcScript: swapConfig.htlcScript,
      txId: fundingTxId,
      outputIndex: fundingVout,
      value: fundingValue,
      toAddress: refundAddress,
      fee,
      locktime: swapConfig.locktime,
      privateKey,
      executeIf: false
    })
  }

  /**
   * Monitor HTLC status
   * @param {Object} swapConfig - Swap configuration
   * @returns {Promise<Object>} HTLC status
   */
  async monitorHTLC(swapConfig) {
    return await this.htlc.checkHTLCStatus(swapConfig.address)
  }
}