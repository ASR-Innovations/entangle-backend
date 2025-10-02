const axios = require('axios');
const { pool } = require('./src/config/database');
const ethers = require('ethers');

const BASE_URL = 'http://localhost:5009/api';

async function testAuctionAPI() {
  console.log('\n🧪 Testing POST /api/auctions/created - Auction Creation API\n');
  
  try {
    // Step 1: Authenticate with Para
    console.log('Step 1: Authenticating with Para...');
    const authResponse = await axios.post(`${BASE_URL}/auth/para-auth`, {
      verificationToken: '1db0ccca-fcb4-42ed-8b15-1c4dbf9d95b8',
      walletAddress: '0x6daa02F03f05D7330ec10F12E66Ac3db0Cd7718d'
    });
    
    const authToken = authResponse.data.token;
    console.log('✅ Authenticated');
    console.log('   User:', authResponse.data.session.userId);
    console.log('   Wallet:', authResponse.data.session.walletAddress);
    console.log();
    
    // Step 2: Get blockchain data to find a transaction
    console.log('Step 2: Connecting to blockchain to find auction creation transaction...');
    const { getContractService } = require('./src/services/ContractService');
    const contractService = getContractService();
    await contractService.initialize();
    
    const provider = contractService.provider;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    
    console.log('   Contract:', contractAddress);
    
    // Get recent AuctionCreated events
    console.log('   Searching for AuctionCreated events...');
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 2000; // Last 2000 blocks (within RPC limit)
    
    console.log(`   Scanning blocks ${fromBlock} to ${currentBlock}...`);
    const filter = contractService.contract.filters.AuctionCreated();
    const events = await contractService.contract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`   Found ${events.length} auction creation events`);
    
    if (events.length === 0) {
      console.log('\n❌ No auction creation events found in recent blocks');
      console.log('   Please create an auction on the blockchain first\n');
      return;
    }
    
    // Find an auction that's not in the database yet
    let auctionToTest = null;
    let transactionHash = null;
    
    // Check a few recent auctions
    const testAuctionIds = [16, 2, 3, 12]; // Active auctions from cron logs
    
    for (const testId of testAuctionIds) {
      const existingCheck = await pool.query('SELECT id FROM auctions WHERE id = $1', [testId]);
      if (existingCheck.rows.length === 0) {
        // Find transaction for this auction
        const matchingEvent = events.find(e => Number(e.args.auctionId) === testId);
        if (matchingEvent) {
          auctionToTest = testId;
          transactionHash = matchingEvent.transactionHash;
          break;
        }
      }
    }
    
    // If all are in database, use the latest one anyway
    if (!auctionToTest) {
      const lastEvent = events[events.length - 1];
      auctionToTest = Number(lastEvent.args.auctionId);
      transactionHash = lastEvent.transactionHash;
      console.log(`   ⚠️  All test auctions already in DB, using auction #${auctionToTest} anyway`);
    } else {
      console.log(`   ✅ Found auction #${auctionToTest} not in database yet`);
    }
    
    const auctionId = auctionToTest;
    console.log(`   Transaction: ${transactionHash}`);
    
    // Final check
    const existingCheck = await pool.query('SELECT id FROM auctions WHERE id = $1', [auctionId]);
    
    if (existingCheck.rows.length > 0) {
      console.log(`   ⚠️  Auction #${auctionId} already in database`);
      console.log('\nStep 3: Showing database state instead...');
    } else {
      // Step 3: Call the API to record the auction
      console.log('\nStep 3: Calling POST /api/auctions/created API...');
      
      const auctionData = await contractService.getAuction(auctionId);
      console.log('   Auction data from blockchain:', {
        host: auctionData.host,
        eventName: auctionData.eventName,
        duration: auctionData.duration,
        reservePrice: auctionData.reservePrice
      });
      
      // Ensure creator exists in database (needed for foreign key constraint)
      const creatorWallet = auctionData.host.toLowerCase();
      const userCheck = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [creatorWallet]);
      
      if (userCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (para_user_id, wallet_address, display_name, auth_type)
           VALUES ($1, $2, $3, $4)`,
          [`wallet_${creatorWallet.slice(2, 12)}`, creatorWallet, auctionData.sellerName || 'Auction Creator', 'wallet']
        );
        console.log(`   ✅ Created user for wallet ${creatorWallet}`);
      } else {
        console.log(`   ✅ User already exists for wallet ${creatorWallet}`);
      }
      
      const apiPayload = {
        title: auctionData.eventName || `Auction #${auctionId}`,
        description: auctionData.sellerName || 'Test auction',
        duration: auctionData.duration,
        reservePrice: auctionData.reservePrice,
        meetingDuration: 60, // Default to 60 minutes
        creatorWallet: auctionData.host,
        transactionHash: transactionHash
      };
      
      console.log('   Payload:', JSON.stringify(apiPayload, null, 2));
      
      const response = await axios.post(
        `${BASE_URL}/auctions/created`,
        apiPayload,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('\n✅ API Response:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
    // Step 4: Verify in database
    console.log('\nStep 4: Verifying database...');
    const dbResult = await pool.query('SELECT * FROM auctions ORDER BY created_at DESC LIMIT 1');
    
    if (dbResult.rows.length > 0) {
      console.log('✅ Latest auction in database:');
      const auction = dbResult.rows[0];
      console.log(`   ID: ${auction.id}`);
      console.log(`   Title: ${auction.title}`);
      console.log(`   Creator: ${auction.creator_para_id}`);
      console.log(`   Wallet: ${auction.creator_wallet}`);
      console.log(`   Meeting Duration: ${auction.meeting_duration} minutes`);
    }
    
    const countResult = await pool.query('SELECT COUNT(*) FROM auctions');
    console.log(`\n📊 Total auctions in database: ${countResult.rows[0].count}`);
    
    console.log('\n✅ TEST COMPLETED!\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
      if (error.stack) console.error(error.stack);
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testAuctionAPI();

 