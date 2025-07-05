import fetch from 'node-fetch'

/**
 * Simple Bitcoin testnet RPC client using public APIs
 */
export class BitcoinRPC {
  constructor(rpcUrl = 'https://blockstream.info/testnet/api') {
    this.rpcUrl = rpcUrl.replace(/\/$/, '') // Remove trailing slash
    this.isBlockstream = rpcUrl.includes('blockstream.info')
    this.isMempool = rpcUrl.includes('mempool.space')
    this.isBlockcypher = rpcUrl.includes('blockcypher.com')
  }

  /**
   * Get address balance
   * @param {string} address - Bitcoin address
   * @returns {Promise<Object>} Balance information
   */
  async getAddressBalance(address) {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/address/${address}`)
        const data = await response.json()
        
        return {
          confirmed: data.chain_stats?.funded_txo_sum || 0,
          unconfirmed: data.mempool_stats?.funded_txo_sum || 0,
          total: (data.chain_stats?.funded_txo_sum || 0) + (data.mempool_stats?.funded_txo_sum || 0)
        }
      } else if (this.isBlockcypher) {
        const response = await fetch(`${this.rpcUrl}/addrs/${address}/balance`)
        const data = await response.json()
        
        return {
          confirmed: data.balance || 0,
          unconfirmed: data.unconfirmed_balance || 0,
          total: (data.balance || 0) + (data.unconfirmed_balance || 0)
        }
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error fetching balance:', error.message)
      return { confirmed: 0, unconfirmed: 0, total: 0, error: error.message }
    }
  }

  /**
   * Get address UTXOs
   * @param {string} address - Bitcoin address
   * @returns {Promise<Array>} Array of UTXOs
   */
  async getAddressUtxos(address) {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/address/${address}/utxo`)
        const utxos = await response.json()
        
        return utxos.map(utxo => ({
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.value,
          confirmed: utxo.status?.confirmed || false
        }))
      } else if (this.isBlockcypher) {
        const response = await fetch(`${this.rpcUrl}/addrs/${address}?unspentOnly=true`)
        const data = await response.json()
        
        return (data.txrefs || []).map(utxo => ({
          txid: utxo.tx_hash,
          vout: utxo.tx_output_n,
          value: utxo.value,
          confirmed: utxo.confirmations > 0
        }))
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error fetching UTXOs:', error.message)
      return []
    }
  }

  /**
   * Get transaction details
   * @param {string} txid - Transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(txid) {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/tx/${txid}`)
        return await response.json()
      } else if (this.isBlockcypher) {
        const response = await fetch(`${this.rpcUrl}/txs/${txid}`)
        return await response.json()
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error fetching transaction:', error.message)
      return null
    }
  }

  /**
   * Broadcast transaction
   * @param {string} txHex - Transaction hex
   * @returns {Promise<string>} Transaction ID
   */
  async broadcastTransaction(txHex) {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/tx`, {
          method: 'POST',
          body: txHex,
          headers: { 'Content-Type': 'text/plain' }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        
        return await response.text()
      } else if (this.isBlockcypher) {
        const response = await fetch(`${this.rpcUrl}/txs/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tx: txHex })
        })
        
        const data = await response.json()
        return data.tx?.hash
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error broadcasting transaction:', error.message)
      throw error
    }
  }

  /**
   * Get current fee estimates
   * @returns {Promise<Object>} Fee estimates in sat/vB
   */
  async getFeeEstimates() {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/fee-estimates`)
        const fees = await response.json()
        
        return {
          fast: fees['1'] || 10,    // 1 block
          medium: fees['6'] || 5,   // 6 blocks  
          slow: fees['144'] || 1    // 144 blocks (1 day)
        }
      } else if (this.isBlockcypher) {
        // BlockCypher doesn't have fee estimates, use defaults
        return {
          fast: 10,
          medium: 5,
          slow: 1
        }
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error fetching fees:', error.message)
      return { fast: 10, medium: 5, slow: 1 }
    }
  }

  /**
   * Check if address has any transactions
   * @param {string} address - Bitcoin address
   * @returns {Promise<boolean>} True if address has transactions
   */
  async hasTransactions(address) {
    try {
      const balance = await this.getAddressBalance(address)
      return balance.total > 0 || balance.error === undefined
    } catch (error) {
      return false
    }
  }

  /**
   * Format satoshis to BTC
   * @param {number} satoshis - Amount in satoshis
   * @returns {string} Formatted BTC amount
   */
  static formatBTC(satoshis) {
    return (satoshis / 100000000).toFixed(8) + ' BTC'
  }

  /**
   * Get block height
   * @returns {Promise<number>} Current block height
   */
  async getBlockHeight() {
    try {
      if (this.isBlockstream || this.isMempool) {
        const response = await fetch(`${this.rpcUrl}/blocks/tip/height`)
        return parseInt(await response.text())
      } else if (this.isBlockcypher) {
        const response = await fetch(`${this.rpcUrl}`)
        const data = await response.json()
        return data.height
      }
      
      throw new Error('Unsupported RPC provider')
    } catch (error) {
      console.error('Error fetching block height:', error.message)
      return 0
    }
  }
}

// Example usage and testing
export async function testBitcoinRPC() {
  console.log('🧪 Testing Bitcoin RPC connections...\n')
  
  const providers = [
    'https://blockstream.info/testnet/api',
    'https://mempool.space/testnet/api',
    'https://api.blockcypher.com/v1/btc/test3'
  ]
  
  const testAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' // Example testnet address
  
  for (const provider of providers) {
    console.log(`🔗 Testing ${provider}...`)
    const rpc = new BitcoinRPC(provider)
    
    try {
      const balance = await rpc.getAddressBalance(testAddress)
      const height = await rpc.getBlockHeight()
      
      console.log(`   ✅ Connected - Block height: ${height}`)
      console.log(`   📊 Test address balance: ${BitcoinRPC.formatBTC(balance.total)}`)
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`)
    }
    console.log('')
  }
}