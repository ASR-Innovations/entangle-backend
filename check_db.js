const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  try {
    const profiles = await pool.query(
      "SELECT id, wallet_address, twitter_username, para_user_id FROM creator_profiles WHERE wallet_address = '0x6daa02f03f05d7330ec10f12e66ac3db0cd7718d' LIMIT 1"
    );
    console.log('\n=== Creator Profile ===');
    console.log(JSON.stringify(profiles.rows[0], null, 2));

    if (profiles.rows.length > 0) {
      const tokens = await pool.query(
        "SELECT id, creator_profile_id, contract_address, symbol, name, total_supply FROM creator_tokens WHERE creator_profile_id = $1",
        [profiles.rows[0].id]
      );
      console.log('\n=== Creator Token ===');
      console.log(JSON.stringify(tokens.rows[0], null, 2));
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
