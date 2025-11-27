require('dotenv').config();

const web3Config = {
  // WebSocket provider for real-time events
  provider: process.env.ETH_WSS_ENDPOINT || 'wss://arbitrum-sepolia.blockpi.network/v1/ws/public',
  
  // HTTP provider for transactions and queries
  httpProvider: process.env.ETH_HTTP_ENDPOINT || 'https://sepolia-rollup.arbitrum.io/rpc',
  
  // Contract address
  contractAddress: process.env.AUCTION_CONTRACT_ADDRESS || '0xC189A7E4Aa1dD9eD9a93758898E64aDe8bda5486',
  
  // Network configuration
  network: {
    chainId: process.env.CHAIN_ID || 421614, // Arbitrum Sepolia testnet
    name: process.env.NETWORK_NAME || 'Arbitrum Sepolia Testnet'
  },
  
  // Gas settings
  gas: {
    default: 3000000,
    max: 5000000,
    price: process.env.GAS_PRICE || 'auto'
  },
  
  // Platform wallet configuration
  platform: {
    privateKey: process.env.PLATFORM_PRIVATE_KEY,
    address: null // Will be derived from private key
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'ETH_WSS_ENDPOINT',
  'ETH_HTTP_ENDPOINT',
  'AUCTION_CONTRACT_ADDRESS',
  'PLATFORM_PRIVATE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('Using demo configuration. Some features may not work properly.');
}

module.exports = { web3Config };
