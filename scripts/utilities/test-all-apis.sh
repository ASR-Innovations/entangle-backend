#!/bin/bash

# Comprehensive API Test Script
# Tests all backend APIs for frontend integration

BASE_URL="http://localhost:5009"
AUTH_TOKEN=""

echo "🧪 COMPREHENSIVE BACKEND API TESTING"
echo "===================================="
echo ""

# Test 1: Health Check
echo "1️⃣ Testing Health Endpoint..."
curl -s "$BASE_URL/api/health" | jq '.' || echo "❌ Failed"
echo ""

# Test 2: Para Auth (use your verification token)
echo "2️⃣ Testing Para Authentication..."
PARA_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/para-auth" \
  -H "Content-Type: application/json" \
  -d '{"verificationToken": "c21dd1df-06dd-4d11-9140-5e0a8b672615"}')

echo "$PARA_RESPONSE" | jq '.'
AUTH_TOKEN=$(echo "$PARA_RESPONSE" | jq -r '.token')
echo "Auth Token: ${AUTH_TOKEN:0:50}..."
echo ""

# Test 3: JWT Verification
echo "3️⃣ Testing JWT Verification..."
curl -s "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

# Test 4: Get Active Auctions
echo "4️⃣ Testing Get Active Auctions..."
curl -s "$BASE_URL/api/auctions/active" | jq '.'
echo ""

# 

# Test 6: Get User's Created Auctions
echo "6️⃣ Testing Get User Created Auctions..."
curl -s "$BASE_URL/api/auctions/user/created" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

# Test 7: Contract Stats
echo "7️⃣ Testing Contract Stats..."
curl -s "$BASE_URL/api/contract/stats" | jq '.'
echo ""

# Test 8: Get Contract Auctions
echo "8️⃣ Testing Contract Auctions..."
curl -s "$BASE_URL/api/contract/auctions" | jq '.'
echo ""

# Test 9: Get User NFTs (test wallet)
echo "9️⃣ Testing Get User NFTs..."
curl -s "$BASE_URL/api/contract/nfts/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E" | jq '.'
echo ""

# Test 10: Get User Dashboard
echo "🔟 Testing User Dashboard..."
curl -s "$BASE_URL/api/contract/dashboard/user/0x0CB9D7191C9dD544a9994DCE38211bFb7097307E" | jq '.'
echo ""

# Test 11: Create Direct Meeting (No Auth)
echo "1️⃣1️⃣ Testing Direct Meeting Creation..."
curl -s -X POST "$BASE_URL/api/meetings/create-direct" \
  -H "Content-Type: application/json" \
  -d '{
    "hostName": "Test Host",
    "hostEmail": "host@test.com",
    "guestName": "Test Guest",
    "guestEmail": "guest@test.com",
    "meetingName": "API Test Meeting",
    "duration": 60
  }' | jq '.'
echo ""

# Test 12: Get User Meetings
echo "1️⃣2️⃣ Testing Get User Meetings..."
curl -s "$BASE_URL/api/meetings" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

echo "✅ API Testing Complete!"
echo ""
echo "📊 Summary:"
echo "- Health: Check output above"
echo "- Para Auth: Check if token generated"
echo "- JWT: Check if verified"
echo "- Auctions: Check if list returned"
echo "- Contract: Check blockchain connectivity"
echo "- Meetings: Check Jitsi integration"
