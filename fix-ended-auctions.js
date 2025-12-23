const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixEndedAuctions() {
  console.log('🔧 Fixing auctions where autoEnded=true but ended=false...\n');
  
  // Find problematic auctions
  const result = await pool.query(`
    SELECT id, title, auto_ended, ended, end_block, highest_bid, highest_bidder
    FROM auctions 
    WHERE auto_ended = true AND ended = false
  `);
  
  console.log(`Found ${result.rows.length} auctions to fix:\n`);
  
  for (const auction of result.rows) {
    console.log(`  Auction ${auction.id}: "${auction.title}"`);
    console.log(`    - autoEnded: ${auction.auto_ended}`);
    console.log(`    - ended: ${auction.ended}`);
    console.log(`    - endBlock: ${auction.end_block}`);
    console.log(`    - highestBid: ${auction.highest_bid}`);
    console.log(`    - highestBidder: ${auction.highest_bidder || 'none'}`);
    console.log('');
  }
  
  // Fix them
  const updateResult = await pool.query(`
    UPDATE auctions 
    SET ended = true, updated_at = NOW()
    WHERE auto_ended = true AND ended = false
    RETURNING id, title
  `);
  
  console.log(`\n✅ Fixed ${updateResult.rows.length} auctions:`);
  updateResult.rows.forEach(a => console.log(`  - Auction ${a.id}: ${a.title}`));
  
  await pool.end();
}

fixEndedAuctions().catch(console.error);
