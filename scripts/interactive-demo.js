import readline from 'readline'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { SwapCoordinator } from '../src/swap-coordinator.js'
import { BitcoinRPC } from "../src/bitcoin-rpc.js"

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

const network = bitcoin.networks.testnet
const coordinator = new SwapCoordinator(network)
const rpc = new BitcoinRPC(process.env.BTC_RPC || "https://mempool.space/testnet/api")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function ask(question, def = '') {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim() || def))
  })
}

async function runDemo() {
  console.log('\uD83D\uDD2E Guided Bitcoin HTLC Demo\n')

  await ask('Press enter to set up the HTLC...')

  const userKey = process.env.BTC_PRIVATE_KEY
    ? ECPair.fromPrivateKey(Buffer.from(process.env.BTC_PRIVATE_KEY, 'hex'), { network })
    : ECPair.makeRandom({ network })

  const resolverKey = ECPair.makeRandom({ network })
  const { secret, hash: secretHash } = coordinator.htlc.generateSecret()
  const lockSeconds = 30
  const swap = coordinator.setupBTCtoETH(userKey, resolverKey, secretHash, lockSeconds / 3600)

  console.log('\uD83D\uDD10 HTLC Address:', swap.p2shAddress)
  console.log('🔗 Explorer:', `https://mempool.space/testnet/address/${swap.p2shAddress}`)
  console.log('\uD83D\uDD11 Secret Hash:', secretHash.toString('hex'))
  console.log('\uD83D\uDDDD Secret     :', secret.toString('hex'))
  console.log('\u23F0 Timeout     :', lockSeconds, 'seconds from now\n')

  console.log('Step 1️⃣  Send BTC to the address above.')
  await ask('Press enter once funded...')

  const fundingTxId = await ask('Funding TXID: ')
  const fundingVout = parseInt(await ask('Output index [0]: ', '0'))
  const fundingValue = parseInt(await ask('Amount in satoshis [10000]: ', '10000'))

  console.log('\nStep 2️⃣  Waiting for timelock. Type "claim" to claim early.')
  rl.prompt()

  const endTime = Date.now() + lockSeconds * 1000
  const timer = setInterval(() => {
    const diff = Math.max(0, Math.round((endTime - Date.now()) / 1000))
    const emoji = diff % 2 === 0 ? '\u231B' : '\u23F3'
    process.stdout.write(`\r${emoji} ${diff}s remaining `)
    if (diff <= 0) {
      clearInterval(timer)
      console.log('\n\uD83D\uDD12 Timelock passed. Creating refund transaction...')
      doRefund().catch(err => {
        console.error('Error:', err.message)
        rl.close()
      })
    }
  }, 1000)

  rl.on('line', line => {
    if (line.trim().toLowerCase() === 'claim') {
      clearInterval(timer)
      doClaim().catch(err => {
        console.error('Error:', err.message)
        rl.close()
      })
    } else {
      rl.prompt()
    }
  })

  async function doClaim() {
    const destAddr = 'mnYZWwsHPGUVpRsHk78Rp4dsDn2u412R27'
    console.log('\n\uD83D\uDD27 Creating redeem transaction...')
    const tx = coordinator.createRedeemTransaction(
      swap,
      fundingTxId,
      fundingVout,
      fundingValue,
      destAddr,
      secret,
      1000
    )
    console.log('\u2705 Redeem TX:', tx.slice(0, 60) + '...')
    const broadcast = await ask('Broadcast transaction to testnet? [y/N]: ')
    if (broadcast.toLowerCase() === 'y') {
      try {
        const txid = await rpc.broadcastTransaction(tx)
        console.log('\uD83D\uDE80 Broadcast TXID:', txid)
      } catch (err) {
        console.log('\u274C Broadcast failed:', err.message)
      }
    }
    console.log('\uD83D\uDCB5 Destination:', destAddr)
    askReturn()
  }

  async function doRefund() {
    const refundAddr = bitcoin.payments.p2wpkh({ pubkey: userKey.publicKey, network }).address
    const tx = coordinator.createRefundTransaction(
      swap,
      fundingTxId,
      fundingVout,
      fundingValue,
      refundAddr,
      1000
    )
    console.log('\u2705 Refund TX:', tx.slice(0, 60) + '...')
    const broadcast = await ask('Broadcast transaction to testnet? [y/N]: ')
    if (broadcast.toLowerCase() === 'y') {
      try {
        const txid = await rpc.broadcastTransaction(tx)
        console.log('\uD83D\uDE80 Broadcast TXID:', txid)
      } catch (err) {
        console.log('\u274C Broadcast failed:', err.message)
      }
    }
    console.log('\uD83D\uDCB5 Destination:', refundAddr)
    askReturn()
  }

  function askReturn() {
    rl.question('\n\u27A1\uFE0F When finished testing, send the BTC back to your wallet. Press enter to exit.', () => {
      console.log('Thanks for trying the demo!')
      rl.close()
    })
  }
}

runDemo().catch(err => {
  console.error('Error:', err.message)
  rl.close()
})
