import readline from 'readline'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { SwapCoordinator } from '../src/swap-coordinator.js'

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

const network = bitcoin.networks.testnet
const coordinator = new SwapCoordinator(network)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

let fundingTxId = 'fundingtxid'
let fundingVout = 0
let fundingValue = 10000
async function main() {
  console.log('\uD83D\uDD2E BTC HTLC Timelock Demo\n')

  const userKey = ECPair.makeRandom({ network })
  const resolverKey = ECPair.makeRandom({ network })
  const { secret, hash: secretHash } = coordinator.htlc.generateSecret()

  const lockSeconds = 30
  const swap = coordinator.setupBTCtoETH(userKey, resolverKey, secretHash, lockSeconds / 3600)

  console.log('\uD83D\uDD10 HTLC Address:', swap.p2shAddress)
  console.log('🔗 Explorer:', `https://mempool.space/testnet/address/${swap.p2shAddress}`)
  console.log('\uD83D\uDD11 Secret Hash :', secretHash.toString('hex'))
  console.log('\uD83D\uDDDD Secret      :', secret.toString('hex'))
  console.log('\u23F0 Timeout     :', lockSeconds, 'seconds from now\n')

  fundingTxId = await new Promise(res => {
    rl.question('Enter funding TXID (or press enter for example): ', ans => res(ans.trim() || 'fundingtxid'))
  })
  fundingVout = await new Promise(res => {
    rl.question('Funding output index [0]: ', ans => res(ans.trim() ? parseInt(ans.trim()) : 0))
  })
  fundingValue = await new Promise(res => {
    rl.question('Funding amount in satoshis [10000]: ', ans => res(ans.trim() ? parseInt(ans.trim()) : 10000))
  })
  const endTime = Date.now() + lockSeconds * 1000
  console.log('\u23F3 Waiting for timelock... type "claim" to claim early')
  rl.prompt()

  const timer = setInterval(() => {
    const diff = Math.max(0, Math.round((endTime - Date.now()) / 1000))
    const emoji = diff % 2 === 0 ? '\u231B' : '\u23F3'
    process.stdout.write(`\r${emoji} ${diff}s remaining`)
    if (diff <= 0) {
      clearInterval(timer)
      console.log('\n\uD83D\uDD12 Timelock passed! You may refund the BTC.')
      askReturn()
    }
  }, 1000)

  rl.on('line', line => {
    if (line.trim().toLowerCase() === 'claim') {
      clearInterval(timer)
      claimFunds(secret, swap)
    } else {
      rl.prompt()
    }
  })
}

function claimFunds(secret, swap) {
  const destKey = ECPair.makeRandom({ network })
  const destAddr = bitcoin.payments.p2wpkh({ pubkey: destKey.publicKey, network }).address
  console.log('\n\uD83D\uDD27 Claiming funds with secret...')
  const tx = coordinator.createRedeemTransaction(
    swap,
    fundingTxId,
    fundingVout,
    fundingValue,
    destAddr,
    secret,
    1000
  )
  console.log('\u2705 Example Redeem TX:', tx.slice(0, 60) + '...')
  console.log('\uD83D\uDCB5 Claimed to address:', destAddr)
  askReturn()
}

function askReturn() {
  rl.question('\n\u27A1\uFE0F When finished testing, send the BTC back to your wallet: ', () => {
    console.log('Thanks for trying the demo!')
    rl.close()
  })
}

main().catch(err => {
  console.error('Error:', err.message)
  rl.close()
})
