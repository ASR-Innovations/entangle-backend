const { Pool } = require('pg');
require('dotenv').config();

// Test connection for DBeaver setup
async function testDBeaverConnection() {
  console.log('🔍 Testing database connection for DBeaver setup...');
  console.log('=' .repeat(60));
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings',
    ssl: false,
    connectionTimeoutMillis: 10000
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection successful!');
    console.log('');
    
    // Get database info
    const dbInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log('📊 Database Information:');
    console.log(`   Database: ${dbInfo.rows[0].current_database}`);
    console.log(`   User: ${dbInfo.rows[0].current_user}`);
    console.log(`   Version: ${dbInfo.rows[0].version.split(' ')[0]}`);
    console.log('');
    
    // Get table list
    const tables = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Available Tables:');
    tables.rows.forEach(table => {
      console.log(`   • ${table.table_name} (${table.table_type})`);
    });
    console.log('');
    
    // Get table row counts
    console.log('📊 Table Row Counts:');
    for (const table of tables.rows) {
      try {
        const count = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`   ${table.table_name}: ${count.rows[0].count} rows`);
      } catch (err) {
        console.log(`   ${table.table_name}: Error getting count`);
      }
    }
    
    console.log('');
    console.log('🎯 DBeaver Connection Settings:');
    console.log('=' .repeat(60));
    console.log('Host: 209.38.123.139');
    console.log('Port: 5432');
    console.log('Database: entangle_meetings');
    console.log('Username: entangle_user');
    console.log('Password: entangle_secure_2024');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('1. Open DBeaver');
    console.log('2. Create new PostgreSQL connection');
    console.log('3. Use the settings above');
    console.log('4. Test connection');
    console.log('5. Start exploring your tables!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('• Make sure you\'re connected to the server network');
    console.log('• Check if the database server is running');
    console.log('• Verify the connection string is correct');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testDBeaverConnection();
