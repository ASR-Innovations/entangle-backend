#!/usr/bin/env node

/**
 * START SERVER AND RUN TESTS
 * This script starts the backend server and runs comprehensive tests
 */

const { spawn } = require('child_process');
const { runAllTests } = require('./test-backend-server');

console.log('🚀 STARTING BACKEND SERVER AND RUNNING TESTS');
console.log('=' .repeat(60));

// Start the server
console.log('📡 Starting backend server...');
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  cwd: __dirname
});

let serverReady = false;
let testTimeout;

// Listen for server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[SERVER] ${output.trim()}`);
  
  // Check if server is ready
  if (output.includes('Server running on port') || output.includes('listening on port')) {
    if (!serverReady) {
      serverReady = true;
      console.log('\n✅ Server is ready! Starting tests in 3 seconds...\n');
      
      // Wait 3 seconds for server to fully initialize
      testTimeout = setTimeout(async () => {
        try {
          await runAllTests();
          console.log('\n🏁 Tests completed. Stopping server...');
          server.kill();
          process.exit(0);
        } catch (error) {
          console.error('❌ Test execution failed:', error);
          server.kill();
          process.exit(1);
        }
      }, 3000);
    }
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(`[SERVER ERROR] ${output.trim()}`);
});

server.on('close', (code) => {
  if (testTimeout) {
    clearTimeout(testTimeout);
  }
  console.log(`\n📡 Server process exited with code ${code}`);
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Stopping server...');
  if (testTimeout) {
    clearTimeout(testTimeout);
  }
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Stopping server...');
  if (testTimeout) {
    clearTimeout(testTimeout);
  }
  server.kill();
  process.exit(0);
});

// Timeout after 2 minutes
setTimeout(() => {
  if (!serverReady) {
    console.log('⏰ Server startup timeout. Stopping...');
    server.kill();
    process.exit(1);
  }
}, 120000);




