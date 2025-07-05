# Bitcoin HTLC Atomic Swaps

A complete cross-chain atomic swap implementation supporting Bitcoin HTLCs and Ethereum escrows for trustless BTC↔ETH swaps.

## 🚀 Features

- **Cross-Chain Atomic Swaps**: Trustless BTC↔ETH swaps using HTLCs and smart contracts
- **Bitcoin HTLCs**: Time-locked contracts with hash-based secret reveals
- **Ethereum Escrows**: Production-ready smart contracts with safety deposits
- **Testnet Ready**: Bitcoin testnet + Ethereum Sepolia integration
- **Real Testing**: End-to-end testing with actual blockchain networks
- **Security Features**: Timelock sequences, public operations, rescue mechanisms

## 🏗️ Architecture

### Core Components

**Bitcoin Side:**
- **`BitcoinHTLC`**: P2WSH HTLC script creation and transaction handling
- **`SwapCoordinator`**: High-level swap orchestration for both directions

**Ethereum Side:**
- **`MinimalEscrowFactory`**: Factory for creating deterministic escrow contracts
- **`MinimalEscrowSrc/Dst`**: Source and destination escrow implementations
- **Timelock System**: Multi-stage timelock with public operation periods

**Testing Infrastructure:**
- **`CrossChainSwapTester`**: End-to-end testing with real networks
- **Configuration**: JSON-based setup for different environments

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
# Install dependencies
npm install
cd evm-crossing && npm install
```

## 🎯 Usage

### Environment Setup

Create environment variables for testing:

```bash
# Bitcoin private key (32-byte hex)
export BTC_PRIVATE_KEY="your_bitcoin_private_key_hex"

# Ethereum private key (32-byte hex) 
export ETH_PRIVATE_KEY="your_ethereum_private_key_hex"

# Infura API key for Sepolia
export INFURA_KEY="your_infura_api_key"

# For contract deployment
export DEPLOYER="your_ethereum_private_key_hex"
export ETHERSCAN_API="your_etherscan_api_key"
```

### Quick Start

```bash
# Run Bitcoin-only demo
npm start

# Run Bitcoin examples
npm run example:btc-to-eth
npm run example:eth-to-btc

# Deploy Ethereum contracts to Sepolia
cd evm-crossing
npm run deploy:sepolia

# Run cross-chain test (after deployment)
cd ..
npm run test:cross-chain

# Run unit tests
npm test
```

### Cross-Chain Testing

1. **Deploy Contracts:**
   ```bash
   cd evm-crossing
   npm run deploy:sepolia
   ```

2. **Update Configuration:**
   Edit `config/test-config.json` with deployed contract addresses

3. **Fund Test Accounts:**
   - Get Sepolia ETH from faucets
   - Get Bitcoin testnet from faucets

4. **Run Cross-Chain Test:**
   ```bash
   npm run test:cross-chain
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

### Complete Cross-Chain Flow

### BTC → ETH
1. **Setup**: User and Resolver agree on swap terms
2. **Lock BTC**: User locks BTC in Bitcoin HTLC with secret hash
3. **Lock ETH**: Resolver locks ETH in Ethereum escrow with same secret hash
4. **Claim ETH**: User reveals secret on Ethereum to claim ETH
5. **Claim BTC**: Resolver uses revealed secret to claim BTC from HTLC
6. **Fallback**: If either party fails, funds are refunded after timeouts

### ETH → BTC
1. **Setup**: User and Resolver agree on swap terms  
2. **Lock ETH**: User locks ETH in Ethereum escrow with secret hash
3. **Lock BTC**: Resolver locks BTC in Bitcoin HTLC with same secret hash
4. **Claim BTC**: User reveals secret on Bitcoin to claim BTC
5. **Claim ETH**: Resolver uses revealed secret to claim ETH from escrow
6. **Fallback**: If either party fails, funds are refunded after timeouts

### Timelock Sequence

```
Time →  [Dst Withdrawal] [Dst Public] [Src Withdrawal] [Src Public] [Cancellation]
        ↑               ↑            ↑               ↑            ↑
        Maker claims    Anyone       Taker claims    Anyone       Refunds
        with secret     can claim    with secret     can claim    available
```
## 🔐 Security Features

- **Hash-locked**: Requires secret knowledge to claim funds
- **Time-locked**: Multiple timeout periods with automatic refunds
- **Atomic**: Both parties get their assets or neither does  
- **Trustless**: No third party required, enforced by code
- **Safety Deposits**: Incentivize honest behavior
- **Public Operations**: Community can help resolve stuck swaps
- **Rescue Mechanisms**: Emergency fund recovery for edge cases

## 🧪 Testing

### Unit Tests
```bash
# Bitcoin HTLC tests
npm test

# Ethereum contract tests  
cd evm-crossing && npm test
```

### Integration Tests
```bash
# Cross-chain atomic swap test
npm run test:cross-chain
```

### Manual Testing
1. Deploy contracts to testnets
2. Fund test accounts with testnet tokens
3. Execute swap steps manually
4. Verify atomic completion or refund

## 📁 Project Structure

```
├── src/                    # Bitcoin HTLC implementation
├── evm-crossing/          # Ethereum smart contracts
├── scripts/               # Cross-chain testing scripts
├── config/                # Test configuration
├── examples/              # Usage examples
└── test/                  # Unit tests
```

## 🔧 Configuration

Edit `config/test-config.json` to customize:
- Network endpoints
- Contract addresses  
- Timeout periods
- Swap amounts
- Safety deposit amounts

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
