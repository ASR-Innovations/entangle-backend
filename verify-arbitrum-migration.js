#!/usr/bin/env node

/**
 * Arbitrum Sepolia Migration Verification Script
 * 
 * This script verifies that all configuration has been properly
 * updated for Arbitrum Sepolia testnet migration.
 */

require('dotenv').config();
const { ethers } = require('ethers');

const EXPECTED_CHAIN_ID = 421614; // Arbitrum Sepolia
const EXPECTED_NETWORK = 'ARBITRUM_SEPOLIA';

console.log('🔍 Verifying Arbitrum Sepolia Migration...\n');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

let hasErrors = false;

// 1. Check Environment Variables
console.log('📋 Checking Environment Variables...\n');

// Check BLOCKCHAIN_NETWORK
if (process.env.BLOCKCHAIN_NETWORK === EXPECTED_NETWORK) {
  success(`BLOCKCHAIN_NETWORK = ${process.env.BLOCKCHAIN_NETWORK}`);
} else {
  error(`BLOCKCHAIN_NETWORK should be "${EXPECTED_NETWORK}", got "${process.env.BLOCKCHAIN_NETWORK}"`);
  hasErrors = true;
}

// Check SEAPORT_CHAIN_ID
const seaportChainId = parseInt(process.env.SEAPORT_CHAIN_ID);
if (seaportChainId === EXPECTED_CHAIN_ID) {
  success(`SEAPORT_CHAIN_ID = ${seaportChainId}`);
} else {
  error(`SEAPORT_CHAIN_ID should be ${EXPECTED_CHAIN_ID}, got ${seaportChainId}`);
  hasErrors = true;
}

// Check RPC URLs contain arbitrum
const rpcUrl = process.env.RPC_URL || '';
if (rpcUrl.includes('arbitrum') || rpcUrl.includes('arb')) {
  success(`RPC_URL points to Arbitrum: ${rpcUrl}`);
} else {
  error(`RPC_URL should point to Arbitrum Sepolia, got: ${rpcUrl}`);
  hasErrors = true;
}

const wsRpcUrl = process.env.WS_RPC_URL || '';
if (wsRpcUrl.includes('arbitrum') || wsRpcUrl.includes('arb')) {
  success(`WS_RPC_URL points to Arbitrum: ${wsRpcUrl}`);
} else {
  error(`WS_RPC_URL should point to Arbitrum Sepolia, got: ${wsRpcUrl}`);
  hasErrors = true;
}

// Check contract addresses
const auctionContract = process.env.AUCTION_CONTRACT_ADDRESS;
if (auctionContract && auctionContract.startsWith('0x')) {
  success(`AUCTION_CONTRACT_ADDRESS = ${auctionContract}`);
  warning('Make sure this contract is deployed on Arbitrum Sepolia!');
} else {
  error('AUCTION_CONTRACT_ADDRESS is not set or invalid');
  hasErrors = true;
}

const seaportContract = process.env.SEAPORT_CONTRACT_ADDRESS;
if (seaportContract === '0x0000000000000068F116a894984e2DB1123eB395') {
  success(`SEAPORT_CONTRACT_ADDRESS = ${seaportContract} (Seaport 1.6)`);
} else {
  warning(`SEAPORT_CONTRACT_ADDRESS = ${seaportContract} (verify this is correct for Arbitrum Sepolia)`);
}

console.log('\n');

// 2. Test RPC Connection
console.log('🌐 Testing RPC Connection...\n');

async function testConnection() {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Test connection with timeout
    const networkPromise = provider.getNetwork();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    );
    
    const network = await Promise.race([networkPromise, timeoutPromise]);
    const chainId = Number(network.chainId);
    
    if (chainId === EXPECTED_CHAIN_ID) {
      success(`Connected to Arbitrum Sepolia (Chain ID: ${chainId})`);
    } else {
      error(`Connected to wrong network! Chain ID: ${chainId}, expected: ${EXPECTED_CHAIN_ID}`);
      hasErrors = true;
    }
    
    // Get current block
    const blockNumber = await provider.getBlockNumber();
    success(`Current block number: ${blockNumber}`);
    
    // Test WebSocket connection
    console.log('\n🔌 Testing WebSocket Connection...\n');
    try {
      const wsProvider = new ethers.WebSocketProvider(wsRpcUrl);
      
      // Add error handler to prevent unhandled errors
      wsProvider.websocket.on('error', (err) => {
        // Error will be caught below
      });
      
      // Add timeout for WebSocket connection
      const wsNetworkPromise = wsProvider.getNetwork();
      const wsTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WebSocket timeout after 5 seconds')), 5000)
      );
      
      const wsNetwork = await Promise.race([wsNetworkPromise, wsTimeoutPromise]);
      const wsChainId = Number(wsNetwork.chainId);
      
      if (wsChainId === EXPECTED_CHAIN_ID) {
        success(`WebSocket connected to Arbitrum Sepolia (Chain ID: ${wsChainId})`);
      } else {
        error(`WebSocket connected to wrong network! Chain ID: ${wsChainId}`);
        hasErrors = true;
      }
      
      await wsProvider.destroy();
    } catch (wsError) {
      warning(`WebSocket connection failed: ${wsError.message}`);
      warning('Public WebSocket endpoints may have restrictions. Consider using Alchemy or Infura for production.');
      info('HTTP RPC is working, which is sufficient for most operations.');
    }
    
  } catch (err) {
    error(`RPC connection failed: ${err.message}`);
    hasErrors = true;
  }
}

// 3. Check Contract Service Configuration
console.log('\n⚙️  Checking Contract Service Configuration...\n');

try {
  const ContractService = require('./src/services/ContractService.js');
  const { ContractService: CS } = ContractService;
  
  const contractService = new CS();
  
  if (contractService.network === EXPECTED_NETWORK) {
    success(`Contract Service network: ${contractService.network}`);
  } else {
    error(`Contract Service should use ${EXPECTED_NETWORK}, got: ${contractService.network}`);
    hasErrors = true;
  }
  
  if (contractService.config.chainId === EXPECTED_CHAIN_ID) {
    success(`Contract Service chain ID: ${contractService.config.chainId}`);
  } else {
    error(`Contract Service chain ID should be ${EXPECTED_CHAIN_ID}, got: ${contractService.config.chainId}`);
    hasErrors = true;
  }
  
  if (contractService.config.blockTime === 0.25) {
    success(`Contract Service block time: ${contractService.config.blockTime} seconds (Arbitrum)`);
  } else {
    warning(`Contract Service block time: ${contractService.config.blockTime} seconds (expected 0.25 for Arbitrum)`);
  }
  
  info(`Contract Service RPC: ${contractService.rpcUrl}`);
  info(`Contract Service Explorer: ${contractService.config.explorer}`);
  
} catch (err) {
  error(`Failed to load Contract Service: ${err.message}`);
  hasErrors = true;
}

// Run async tests
testConnection().then(() => {
  console.log('\n' + '='.repeat(60) + '\n');
  
  if (hasErrors) {
    error('Migration verification FAILED - please fix the errors above');
    console.log('\n📖 See ARBITRUM_SEPOLIA_MIGRATION.md for detailed instructions\n');
    process.exit(1);
  } else {
    success('Migration verification PASSED!');
    console.log('\n✨ All checks passed! Your backend is configured for Arbitrum Sepolia.\n');
    
    console.log('📝 Next Steps:');
    console.log('   1. Deploy your auction contract to Arbitrum Sepolia');
    console.log('   2. Update AUCTION_CONTRACT_ADDRESS in .env');
    console.log('   3. Update your frontend to use Chain ID 421614');
    console.log('   4. Test auction creation and bidding\n');
    
    console.log('📚 Resources:');
    console.log('   - Faucet: https://faucet.quicknode.com/arbitrum/sepolia');
    console.log('   - Explorer: https://sepolia.arbiscan.io');
    console.log('   - Docs: https://docs.arbitrum.io\n');
  }
}).catch(err => {
  error(`Verification failed: ${err.message}`);
  process.exit(1);
});
