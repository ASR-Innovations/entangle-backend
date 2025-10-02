#!/usr/bin/env node

/**
 * TEST JWT FIX - Verify corrected JWT tokens work
 */

require('dotenv').config();

console.log('🔧 TESTING JWT TOKEN FIX');
console.log('=' .repeat(50));

async function testJWTFix() {
  try {
    // Initialize Jitsi service with corrected JWT
    const { getJitsiService } = require('./src/services/JitsiService');
    const jitsiService = getJitsiService();
    
    console.log('📋 Service Configuration:');
    console.log('   Domain:', jitsiService.domain);
    console.log('   App ID:', jitsiService.appId);
    console.log('   JWT Enabled:', jitsiService.jwtEnabled);
    console.log('   Has Private Key:', !!jitsiService.privateKey);
    console.log('   Has KID:', !!jitsiService.kid);
    
    if (!jitsiService.jwtEnabled) {
      throw new Error('JWT not enabled - check environment variables');
    }
    
    console.log('\n🎬 Creating Test Meeting...');
    
    // Create a test meeting with corrected format
    const meeting = jitsiService.createAuctionMeeting({
      auctionId: 'jwt-test-123',
      hostData: {
        paraId: 'test-creator-para-id',
        name: 'Test Creator',
        email: 'creator@test.com'
      },
      duration: 30
    });
    
    if (!meeting.success) {
      throw new Error('Failed to create meeting: ' + meeting.error);
    }
    
    console.log('✅ Meeting Created:');
    console.log('   Room ID:', meeting.meeting.roomId);
    console.log('   Room URL:', meeting.meeting.url);
    
    // Generate winner access
    const winnerAccess = jitsiService.generateAttendeeAccess({
      roomId: meeting.meeting.roomId,
      attendeeData: {
        paraId: 'test-winner-para-id',
        name: 'Test Winner',
        email: 'winner@test.com'
      },
      expiresIn: 2
    });
    
    if (!winnerAccess.success) {
      throw new Error('Failed to generate winner access: ' + winnerAccess.error);
    }
    
    console.log('\n🔍 JWT Token Analysis:');
    
    // Analyze creator token
    const jwt = require('jsonwebtoken');
    const creatorDecoded = jwt.decode(meeting.host.token, { complete: true });
    const winnerDecoded = jwt.decode(winnerAccess.attendee.token, { complete: true });
    
    console.log('\n👤 Creator Token:');
    console.log('   Room:', creatorDecoded.payload.room);
    console.log('   Moderator:', creatorDecoded.payload.context.user.moderator);
    console.log('   User ID:', creatorDecoded.payload.context.user.id);
    console.log('   Features:', Object.keys(creatorDecoded.payload.context.features || {}));
    console.log('   Expires:', new Date(creatorDecoded.payload.exp * 1000).toISOString());
    
    console.log('\n🏆 Winner Token:');
    console.log('   Room:', winnerDecoded.payload.room);
    console.log('   Moderator:', winnerDecoded.payload.context.user.moderator);
    console.log('   User ID:', winnerDecoded.payload.context.user.id);
    console.log('   Features:', Object.keys(winnerDecoded.payload.context.features || {}));
    console.log('   Expires:', new Date(winnerDecoded.payload.exp * 1000).toISOString());
    
    // Verify room names match
    const sameRoom = creatorDecoded.payload.room === winnerDecoded.payload.room;
    const roomFormat = creatorDecoded.payload.room.includes('/');
    const hasAppId = creatorDecoded.payload.room.startsWith(jitsiService.appId);
    
    console.log('\n✅ Verification:');
    console.log('   Same Room:', sameRoom ? '✅ YES' : '❌ NO');
    console.log('   Correct Format (app/room):', roomFormat ? '✅ YES' : '❌ NO');
    console.log('   Has App ID Prefix:', hasAppId ? '✅ YES' : '❌ NO');
    console.log('   Creator is Moderator:', creatorDecoded.payload.context.user.moderator ? '✅ YES' : '❌ NO');
    console.log('   Winner is Participant:', !winnerDecoded.payload.context.user.moderator ? '✅ YES' : '❌ NO');
    
    console.log('\n🔗 CORRECTED MEETING URLS:');
    console.log('\n📱 Creator URL (Moderator):');
    console.log(meeting.host.url);
    
    console.log('\n🏆 Winner URL (Participant):');
    console.log(winnerAccess.attendee.url);
    
    // Check if URLs are valid format
    const creatorUrl = new URL(meeting.host.url);
    const winnerUrl = new URL(winnerAccess.attendee.url);
    
    console.log('\n🔍 URL Validation:');
    console.log('   Creator Host:', creatorUrl.hostname);
    console.log('   Creator Path:', creatorUrl.pathname);
    console.log('   Creator JWT Param:', creatorUrl.searchParams.has('jwt') ? '✅ YES' : '❌ NO');
    console.log('   Winner Host:', winnerUrl.hostname);
    console.log('   Winner Path:', winnerUrl.pathname);
    console.log('   Winner JWT Param:', winnerUrl.searchParams.has('jwt') ? '✅ YES' : '❌ NO');
    console.log('   Same Path:', creatorUrl.pathname === winnerUrl.pathname ? '✅ YES' : '❌ NO');
    
    const isCorrectFormat = (
      sameRoom && 
      roomFormat && 
      hasAppId && 
      creatorDecoded.payload.context.user.moderator && 
      !winnerDecoded.payload.context.user.moderator
    );
    
    if (isCorrectFormat) {
      console.log('\n🎉 JWT FIX SUCCESSFUL!');
      console.log('✅ Room format: app-id/room-name');
      console.log('✅ JWT tokens properly configured');
      console.log('✅ Role separation working');
      console.log('✅ URLs should work in browser now!');
      
      console.log('\n💡 TEST THESE URLS IN BROWSER:');
      console.log('1. Open creator URL in one browser/tab');
      console.log('2. Open winner URL in another browser/tab');
      console.log('3. Both should join the same meeting with different roles');
      
    } else {
      console.log('\n❌ JWT FIX INCOMPLETE - CHECK ISSUES ABOVE');
    }
    
    return isCorrectFormat;
    
  } catch (error) {
    console.error('\n❌ JWT Test Error:', error.message);
    return false;
  }
}

// Run the test
testJWTFix().then(success => {
  if (success) {
    console.log('\n🚀 JWT tokens should now work in browser!');
  } else {
    console.log('\n⚠️  JWT tokens may still have issues');
  }
}).catch(console.error);
