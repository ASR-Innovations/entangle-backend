#!/usr/bin/env node

/**
 * Test the NEW direct meeting creation endpoint
 */

const axios = require('axios');

async function testDirectMeetingAPI() {
  const baseUrl = 'http://localhost:5009';
  
  console.log('🎯 TESTING NEW DIRECT MEETING CREATION API\n');
  
  console.log('📋 ENDPOINT: POST /api/meetings/create-direct');
  console.log('🔓 AUTH: None required (PUBLIC)');
  console.log('💾 DATABASE: Not required (Direct JWT generation)');
  console.log('📝 PURPOSE: Create instant meeting links for host and guest');
  console.log('');
  
  console.log('🧪 TEST 1: Custom host and guest');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const response = await axios.post(`${baseUrl}/api/meetings/create-direct`, {
      hostName: 'Alice Johnson',
      hostEmail: 'alice@company.com',
      guestName: 'Bob Smith', 
      guestEmail: 'bob@client.com',
      meetingName: 'Business Discussion',
      duration: 90
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ SUCCESS! Meeting created');
    console.log('Status:', response.status);
    console.log('');
    console.log('📋 Meeting Details:');
    console.log('- Room ID:', response.data.meeting.roomId);
    console.log('- Duration:', response.data.meeting.duration, 'minutes');
    console.log('- Expires:', response.data.meeting.expiresAt);
    console.log('');
    
    console.log('🎭 MEETING URLS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 HOST URL (Alice - Moderator):');
    console.log(response.data.participants.host.url);
    console.log('');
    console.log('👥 GUEST URL (Bob - Participant):');
    console.log(response.data.participants.guest.url);
    console.log('');
    console.log('🎉 READY FOR BROWSER TESTING!');
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data || error.message);
  }
  
  console.log('\n🧪 TEST 2: Default parameters (minimal request)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const response = await axios.post(`${baseUrl}/api/meetings/create-direct`, {});
    
    console.log('✅ SUCCESS! Meeting created with defaults');
    console.log('📋 Default Values:');
    console.log('- Host:', response.data.participants.host.name, '(' + response.data.participants.host.email + ')');
    console.log('- Guest:', response.data.participants.guest.name, '(' + response.data.participants.guest.email + ')');
    console.log('- Duration:', response.data.meeting.duration, 'minutes');
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Error:', error.response?.data || error.message);
  }
  
  console.log('\n💡 FRONTEND INTEGRATION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('```javascript');
  console.log('// Create instant meeting - NO AUTH REQUIRED!');
  console.log('const response = await fetch("/api/meetings/create-direct", {');
  console.log('  method: "POST",');
  console.log('  headers: { "Content-Type": "application/json" },');
  console.log('  body: JSON.stringify({');
  console.log('    hostName: "John Doe",');
  console.log('    hostEmail: "john@example.com",');
  console.log('    guestName: "Jane Smith",');
  console.log('    guestEmail: "jane@example.com",');
  console.log('    duration: 60  // minutes');
  console.log('  })');
  console.log('});');
  console.log('');
  console.log('const data = await response.json();');
  console.log('// Host URL: data.participants.host.url');
  console.log('// Guest URL: data.participants.guest.url');
  console.log('```');
  
  console.log('\n🎯 PERFECT FOR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Quick testing without Para authentication');
  console.log('✅ Demo purposes');
  console.log('✅ Simple meeting creation');
  console.log('✅ External integrations');
  console.log('✅ No database setup required');
}

testDirectMeetingAPI();
