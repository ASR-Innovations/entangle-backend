#!/usr/bin/env node

/**
 * START SERVER AND TEST AUCTION APIS
 * 
 * This script starts the backend server and then runs focused auction API tests.
 */

const { spawn } = require('child_process');
const { AuctionAPITester } = require('./test-auction-apis-focused');

console.log('🚀 STARTING SERVER AND TESTING AUCTION APIS');
console.log('=' .repeat(60));

// Start the server
console.log('📡 Starting backend server...');
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  cwd: __dirname
});

let serverReady = false;
let serverOutput = '';

// Capture server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(`[SERVER] ${output.trim()}`);
  
  // Check if server is ready
  if (output.includes('Server running on port') && !serverReady) {
    serverReady = true;
    console.log('\n✅ Server is ready! Starting auction API tests in 3 seconds...\n');
    
    // Wait 3 seconds then run tests
    setTimeout(async () => {
      try {
        const tester = new AuctionAPITester();
        await tester.runAllTests();
        
        console.log('\n🏁 Tests completed. Stopping server...');
        server.kill('SIGTERM');
        process.exit(0);
      } catch (error) {
        console.error('❌ Testing failed:', error);
        server.kill('SIGTERM');
        process.exit(1);
      }
    }, 3000);
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(`[SERVER ERROR] ${output.trim()}`);
});

server.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(1);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping server...');
  server.kill('SIGTERM');
  process.exit(0);
});




