# 🧪 COMPREHENSIVE BACKEND TESTING GUIDE

## 🎯 **OVERVIEW**

This guide covers comprehensive testing of the backend server with real API calls, contract integration, and database functionality.

## 🚀 **QUICK START**

### **Option 1: Automated Testing (Recommended)**
```bash
# Start server and run all tests automatically
node start-server-and-test.js
```

### **Option 2: Manual Testing**
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Run tests
node test-backend-server.js
```

## 📋 **TEST COVERAGE**

### **1. Server Health Tests** ✅
- **Server Status**: Checks if server is running
- **Service Configuration**: Database, Blockchain, Para, Jitsi
- **Response Time**: Server responsiveness

### **2. Authentication Tests** ✅
- **Para Auth**: `POST /api/auth/para-auth`
- **Session Import**: `POST /api/auth/import-session`
- **JWT Verification**: `GET /api/auth/verify`
- **Error Handling**: Invalid tokens, missing auth

### **3. Auction API Tests** ✅
- **Active Auctions**: `GET /api/auctions/active`
- **Auction Creation**: `POST /api/auctions/created`
- **User Auctions**: `GET /api/auctions/user/created`
- **Data Structure**: Validates response format
- **New Contract Fields**: NFT token ID, seller name, etc.

### **4. Meeting API Tests** ✅
- **Direct Meetings**: `POST /api/meetings/create-direct`
- **Simple Meetings**: `POST /api/meetings/create-simple`
- **Gated Meetings**: `POST /api/meetings/create-gated`
- **Meeting Info**: `GET /api/meetings/:roomId`
- **Jitsi Integration**: Room creation and JWT tokens

### **5. Contract Integration Tests** ✅
- **Contract Service**: Initialization and configuration
- **Contract Stats**: Auction counter, platform fee, owner
- **Active Auctions**: Retrieval from blockchain
- **NFT Functions**: Ownership, metadata, burn eligibility
- **Access Control**: Meeting access verification

### **6. Database Integration Tests** ✅
- **Connection**: Database connectivity
- **Tables**: All required tables exist
- **Data**: Auction and meeting data
- **Schema**: Proper table structure

### **7. Error Handling Tests** ✅
- **404 Errors**: Invalid endpoints
- **400 Errors**: Invalid JSON, validation errors
- **401 Errors**: Missing authentication
- **500 Errors**: Server errors

## 🔧 **CONFIGURATION REQUIREMENTS**

### **Environment Variables**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/entangle

# Blockchain
CONTRACT_ADDRESS=0xB5D6eaD3f2b302ab38D59617C179a2f61a4ca0EC
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PLATFORM_PRIVATE_KEY=your_private_key

# Authentication
JWT_SECRET=your_jwt_secret
PARA_API_KEY=your_para_api_key

# Jitsi
JITSI_SECRET=your_jitsi_secret
JITSI_APP_ID=your_jitsi_app_id
```

### **Database Setup**
```sql
-- Ensure all tables exist
CREATE TABLE IF NOT EXISTS users (...);
CREATE TABLE IF NOT EXISTS auctions (...);
CREATE TABLE IF NOT EXISTS meetings (...);
CREATE TABLE IF NOT EXISTS meeting_access_logs (...);
CREATE TABLE IF NOT EXISTS notifications (...);
```

## 📊 **EXPECTED TEST RESULTS**

### **✅ All Tests Pass**
```
🎉 ALL TESTS PASSED! Backend server is working perfectly!
✅ Passed: 25
❌ Failed: 0
📊 Total: 25
📈 Success Rate: 100.0%
```

### **⚠️ Some Tests Fail**
```
⚠️ 3 tests failed. Please check the issues above.
✅ Passed: 22
❌ Failed: 3
📊 Total: 25
📈 Success Rate: 88.0%
```

## 🐛 **TROUBLESHOOTING**

### **Common Issues**

#### **1. Server Not Starting**
```bash
# Check if port is in use
lsof -i :5000

# Check environment variables
cat .env

# Check database connection
psql $DATABASE_URL
```

#### **2. Contract Connection Issues**
```bash
# Check RPC URL
curl https://api.avax-test.network/ext/bc/C/rpc

# Check contract address
# Verify it's deployed and accessible
```

#### **3. Database Issues**
```bash
# Check database connection
npm run db:test

# Check table structure
psql $DATABASE_URL -c "\dt"
```

#### **4. Authentication Issues**
```bash
# Check JWT secret
echo $JWT_SECRET

# Check Para API key
echo $PARA_API_KEY
```

## 🔍 **DETAILED TEST BREAKDOWN**

### **Server Health Test**
- **Purpose**: Verify server is running and configured
- **Endpoints**: `GET /health`
- **Checks**: Status, services, timestamp
- **Expected**: 200 OK with service status

### **Authentication Test**
- **Purpose**: Verify auth endpoints respond correctly
- **Endpoints**: `/api/auth/*`
- **Checks**: Validation, error handling, JWT
- **Expected**: Proper error responses for invalid data

### **Auction API Test**
- **Purpose**: Verify auction management functionality
- **Endpoints**: `/api/auctions/*`
- **Checks**: CRUD operations, data structure, contract integration
- **Expected**: Proper auction data with new contract fields

### **Meeting API Test**
- **Purpose**: Verify meeting creation and management
- **Endpoints**: `/api/meetings/*`
- **Checks**: Jitsi integration, room creation, access tokens
- **Expected**: Working meeting URLs and JWT tokens

### **Contract Integration Test**
- **Purpose**: Verify blockchain connectivity and functions
- **Functions**: All contract methods
- **Checks**: Initialization, stats, NFT functions, access control
- **Expected**: Successful contract calls and data retrieval

### **Database Integration Test**
- **Purpose**: Verify database connectivity and data
- **Checks**: Connection, tables, data integrity
- **Expected**: All tables exist with proper data

### **Error Handling Test**
- **Purpose**: Verify proper error responses
- **Checks**: 404, 400, 401, 500 errors
- **Expected**: Appropriate HTTP status codes and error messages

## 🎯 **TESTING SCENARIOS**

### **Scenario 1: Complete Auction Flow**
1. Create auction via API
2. Verify auction appears in active auctions
3. Check contract integration
4. Verify database storage

### **Scenario 2: Meeting Creation Flow**
1. Create direct meeting
2. Verify Jitsi room creation
3. Check meeting info retrieval
4. Verify JWT token generation

### **Scenario 3: NFT Gating Flow**
1. Check NFT ownership
2. Verify burn eligibility
3. Test meeting access control
4. Verify contract functions

### **Scenario 4: Error Handling**
1. Test invalid endpoints
2. Test missing authentication
3. Test invalid data
4. Verify proper error responses

## 📈 **PERFORMANCE METRICS**

### **Response Times**
- **Health Check**: < 100ms
- **API Calls**: < 500ms
- **Contract Calls**: < 2000ms
- **Database Queries**: < 300ms

### **Success Rates**
- **Server Health**: 100%
- **API Endpoints**: > 95%
- **Contract Integration**: > 90%
- **Database Operations**: 100%

## 🚀 **NEXT STEPS AFTER TESTING**

### **If All Tests Pass**
1. ✅ Backend is ready for frontend integration
2. ✅ All APIs are working correctly
3. ✅ Contract integration is functional
4. ✅ Database is properly configured
5. ✅ Ready for production deployment

### **If Some Tests Fail**
1. 🔧 Fix identified issues
2. 🔧 Check configuration
3. 🔧 Verify dependencies
4. 🔧 Re-run tests
5. 🔧 Repeat until all pass

## 📝 **TEST CUSTOMIZATION**

### **Adding New Tests**
```javascript
// Add to test-backend-server.js
async function testNewFeature() {
  console.log('\n📋 TEST X: NEW FEATURE');
  console.log('-'.repeat(40));
  
  try {
    // Your test logic here
    logTest('New feature test', true, 'Success message');
  } catch (error) {
    logTest('New feature test', false, `Error: ${error.message}`);
  }
}
```

### **Modifying Test Data**
```javascript
// Update CONFIG object
const CONFIG = {
  BACKEND_URL: 'http://localhost:5000',
  CONTRACT_ADDRESS: '0x...',
  TEST_WALLET: '0x...',
  // Add your test data
};
```

---

## 🎉 **READY TO TEST!**

The comprehensive testing suite is ready to validate your backend server. Run the tests to ensure everything is working correctly before proceeding with frontend integration.

**Start with**: `node start-server-and-test.js`




