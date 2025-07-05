# Bitcoin HTLC Atomic Swaps

A complete Bitcoin Hash Time Locked Contract (HTLC) implementation for atomic swaps supporting both BTC→ETH and ETH→BTC directions.

## 🚀 Features

- **Bidirectional Swaps**: Support for both BTC→ETH and ETH→BTC atomic swaps
- **Secure HTLCs**: Time-locked contracts with hash-based secret reveals
- **Testnet Ready**: Configured for Bitcoin testnet by default
- **Modular Design**: Clean separation of concerns with reusable components
- **Comprehensive Testing**: Full test suite for all functionality

## 🏗️ Architecture

### Core Components

- **`BitcoinHTLC`**: Core HTLC script creation and transaction handling
- **`SwapCoordinator`**: High-level swap orchestration for both directions
- **Examples**: Working examples for both swap directions
- **Tests**: Comprehensive test suite

### Script Logic

```
OP_IF
  <redeemer_pubkey> OP_CHECKSIGVERIFY
  OP_SHA256 <secret_hash> OP_EQUALVERIFY
OP_ELSE
  <locktime> OP_CHECKLOCKTIMEVERIFY
  OP_DROP
  <refunder_pubkey> OP_CHECKSIGVERIFY
OP_ENDIF
```

## 📦 Installation

```bash
npm install
```

## 🎯 Usage

### Quick Start

```bash
# Run demo
npm start

# Run examples
npm run example:btc-to-eth
npm run example:eth-to-btc

# Run tests
npm test
```

### BTC → ETH Swap

```javascript
import { SwapCoordinator } from './src/swap-coordinator.js'
import * as bitcoin from 'bitcoinjs-lib'

const coordinator = new SwapCoordinator(bitcoin.networks.testnet)
const userKey = bitcoin.ECPair.makeRandom({ network })
const resolverPubKey = bitcoin.ECPair.makeRandom({ network }).publicKey
const { secret, hash } = coordinator.htlc.generateSecret()

// Setup swap
const swapConfig = coordinator.setupBTCtoETH(userKey, resolverPubKey, hash, 24)

console.log('Send BTC to:', swapConfig.address)
```

### ETH → BTC Swap

```javascript
const userPubKey = bitcoin.ECPair.makeRandom({ network }).publicKey
const resolverKey = bitcoin.ECPair.makeRandom({ network })

// Setup swap
const swapConfig = coordinator.setupETHtoBTC(userPubKey, resolverKey, hash, 24)

console.log('Send BTC to:', swapConfig.address)
```

## 🔄 Swap Flow

### BTC → ETH
1. User locks BTC in HTLC
2. Resolver sets up corresponding ETH HTLC
3. User reveals secret on Ethereum to claim ETH
4. Resolver uses revealed secret to claim BTC

### ETH → BTC
1. User sets up ETH HTLC
2. Resolver locks BTC in HTLC
3. User reveals secret on Ethereum to claim BTC
4. Resolver uses revealed secret to claim ETH

## 🔐 Security Features

- **Hash-locked**: Requires secret to claim funds
- **Time-locked**: Automatic refund after timeout
- **Atomic**: Both parties get their assets or neither does
- **Trustless**: No third party required

## 🧪 Testing

The test suite covers:
- HTLC script creation
- Address generation
- Secret generation and verification
- Swap coordinator functionality
- Witness creation
- Error handling

## 📚 API Reference

### BitcoinHTLC

- `createHTLCScript(redeemerPubKey, refunderPubKey, secretHash, locktime)`
- `getHTLCAddress(script)`
- `createRedeemWitness(signature, pubKey, secret, script)`
- `createRefundWitness(signature, pubKey, script)`
- `generateSecret()`
- `verifySecret(secret, hash)`

### SwapCoordinator

- `setupBTCtoETH(userKey, resolverPubKey, secretHash, timeoutHours)`
- `setupETHtoBTC(userPubKey, resolverKey, secretHash, timeoutHours)`
- `createRedeemTransaction(swapConfig, fundingTxId, ...)`
- `createRefundTransaction(swapConfig, fundingTxId, ...)`
