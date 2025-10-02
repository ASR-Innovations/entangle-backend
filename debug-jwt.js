#!/usr/bin/env node

/**
 * DEBUG JWT TOKEN - Analyze the JWT to find issues
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

// Add your JaaS credentials directly for testing
process.env.JITSI_APP_ID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd';
process.env.JITSI_KID = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af';
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

function debugJWT() {
  console.log('🔍 DEBUG JWT TOKEN ANALYSIS\n');

  const appId = process.env.JITSI_APP_ID;
  const kid = process.env.JITSI_KID;
  const privateKey = process.env.JITSI_PRIVATE_KEY;
  
  console.log('📋 Configuration:');
  console.log('App ID:', appId);
  console.log('KID:', kid);
  console.log('Has Private Key:', !!privateKey);
  console.log('');

  const now = Math.floor(Date.now() / 1000);
  const roomName = 'vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/test-debug-room';

  // Try different payload configurations
  const configs = [
    {
      name: 'Current Config (iss: chat)',
      payload: {
        aud: 'jitsi',
        iss: 'chat',
        sub: appId,
        room: roomName,
        exp: now + (2 * 60 * 60), // 2 hours
        nbf: now - 10,
        context: {
          user: {
            id: 'test-user-123',
            name: 'Test User',
            email: 'test@example.com',
            moderator: true,
            avatar: ''
          },
          features: {
            livestreaming: true,
            recording: true,
            transcription: false,
            'sip-inbound-call': false,
            'sip-outbound-call': false,
            'inbound-call': false,
            'outbound-call': false
          }
        }
      }
    },
    {
      name: 'Alternative Config (room: *)',
      payload: {
        aud: 'jitsi',
        iss: 'chat',
        sub: appId,
        room: '*', // Allow all rooms
        exp: now + (2 * 60 * 60),
        nbf: now - 10,
        context: {
          user: {
            id: 'test-user-123',
            name: 'Test User',
            email: 'test@example.com',
            moderator: true,
            avatar: ''
          },
          features: {
            livestreaming: true,
            recording: true,
            transcription: false,
            'sip-inbound-call': false,
            'sip-outbound-call': false,
            'inbound-call': false,
            'outbound-call': false
          }
        }
      }
    },
    {
      name: 'Minimal Config',
      payload: {
        aud: 'jitsi',
        iss: 'chat',
        sub: appId,
        room: '*',
        exp: now + (2 * 60 * 60),
        context: {
          user: {
            id: 'test-user-123',
            name: 'Test User',
            moderator: true
          }
        }
      }
    }
  ];

  configs.forEach((config, index) => {
    console.log(`\n🧪 TEST ${index + 1}: ${config.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const token = jwt.sign(config.payload, privateKey, {
        algorithm: 'RS256',
        header: {
          kid: kid,
          typ: 'JWT',
          alg: 'RS256'
        }
      });

      console.log('✅ JWT Generated Successfully');
      console.log('');
      console.log('Payload:');
      console.log(JSON.stringify(config.payload, null, 2));
      console.log('');
      console.log('Test URL:');
      console.log(`https://8x8.vc/${roomName}?jwt=${token}`);
      console.log('');
      
      // Decode to verify
      const decoded = jwt.decode(token, { complete: true });
      console.log('Header:', JSON.stringify(decoded.header, null, 2));
      
    } catch (error) {
      console.log('❌ JWT Generation Failed:', error.message);
    }
  });

  console.log('\n🔍 TROUBLESHOOTING CHECKLIST:');
  console.log('1. ✅ iss: "chat" (correct per docs)');
  console.log('2. ✅ aud: "jitsi" (correct)');
  console.log('3. ✅ sub: App ID (correct)');
  console.log('4. ✅ exp: Future timestamp (correct)');
  console.log('5. ✅ Algorithm: RS256 (correct)');
  console.log('6. ✅ KID in header (correct)');
  console.log('');
  console.log('🎯 Try the URLs above to see which configuration works!');
}

debugJWT();
