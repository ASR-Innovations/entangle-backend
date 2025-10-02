#!/usr/bin/env node

/**
 * TEST MEETING ACCESS - Debug "wait for moderator" issue
 */

require('dotenv').config();
const { getJitsiService } = require('./src/services/JitsiService');

// Add your JaaS credentials directly for testing
process.env.JITSI_APP_ID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd';
process.env.JITSI_KID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af';
process.env.JAAS_APP_ID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd';
process.env.JAAS_KID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af';
process.env.JAAS_SUB = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd';

// You need to add the private key from your API_KEYS_GUIDE.md
process.env.JITSI_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCSwCiEVtUgGrq5
6iVMafL+737z3FtWCi53hdd856ZJZJFbhoZQf5o2KWc/ovKVjQNEjPvCFPCoI90+
x/zwjcYIOmh0QVurDSWC9VtTEBA4fS10HWc+dBRzTJmfOlkRVls1mMEl2HqPmB1T
ur40g58swOTw7k3YmnKSfGCE3escccUZwUYw8LHZOgYchWWbESffULgYOu1wHGr8
H/Rcn9bKNtP16luXUAU9Y/xurJKqF+x+gAXxnJ5xvYUmRLRtk7/dLLbKJVeoF/3f
guRhElA3XfQUOe74cWglTafXGDhu0KxIDwfFaDAzbTr2p2G3SMnzXO6Su3wPzA7j
8L8LCPrtAgMBAAECggEALxcmaUEL5t9s59ew3FJrPU9Q56PgUz21J3l1aolTHN3+
nuYOF6q6q4KhtRPuz/qN/+NVrjPV/b50cn7uNarozx8fAZ8vcTYowVtGUOMosVfJ
zCbbSHkrTsxXx3aLujqBzjMUV7adrZJcZs/X1TYfT9ceIAn4RPdaqJLszfYASgHi
9nDbcKKrTteyc26mHjhN4pfUkDT0p0VBIBTNjQyatPFzJNDAjwoS1eZieGnZecr6
mdXSPksWEZU3YKbNW4iEXGtwRC2jVZxdJ59hBuG1kOlwOyrx2Q/kJAEqvBUEwqVP
vTYlQIioHKMC/cMZtrDp3IwOIVJpmVsb1yAjPzZU6QKBgQDWzgA2n0Hu6MZaxRsq
qsFw35MmgThHHFucXK4T8+2LAxhWLAf0iM2slLBgBNyyCMFyoVEjX74UFTOsQf0A
HNCL930ZTu4TVbNjztOZNa5kYzZEJNEzDciofTRC8b1gXmXzInoQuovCVvX/px9l
/j4EFCeT20A0UHdgN15ASknqVwKBgQCu5P27oTCZra6xagz9Z8Xdk6WfUheZ7qUF
+EKyvMMMlKXIL/HeuHyHc+FBbAYMjhlKEANHs9Dm91cS4sr0V4IHgLNU7zPEV9mm
Hd+106+6z/SL3wKENmc+KR40pqRiLx3VVVN+FRZp8zc66WXbOSTdhMNuLUk819a5
mkndr8ICWwKBgDbRaaKG8BedVgmSJcW0wBsjI3V/IrKbHRIBYPd8l9GTH6HWKM2S
IBL7+yr18rCIpX2wh3lklKihZIeAa6WctOgTZ9yOlRlgFKDTBpMh7Ph3jUDEuJKz
4NKG6VBwSukODiyHTul4AfS9ppfwuYWY5ZC66ALGwFLZei2W07nKe6SPAoGAO8JA
tHDCQ3BmBXbgE2H26Nv/Nm39ZHp3Zo/KcnovB0hvUPSY52oQGtRMfmcjtfyDxZut
Ez3svk57MRfPEygnZNrj67yD6q29z5Xbj6xSGjneLEC6AmT4Z/PyvzjFaEsDHZa3
HZik/PS+xWFkjUB8STiI8keFA8YYN3jxjk70sosCgYAChUM60AIT1fmgNDTFA1o3
gXJ5xQeWRtmTXKvEImKbHRmbplChpT8zwa7uBX85jYj+TV+WfdBUMcvLOXD3im0W
5M1doZffL1AogwGnTwNZi7qjE9aWJg/QgK7/tA4uNrTyn7dgQo9CLkTWMzT57mb3
DxNkFw4xpuDu0w2Rl7Hbbw==
-----END PRIVATE KEY-----`;

async function testMeetingAccess() {
  console.log('🔍 TESTING MEETING ACCESS - Debug "wait for moderator" issue\n');

  const jitsi = getJitsiService();
  
  console.log('🔧 Configuration:');
  console.log('JWT Enabled:', jitsi.jwtEnabled);
  console.log('App ID:', jitsi.appId);
  console.log('Domain:', jitsi.domain);
  console.log('Has Private Key:', !!jitsi.privateKey);
  console.log('Has KID:', !!jitsi.kid);
  console.log('');

  if (!jitsi.jwtEnabled) {
    console.log('❌ JWT not enabled - this will cause "wait for moderator" issues');
    console.log('Fix: Make sure JITSI_PRIVATE_KEY, JITSI_KID are set');
    return;
  }

  // Create a simple test meeting
  console.log('🏗️  Creating test meeting...');
  
  try {
    const meeting = jitsi.createAuctionMeeting({
      auctionId: 'test-access',
      hostData: {
        paraId: 'host-123',
        name: 'Test Host',
        email: 'host@test.com'
      },
      duration: 30
    });

    if (!meeting.success) {
      console.log('❌ Meeting creation failed:', meeting.error);
      return;
    }

    console.log('✅ Meeting created successfully!');
    console.log('');

    // Show the URLs
    console.log('🎯 TESTING URLS:');
    console.log('');
    console.log('HOST URL (should join as moderator):');
    console.log(meeting.host.url);
    console.log('');

    // Generate attendee access
    const attendeeAccess = jitsi.generateAttendeeAccess({
      roomId: meeting.meeting.roomId,
      attendeeData: {
        paraId: 'attendee-456',
        name: 'Test Attendee',
        email: 'attendee@test.com'
      }
    });

    if (attendeeAccess.success) {
      console.log('ATTENDEE URL (should join as participant):');
      console.log(attendeeAccess.attendee.url);
      console.log('');
    }

    console.log('🧪 TEST STEPS:');
    console.log('1. Open HOST URL first - you should join as moderator (no waiting)');
    console.log('2. Open ATTENDEE URL - should join immediately if host is already there');
    console.log('3. If still seeing "wait for moderator", check JWT token in URL');
    console.log('');

    // Check JWT tokens
    if (meeting.host.token) {
      console.log('✅ Host JWT token generated');
    } else {
      console.log('❌ No host JWT token - this will cause issues');
    }

    if (attendeeAccess.success && attendeeAccess.attendee.token) {
      console.log('✅ Attendee JWT token generated');
    } else {
      console.log('❌ No attendee JWT token - this will cause issues');
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testMeetingAccess().catch(console.error);
