import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { randomBytes } from 'crypto'

// Initialize ECC library
bitcoin.initEccLib(ecc)

export class BitcoinHTLC {
  constructor(network = bitcoin.networks.testnet) {
    this.network = network
  }

  /**
   * Create HTLC script for atomic swaps
   * @param {Buffer} redeemerPubKey - Public key of the redeemer (who reveals secret)
   * @param {Buffer} refunderPubKey - Public key of the refunder (who gets refund after timeout)
   * @param {Buffer} secretHash - SHA256 hash of the secret
   * @param {number} locktime - Unix timestamp for timeout
   * @returns {Buffer} Compiled script
   */
  createHTLCScript(redeemerPubKey, refunderPubKey, secretHash, locktime) {
    if (secretHash.length !== 32) {
      throw new Error('Secret hash must be 32 bytes')
    }

    const script = bitcoin.script.compile([
      bitcoin.opcodes.OP_IF,
        redeemerPubKey,
        bitcoin.opcodes.OP_CHECKSIGVERIFY,
        bitcoin.opcodes.OP_SHA256,
        secretHash,
        bitcoin.opcodes.OP_EQUALVERIFY,
      bitcoin.opcodes.OP_ELSE,
        bitcoin.script.number.encode(locktime),
        bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
        bitcoin.opcodes.OP_DROP,
        refunderPubKey,
        bitcoin.opcodes.OP_CHECKSIGVERIFY,
      bitcoin.opcodes.OP_ENDIF
    ])

    return script
  }

  /**
   * Generate P2WSH address from HTLC script
   * @param {Buffer} script - HTLC script
   * @returns {Object} Address and payment object
   */
  getHTLCAddress(script) {
    const p2wsh = bitcoin.payments.p2wsh({
      redeem: { output: script },
      network: this.network
    })

    const p2sh = bitcoin.payments.p2sh({
      redeem: p2wsh,
      network: this.network
    })

    return {
      address: p2wsh.address,
      payment: p2wsh,
      p2shAddress: p2sh.address
    }
  }

  /**
   * Create redeem witness for claiming with secret
   * @param {Buffer} signature - Signature from redeemer
   * @param {Buffer} redeemerPubKey - Public key of redeemer
   * @param {Buffer} secret - The secret that hashes to secretHash
   * @param {Buffer} redeemScript - The HTLC script
   * @returns {Array} Witness stack
   */
  createRedeemWitness(signature, redeemerPubKey, secret, redeemScript) {
    return bitcoin.payments.p2wsh({
      redeem: {
        input: bitcoin.script.compile([
          signature,
          redeemerPubKey,
          secret,
          bitcoin.script.number.encode(1) // OP_TRUE (select IF branch)
        ]),
        output: redeemScript
      }
    }).witness
  }

  /**
   * Create refund witness for timeout claim
   * @param {Buffer} signature - Signature from refunder
   * @param {Buffer} refunderPubKey - Public key of refunder
   * @param {Buffer} redeemScript - The HTLC script
   * @returns {Array} Witness stack
   */
  createRefundWitness(signature, refunderPubKey, redeemScript) {
    return bitcoin.payments.p2wsh({
      redeem: {
        input: bitcoin.script.compile([
          signature,
          refunderPubKey,
          bitcoin.script.number.encode(0) // OP_FALSE (select ELSE branch)
        ]),
        output: redeemScript
      }
    }).witness
  }

  /**
   * Create and sign transaction
   * @param {string} prevTxId - Previous transaction ID
   * @param {number} prevVout - Previous output index
   * @param {number} prevValue - Previous output value in satoshis
   * @param {string} outputAddress - Destination address
   * @param {number} outputValue - Output value in satoshis
   * @param {bitcoin.ECPair} signingKey - Key to sign with
   * @param {Buffer} redeemScript - HTLC script
   * @param {Array} witness - Witness stack
   * @param {number} locktime - Optional locktime
   * @returns {string} Signed transaction hex
   */
  createSignedTransaction(prevTxId, prevVout, prevValue, outputAddress, outputValue, signingKey, redeemScript, witness, locktime = 0) {
    const psbt = new bitcoin.Psbt({ network: this.network })
    
    // Add input
    psbt.addInput({
      hash: prevTxId,
      index: prevVout,
      sequence: 0xfffffffe, // Enable RBF and locktime
      witnessScript: redeemScript,
      value: prevValue
    })

    // Add output
    psbt.addOutput({
      address: outputAddress,
      value: outputValue
    })

    // Set locktime if provided
    if (locktime > 0) {
      psbt.setLocktime(locktime)
    }

    // Sign
    psbt.signInput(0, signingKey)

    // Finalize with custom witness
    psbt.finalizeInput(0, () => {
      return {
        finalScriptWitness: bitcoin.script.toStack(witness)
      }
    })

    return psbt.extractTransaction().toHex()
  }

  /**
   * Generate a random secret and its hash
   * @returns {Object} Secret and hash
   */
  generateSecret() {
    const secret = randomBytes(32)
    const hash = bitcoin.crypto.sha256(secret)
    
    return { secret, hash }
  }

  /**
   * Verify secret matches hash
   * @param {Buffer} secret - The secret
   * @param {Buffer} hash - The hash to verify against
   * @returns {boolean} True if valid
   */
  verifySecret(secret, hash) {
    return bitcoin.crypto.sha256(secret).equals(hash)
  }
}