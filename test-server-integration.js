/**
 * Test script to verify server integration for Task 11
 * Verifies:
 * - Order routes are registered
 * - OrderCleanupCronService can be initialized
 * - OrderFulfillmentMonitorService can be initialized
 * - OrderSocketService can be initialized
 * - CORS configuration is present
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Server Integration (Task 11)...\n');

// Read server.js file
const serverPath = path.join(__dirname, 'src', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

let allTestsPassed = true;

// Test 1: Order routes are registered
console.log('Test 1: Checking if order routes are registered...');
if (serverContent.includes("app.use('/api/orders', require('./routes/orders'))")) {
  console.log('✅ Order routes are registered\n');
} else {
  console.log('❌ Order routes are NOT registered\n');
  allTestsPassed = false;
}

// Test 2: OrderCleanupCronService is initialized
console.log('Test 2: Checking if OrderCleanupCronService is initialized...');
if (serverContent.includes('getOrderCleanupCronService') && 
    serverContent.includes('orderCleanupCron.start()')) {
  console.log('✅ OrderCleanupCronService is initialized and started\n');
} else {
  console.log('❌ OrderCleanupCronService is NOT properly initialized\n');
  allTestsPassed = false;
}

// Test 3: OrderFulfillmentMonitorService is initialized
console.log('Test 3: Checking if OrderFulfillmentMonitorService is initialized...');
if (serverContent.includes('getOrderFulfillmentMonitorService') && 
    serverContent.includes('orderMonitor.start()')) {
  console.log('✅ OrderFulfillmentMonitorService is initialized and started\n');
} else {
  console.log('❌ OrderFulfillmentMonitorService is NOT properly initialized\n');
  allTestsPassed = false;
}

// Test 4: OrderSocketService is initialized with Socket.IO
console.log('Test 4: Checking if OrderSocketService is initialized...');
if (serverContent.includes('initializeOrderSocketService') && 
    serverContent.includes('initializeOrderSocketService(io)')) {
  console.log('✅ OrderSocketService is initialized with Socket.IO\n');
} else {
  console.log('❌ OrderSocketService is NOT properly initialized\n');
  allTestsPassed = false;
}

// Test 5: CORS configuration is present
console.log('Test 5: Checking if CORS configuration is present...');
if (serverContent.includes('allowedOrigins') && 
    serverContent.includes('app.use(cors(')) {
  console.log('✅ CORS configuration is present\n');
} else {
  console.log('❌ CORS configuration is NOT present\n');
  allTestsPassed = false;
}

// Test 6: Verify all required services exist
console.log('Test 6: Checking if all required service files exist...');
const requiredServices = [
  'src/services/OrderService.js',
  'src/services/OrderValidationService.js',
  'src/services/OrderCleanupCronService.js',
  'src/services/OrderFulfillmentMonitorService.js',
  'src/services/OrderSocketService.js'
];

let allServicesExist = true;
for (const servicePath of requiredServices) {
  const fullPath = path.join(__dirname, servicePath);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${servicePath} exists`);
  } else {
    console.log(`  ❌ ${servicePath} does NOT exist`);
    allServicesExist = false;
    allTestsPassed = false;
  }
}
console.log();

// Test 7: Verify order routes file exists
console.log('Test 7: Checking if order routes file exists...');
const routesPath = path.join(__dirname, 'src', 'routes', 'orders.js');
if (fs.existsSync(routesPath)) {
  console.log('✅ Order routes file exists\n');
} else {
  console.log('❌ Order routes file does NOT exist\n');
  allTestsPassed = false;
}

// Test 8: Verify environment variables are documented
console.log('Test 8: Checking if Seaport environment variables are documented...');
const envExamplePath = path.join(__dirname, '.env.example');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
if (envExampleContent.includes('SEAPORT_CONTRACT_ADDRESS') && 
    envExampleContent.includes('SEAPORT_CHAIN_ID') &&
    envExampleContent.includes('WS_RPC_URL') &&
    envExampleContent.includes('ENABLE_ORDER_MONITORING') &&
    envExampleContent.includes('PLATFORM_FEE_RECIPIENT')) {
  console.log('✅ All Seaport environment variables are documented\n');
} else {
  console.log('❌ Some Seaport environment variables are missing\n');
  allTestsPassed = false;
}

// Final result
console.log('═══════════════════════════════════════════════════════');
if (allTestsPassed) {
  console.log('✅ ALL TESTS PASSED - Task 11 is complete!');
  console.log('═══════════════════════════════════════════════════════');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Task 11 needs attention');
  console.log('═══════════════════════════════════════════════════════');
  process.exit(1);
}
