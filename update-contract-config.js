#!/usr/bin/env node

/**
 * UPDATE CONTRACT CONFIGURATION
 * Updates backend configuration to use the new contract address
 */

const fs = require('fs');
const path = require('path');

const NEW_CONTRACT_ADDRESS = '0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC';

console.log('🔧 UPDATING CONTRACT CONFIGURATION');
console.log('=' .repeat(60));
console.log(`New Contract Address: ${NEW_CONTRACT_ADDRESS}`);

/**
 * Update Web3Service configuration
 */
function updateWeb3Service() {
  console.log('\n📋 Updating Web3Service configuration...');
  
  const web3ServicePath = path.join(__dirname, 'src/services/Web3Service.js');
  
  try {
    let content = fs.readFileSync(web3ServicePath, 'utf8');
    
    // Update contract address in CONTRACT_CONFIG
    content = content.replace(
      /address: '0x[^']*'/g,
      `address: '${NEW_CONTRACT_ADDRESS}'`
    );
    
    fs.writeFileSync(web3ServicePath, content);
    console.log('✅ Web3Service updated');
  } catch (error) {
    console.error('❌ Failed to update Web3Service:', error.message);
  }
}

/**
 * Update auction routes configuration
 */
function updateAuctionRoutes() {
  console.log('\n📋 Updating auction routes configuration...');
  
  const auctionRoutesPath = path.join(__dirname, 'src/routes/auctions.js');
  
  try {
    let content = fs.readFileSync(auctionRoutesPath, 'utf8');
    
    // Update contract address
    content = content.replace(
      /const contractAddress = process\.env\.CONTRACT_ADDRESS \|\| '[^']*'/g,
      `const contractAddress = process.env.CONTRACT_ADDRESS || '${NEW_CONTRACT_ADDRESS}'`
    );
    
    fs.writeFileSync(auctionRoutesPath, content);
    console.log('✅ Auction routes updated');
  } catch (error) {
    console.error('❌ Failed to update auction routes:', error.message);
  }
}

/**
 * Update environment example file
 */
function updateEnvExample() {
  console.log('\n📋 Updating environment example...');
  
  const envExamplePath = path.join(__dirname, '.env.example');
  
  try {
    let content = '';
    
    if (fs.existsSync(envExamplePath)) {
      content = fs.readFileSync(envExamplePath, 'utf8');
    }
    
    // Add or update contract address
    if (content.includes('CONTRACT_ADDRESS=')) {
      content = content.replace(
        /CONTRACT_ADDRESS=.*/g,
        `CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}`
      );
    } else {
      content += `\n# Contract Configuration\nCONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}\n`;
    }
    
    fs.writeFileSync(envExamplePath, content);
    console.log('✅ Environment example updated');
  } catch (error) {
    console.error('❌ Failed to update environment example:', error.message);
  }
}

/**
 * Create environment file with new contract address
 */
function createEnvFile() {
  console.log('\n📋 Creating environment file...');
  
  const envPath = path.join(__dirname, '.env');
  
  try {
    let content = '';
    
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    
    // Add or update contract address
    if (content.includes('CONTRACT_ADDRESS=')) {
      content = content.replace(
        /CONTRACT_ADDRESS=.*/g,
        `CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}`
      );
    } else {
      content += `\n# Contract Configuration\nCONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}\n`;
    }
    
    fs.writeFileSync(envPath, content);
    console.log('✅ Environment file updated');
  } catch (error) {
    console.error('❌ Failed to update environment file:', error.message);
  }
}

/**
 * Update test files
 */
function updateTestFiles() {
  console.log('\n📋 Updating test files...');
  
  const testFiles = [
    'test-real-apis.js',
    'test-meeting-flow.js',
    'test-contract-integration.js',
    'test-comprehensive-system.js'
  ];
  
  testFiles.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Update contract address in test files
        content = content.replace(
          /CONTRACT_ADDRESS.*=.*'0x[^']*'/g,
          `CONTRACT_ADDRESS = '${NEW_CONTRACT_ADDRESS}'`
        );
        
        content = content.replace(
          /contractAddress.*=.*'0x[^']*'/g,
          `contractAddress = '${NEW_CONTRACT_ADDRESS}'`
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${fileName} updated`);
      } catch (error) {
        console.error(`❌ Failed to update ${fileName}:`, error.message);
      }
    }
  });
}

/**
 * Create contract verification script
 */
function createContractVerificationScript() {
  console.log('\n📋 Creating contract verification script...');
  
  const scriptContent = `#!/usr/bin/env node

/**
 * VERIFY CONTRACT INTEGRATION
 * Verifies that the new contract address is working correctly
 */

require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '${NEW_CONTRACT_ADDRESS}';
const RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

async function verifyContract() {
  try {
    console.log('🔍 Verifying contract integration...');
    console.log('Contract Address:', CONTRACT_ADDRESS);
    console.log('RPC URL:', RPC_URL);
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    console.log('Network:', network.name, '(Chain ID:', network.chainId, ')');
    
    const MeetingAuctionABI = require('./src/contracts/MeetingAuction.json');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, MeetingAuctionABI, provider);
    
    const auctionCounter = await contract.auctionCounter();
    const platformFee = await contract.platformFee();
    const owner = await contract.owner();
    
    console.log('✅ Contract verification successful!');
    console.log('Total Auctions:', auctionCounter.toString());
    console.log('Platform Fee:', platformFee.toString(), 'basis points');
    console.log('Owner:', owner);
    
  } catch (error) {
    console.error('❌ Contract verification failed:', error.message);
    process.exit(1);
  }
}

verifyContract();
`;

  const scriptPath = path.join(__dirname, 'verify-contract.js');
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');
  console.log('✅ Contract verification script created');
}

/**
 * Run all updates
 */
function runUpdates() {
  console.log('🚀 Starting configuration updates...\n');
  
  updateWeb3Service();
  updateAuctionRoutes();
  updateEnvExample();
  createEnvFile();
  updateTestFiles();
  createContractVerificationScript();
  
  console.log('\n🎉 CONFIGURATION UPDATE COMPLETE');
  console.log('=' .repeat(60));
  console.log('✅ All files updated with new contract address');
  console.log('✅ Environment files created/updated');
  console.log('✅ Test files updated');
  console.log('✅ Verification script created');
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Run: node verify-contract.js');
  console.log('2. Run: node test-contract-integration.js');
  console.log('3. Run: node test-comprehensive-system.js');
  console.log('4. Start the backend: npm run dev');
  
  console.log('\n🔧 ENVIRONMENT VARIABLES TO SET:');
  console.log(`CONTRACT_ADDRESS=${NEW_CONTRACT_ADDRESS}`);
  console.log('RPC_URL=https://api.avax-test.network/ext/bc/C/rpc');
  console.log('JWT_SECRET=your-jwt-secret-here');
  console.log('DATABASE_URL=your-database-url-here');
  console.log('PARA_API_KEY=your-para-api-key-here');
  console.log('JITSI_SECRET=your-jitsi-secret-here');
}

// Run if called directly
if (require.main === module) {
  runUpdates();
}

module.exports = { runUpdates };




