require('dotenv').config();

const web3Config = {
  // WebSocket provider for real-time events
  provider: process.env.ETH_WSS_ENDPOINT || 'wss://eth-sepolia.g.alchemy.com/v2/demo',
  
  // HTTP provider for transactions and queries
  httpProvider: process.env.ETH_HTTP_ENDPOINT || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  
  // Contract address
  contractAddress: process.env.AUCTION_CONTRACT_ADDRESS || '0x6fD65aE833C9679cBC571581CE0f5Cd73D565796',
  
  // Network configuration
  network: {
    chainId: process.env.CHAIN_ID || 11155111, // Sepolia testnet
    name: process.env.NETWORK_NAME || 'Sepolia Testnet'
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
