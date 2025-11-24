/**
 * Test script for Seaport configuration validation
 * 
 * This script tests various configuration scenarios to ensure
 * validation works correctly.
 */

const {
  validateSeaportConfig,
  isValidAddress,
  isValidPositiveInteger,
  isValidWebSocketUrl,
  isValidCronSchedule,
  isValidBasisPoints
} = require('./src/config/seaportConfig');

console.log('🧪 Testing Seaport Configuration Validation\n');

// Test 1: Validator functions
console.log('Test 1: Individual Validators');
console.log('================================');

const testCases = [
  {
    name: 'Valid Ethereum address',
    fn: isValidAddress,
    input: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
    expected: true
  },
  {
    name: 'Invalid Ethereum address (too short)',
    fn: isValidAddress,
    input: '0x123',
    expected: false
  },
  {
    name: 'Invalid Ethereum address (no 0x prefix)',
    fn: isValidAddress,
    input: '00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
    expected: false
  },
  {
    name: 'Valid positive integer',
    fn: isValidPositiveInteger,
    input: '43113',
    expected: true
  },
  {
    name: 'Invalid positive integer (negative)',
    fn: isValidPositiveInteger,
    input: '-1',
    expected: false
  },
  {
    name: 'Invalid positive integer (zero)',
    fn: isValidPositiveInteger,
    input: '0',
    expected: false
  },
  {
    name: 'Valid WebSocket URL (wss)',
    fn: isValidWebSocketUrl,
    input: 'wss://api.avax-test.network/ext/bc/C/ws',
    expected: true
  },
  {
    name: 'Valid WebSocket URL (ws)',
    fn: isValidWebSocketUrl,
    input: 'ws://localhost:8545',
    expected: true
  },
  {
    name: 'Invalid WebSocket URL (https)',
    fn: isValidWebSocketUrl,
    input: 'https://api.avax-test.network/ext/bc/C/rpc',
    expected: false
  },
  {
    name: 'Valid cron schedule (every 5 minutes)',
    fn: isValidCronSchedule,
    input: '*/5 * * * *',
    expected: true
  },
  {
    name: 'Valid cron schedule (every hour)',
    fn: isValidCronSchedule,
    input: '0 * * * *',
    expected: true
  },
  {
    name: 'Invalid cron schedule (too few parts)',
    fn: isValidCronSchedule,
    input: '*/5 * *',
    expected: false
  },
  {
    name: 'Valid basis points (250 = 2.5%)',
    fn: isValidBasisPoints,
    input: '250',
    expected: true
  },
  {
    name: 'Valid basis points (0 = 0%)',
    fn: isValidBasisPoints,
    input: '0',
    expected: true
  },
  {
    name: 'Valid basis points (10000 = 100%)',
    fn: isValidBasisPoints,
    input: '10000',
    expected: true
  },
  {
    name: 'Invalid basis points (too high)',
    fn: isValidBasisPoints,
    input: '10001',
    expected: false
  }
];

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = test.fn(test.input);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status}: ${test.name}`);
  if (result !== test.expected) {
    console.log(`  Expected: ${test.expected}, Got: ${result}`);
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

// Test 2: Full configuration validation
console.log('Test 2: Full Configuration Validation');
console.log('======================================');

// Save original env vars
const originalEnv = { ...process.env };

// Test scenario 1: Valid configuration
console.log('\nScenario 1: Valid configuration');
process.env.SEAPORT_CONTRACT_ADDRESS = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';
process.env.SEAPORT_CHAIN_ID = '43113';
process.env.WS_RPC_URL = 'wss://api.avax-test.network/ext/bc/C/ws';
process.env.ENABLE_ORDER_MONITORING = 'true';
process.env.ORDER_CLEANUP_CRON_SCHEDULE = '*/5 * * * *';
process.env.PLATFORM_FEE_BASIS_POINTS = '250';

let validation = validateSeaportConfig();
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
console.log(`Warnings: ${validation.warnings.length}`);
if (validation.warnings.length > 0) {
  validation.warnings.forEach(w => console.log(`  - ${w}`));
}

// Test scenario 2: Missing required fields
console.log('\nScenario 2: Missing required fields');
delete process.env.SEAPORT_CONTRACT_ADDRESS;
delete process.env.SEAPORT_CHAIN_ID;

validation = validateSeaportConfig();
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
validation.errors.forEach(e => console.log(`  - ${e}`));

// Test scenario 3: Invalid address format
console.log('\nScenario 3: Invalid address format');
process.env.SEAPORT_CONTRACT_ADDRESS = 'invalid-address';
process.env.SEAPORT_CHAIN_ID = '43113';

validation = validateSeaportConfig();
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
validation.errors.forEach(e => console.log(`  - ${e}`));

// Test scenario 4: Invalid WebSocket URL
console.log('\nScenario 4: Invalid WebSocket URL');
process.env.SEAPORT_CONTRACT_ADDRESS = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';
process.env.WS_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

validation = validateSeaportConfig();
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
validation.errors.forEach(e => console.log(`  - ${e}`));

// Test scenario 5: Platform fee with invalid basis points
console.log('\nScenario 5: Platform fee with invalid basis points');
process.env.WS_RPC_URL = 'wss://api.avax-test.network/ext/bc/C/ws';
process.env.PLATFORM_FEE_RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
process.env.PLATFORM_FEE_BASIS_POINTS = '25000';

validation = validateSeaportConfig();
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
validation.errors.forEach(e => console.log(`  - ${e}`));

// Restore original env vars
Object.keys(process.env).forEach(key => {
  if (key.startsWith('SEAPORT_') || key.startsWith('WS_RPC_') || 
      key.startsWith('ENABLE_ORDER_') || key.startsWith('ORDER_CLEANUP_') ||
      key.startsWith('PLATFORM_FEE_')) {
    delete process.env[key];
  }
});
Object.assign(process.env, originalEnv);

console.log('\n✅ All validation tests completed!');
