import * as bitcoin from 'bitcoin-sdk-js'
import { BitcoinRPC } from './bitcoin-rpc.js'

/**
 * Bitcoin HTLC implementation using bitcoin-sdk-js
 */
export class BitcoinSDKHTLC {
  constructor(network = 'testnet') {
    this.network = network
    this.rpc = new BitcoinRPC(process.env.BTC_RPC_URL || 'https://mempool.space/testnet/api')
  }

  /**
   * Generate key pair using bitcoin-sdk-js
   * @returns {Promise<Object>} Key pair with public and private keys
   */
  async generateKeyPair() {
    const keyPair = await bitcoin.wallet.generateKeyPair()
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      address: await bitcoin.address.generateAddress(keyPair.publicKey)
    }
  }

  /**
   * Create HTLC script for atomic swaps
   * @param {string} pubkey1 - Public key of the redeemer (who reveals secret)
   * @param {string} pubkey2 - Public key of the refunder (who gets refund after timeout)
   * @param {string} secretHash - Hash of the secret (hex string)
   * @param {number} locktime - Unix timestamp for timeout
   * @returns {Promise<string>} HTLC script
   */
  async createHTLCScript(pubkey1, pubkey2, secretHash, locktime) {
    const HTLC = bitcoin.Opcode.OP_IF +
      (await bitcoin.script.generateTimeLockScript(locktime)) +
      (await bitcoin.data.pushData(pubkey1)) +
      pubkey1 +
      bitcoin.Opcode.OP_ELSE +
      (await bitcoin.script.generateHashLockScript(secretHash)) +
      (await bitcoin.data.pushData(pubkey2)) +
      pubkey2 +
      bitcoin.Opcode.OP_ENDIF +
      bitcoin.Opcode.OP_CHECKSIG

    return HTLC
  }

  /**
   * Generate P2WSH address from HTLC script
   * @param {string} htlcScript - HTLC script
   * @returns {Promise<string>} P2WSH address
   */
  async getHTLCAddress(htlcScript) {
    return await bitcoin.address.generateScriptAddress(htlcScript)
  }

  /**
   * Create and sign HTLC redeem transaction (claim with secret)
   * @param {Object} config - Transaction configuration
   * @returns {Promise<string>} Signed transaction hex
   */
  async createRedeemTransaction(config) {
    const {
      htlcScript,
      txId,
      outputIndex,
      value,
      toAddress,
      fee,
      locktime,
      privateKey,
      secretHex,
      executeIf = true
    } = config

    const tx = new bitcoin.Transaction()

    // Add input (UTXO from HTLC address)
    await tx.addInput({
      txHash: txId,
      index: outputIndex,
      value: value
    })

    // Add output (destination address)
    await tx.addOutput({
      address: toAddress,
      value: value - fee
    })

    // Set locktime if provided
    if (locktime) {
      await tx.setLocktime(locktime)
    }

    // Sign input with appropriate script sig
    if (executeIf) {
      // Execute OP_IF branch (claim with secret)
      await tx.signInputByScriptSig([
        await bitcoin.crypto.sign(
          await tx.getInputHashToSign(htlcScript, 0),
          privateKey
        ),
        secretHex, // reveal secret
        '01', // execute OP_IF
        htlcScript // redeem script
      ], 0)
    } else {
      // Execute OP_ELSE branch (refund after timeout)
      await tx.signInputByScriptSig([
        await bitcoin.crypto.sign(
          await tx.getInputHashToSign(htlcScript, 0),
          privateKey
        ),
        '', // execute OP_ELSE
        htlcScript // redeem script
      ], 0)
    }

    return await tx.getSignedHex()
  }

  /**
   * Create refund transaction (timeout claim)
   * @param {Object} config - Transaction configuration
   * @returns {Promise<string>} Signed transaction hex
   */
  async createRefundTransaction(config) {
    return await this.createRedeemTransaction({
      ...config,
      executeIf: false
    })
  }

  /**
   * Generate random secret and its hash
   * @returns {Object} Secret and hash
   */
  generateSecret() {
    const secret = Buffer.from(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15))
    const hash = bitcoin.crypto.sha256(secret.toString('hex'))
    
    return {
      secret: secret.toString('hex'),
      hash: hash
    }
  }

  /**
   * Check HTLC address balance and UTXOs
   * @param {string} address - HTLC address
   * @returns {Promise<Object>} Balance and UTXO information
   */
  async checkHTLCStatus(address) {
    const balance = await this.rpc.getAddressBalance(address)
    const utxos = await this.rpc.getAddressUtxos(address)
    
    return {
      address,
      balance,
      utxos,
      funded: balance.total > 0,
      explorerUrl: `https://mempool.space/testnet/address/${address}`
    }
  }

  /**
   * Broadcast transaction to network
   * @param {string} txHex - Signed transaction hex
   * @returns {Promise<string>} Transaction ID
   */
  async broadcastTransaction(txHex) {
    return await this.rpc.broadcastTransaction(txHex)
  }
}