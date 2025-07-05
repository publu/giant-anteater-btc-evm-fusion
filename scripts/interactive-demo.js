import readline from 'readline'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { SwapCoordinator } from '../src/swap-coordinator.js'

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

const network = bitcoin.networks.testnet
const coordinator = new SwapCoordinator(network)

let swapConfig
let secret
let secretHash
let userKey
let resolverKey

function setupBTCtoETH() {
  userKey = ECPair.makeRandom({ network })
  resolverKey = ECPair.makeRandom({ network })
  const res = coordinator.htlc.generateSecret()
  secret = res.secret
  secretHash = res.hash
  swapConfig = coordinator.setupBTCtoETH(userKey, resolverKey, secretHash, 24)
  console.log('BTC->ETH HTLC created')
  console.log('  Address:', swapConfig.p2shAddress)
  console.log('  Explorer: https://mempool.space/testnet/address/' + swapConfig.p2shAddress)
  console.log('  Secret Hash:', secretHash.toString('hex'))
  console.log('  Secret     :', secret.toString('hex'))
}

function setupETHtoBTC() {
  userKey = ECPair.makeRandom({ network })
  resolverKey = ECPair.makeRandom({ network })
  const res = coordinator.htlc.generateSecret()
  secret = res.secret
  secretHash = res.hash
  swapConfig = coordinator.setupETHtoBTC(userKey.publicKey, resolverKey, secretHash, 24)
  console.log('ETH->BTC HTLC created')
  console.log('  Address:', swapConfig.p2shAddress)
  console.log('  Explorer: https://mempool.space/testnet/address/' + swapConfig.p2shAddress)
  console.log('  Secret Hash:', secretHash.toString('hex'))
  console.log('  Secret     :', secret.toString('hex'))
}

function handleRedeem(args) {
  if (!swapConfig) {
    console.log('Setup a swap first with setup-btc or setup-eth')
    return
  }
  if (args.length < 5) {
    console.log('Usage: redeem <txid> <vout> <value> <address> <secret>')
    return
  }
  const [txid, voutStr, valStr, addr, secretHex] = args
  const vout = parseInt(voutStr)
  const value = parseInt(valStr)
  const sec = Buffer.from(secretHex, 'hex')
  try {
    const tx = coordinator.createRedeemTransaction(
      swapConfig,
      txid,
      vout,
      value,
      addr,
      sec,
      1000
    )
    console.log('Redeem TX:', tx)
  } catch (e) {
    console.log('Error creating redeem transaction:', e.message)
  }
}

function handleRefund(args) {
  if (!swapConfig) {
    console.log('Setup a swap first with setup-btc or setup-eth')
    return
  }
  if (args.length < 4) {
    console.log('Usage: refund <txid> <vout> <value> <address>')
    return
  }
  const [txid, voutStr, valStr, addr] = args
  const vout = parseInt(voutStr)
  const value = parseInt(valStr)
  try {
    const tx = coordinator.createRefundTransaction(
      swapConfig,
      txid,
      vout,
      value,
      addr,
      1000
    )
    console.log('Refund TX:', tx)
  } catch (e) {
    console.log('Error creating refund transaction:', e.message)
  }
}

console.log('Interactive Bitcoin HTLC Demo')
console.log('Commands:')
console.log('  setup-btc         Create BTC->ETH HTLC')
console.log('  setup-eth         Create ETH->BTC HTLC')
console.log('  redeem <txid> <vout> <value> <address> <secret>')
console.log('  refund <txid> <vout> <value> <address>')
console.log('  exit')
rl.prompt()

rl.on('line', line => {
  const [command, ...args] = line.trim().split(/\s+/)
  switch(command) {
    case 'setup-btc':
      setupBTCtoETH()
      break
    case 'setup-eth':
      setupETHtoBTC()
      break
    case 'redeem':
      handleRedeem(args)
      break
    case 'refund':
      handleRefund(args)
      break
    case 'exit':
      rl.close()
      return
    default:
      console.log('Unknown command')
  }
  rl.prompt()
})

rl.on('close', () => {
  console.log('Goodbye!')
})
