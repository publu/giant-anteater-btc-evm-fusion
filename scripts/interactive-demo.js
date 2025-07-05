import * as bitcoin from 'bitcoin-sdk-js'

// use private key from environment or generate new key pair
let privkey1 = process.env.BTC_PRIVATE_KEY
let pubkey1
if (privkey1) {
  pubkey1 = await bitcoin.wallet.getPublicKey(privkey1)
} else {
  const keyPair = await bitcoin.wallet.generateKeyPair()
  privkey1 = keyPair.privateKey
  pubkey1 = keyPair.publicKey
}

// second key pair for the contract
const { publicKey: pubkey2, privateKey: privkey2 } = await bitcoin.wallet.generateKeyPair()

// build HTLC script
const HTLC = bitcoin.Opcode.OP_IF +
  (await bitcoin.script.generateTimeLockScript(2576085)) +
  (await bitcoin.data.pushData(pubkey1)) +
  pubkey1 +
  bitcoin.Opcode.OP_ELSE +
  (await bitcoin.script.generateHashLockScript('abcdef')) +
  (await bitcoin.data.pushData(pubkey2)) +
  pubkey2 +
  bitcoin.Opcode.OP_ENDIF +
  bitcoin.Opcode.OP_CHECKSIG

// p2wsh address for funding
const toAddress = await bitcoin.address.generateScriptAddress(HTLC)
console.log('HTLC address:', toAddress)

// optional transaction creation if env vars provided
if (process.env.TX_ID && process.env.TX_VALUE) {
  const txId = process.env.TX_ID
  const value = Number(process.env.TX_VALUE)
  const fee = Number(process.env.TX_FEE || 1000)

  const tx = new bitcoin.Transaction()
  await tx.addInput({ txHash: txId, index: 0, value })
  await tx.addOutput({ address: toAddress, value: value - fee })
  await tx.setLocktime(2576085)

  // spend using OP_IF branch
  await tx.signInputByScriptSig([
    await bitcoin.crypto.sign(
      await tx.getInputHashToSign(HTLC, 0),
      privkey1
    ),
    '01',
    HTLC
  ], 0)

  // To spend with OP_ELSE branch instead, comment the block above
  // and uncomment the block below:
  // await tx.signInputByScriptSig([
  //   await bitcoin.crypto.sign(
  //     await tx.getInputHashToSign(HTLC, 0),
  //     privkey2
  //   ),
  //   'abcdef',
  //   '',
  //   HTLC
  // ], 0)

  const txToBroadcast = await tx.getSignedHex()
  console.log('Signed TX:', txToBroadcast)
}
