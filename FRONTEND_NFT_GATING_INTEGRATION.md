# Frontend NFT Gating Integration Guide

## 🎯 **Complete Frontend Integration for NFT Winners**

This guide covers all the frontend functionality needed for auction winners to burn NFTs and join meetings.

---

## 📋 **REQUIRED FRONTEND COMPONENTS**

### **1. Winner Dashboard Component**
- Display user's won auctions
- Show available NFTs for burning
- Meeting access interface

### **2. NFT Burn Interface**
- NFT selection and burn confirmation
- Transaction status tracking
- Meeting access after burn

### **3. Meeting Room Component**
- Jitsi meeting integration
- Token-based access
- Meeting controls

---

## 🔄 **COMPLETE WINNER FLOW**

### **Step 1: Check User's Won Auctions**
```javascript
// Frontend: Get user's won auctions
const getWonAuctions = async (userWallet) => {
  try {
    const response = await fetch(`/api/contract/dashboard/user/${userWallet}`);
    const data = await response.json();
    
    // Filter for won auctions (auctions where user is the winner)
    const wonAuctions = data.database.userAuctions.filter(auction => 
      auction.creator_wallet.toLowerCase() !== userWallet.toLowerCase()
    );
    
    return wonAuctions;
  } catch (error) {
    console.error('Failed to get won auctions:', error);
    return [];
  }
};
```

### **Step 2: Check Available NFTs**
```javascript
// Frontend: Get user's NFTs that can be burned
const getBurnableNFTs = async (userWallet) => {
  try {
    const response = await fetch(`/api/contract/nfts/${userWallet}`);
    const data = await response.json();
    
    // Filter NFTs that can be burned for meetings
    const burnableNFTs = [];
    
    for (const nft of data.nfts) {
      const canBurn = await checkCanBurnNFT(nft.tokenId, userWallet);
      if (canBurn.canBurn) {
        burnableNFTs.push({
          ...nft,
          auctionId: canBurn.auctionId,
          meetingReady: canBurn.meetingReady
        });
      }
    }
    
    return burnableNFTs;
  } catch (error) {
    console.error('Failed to get burnable NFTs:', error);
    return [];
  }
};

// Check if specific NFT can be burned
const checkCanBurnNFT = async (tokenId, userWallet) => {
  try {
    const response = await fetch(`/api/contract/can-burn/${tokenId}/${userWallet}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to check burn eligibility:', error);
    return { canBurn: false, reason: 'Check failed' };
  }
};
```

### **Step 3: Burn NFT (Smart Contract Interaction)**
```javascript
// Frontend: Burn NFT for meeting access
const burnNFTForMeeting = async (tokenId, auctionId) => {
  try {
    // 1. Get user's wallet connection (MetaMask, etc.)
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // 2. Get contract instance
    const contractAddress = "YOUR_AUCTION_CONTRACT_ADDRESS";
    const contractABI = [/* Your contract ABI */];
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // 3. Call burnNFTForMeeting function
    const tx = await contract.burnNFTForMeeting(tokenId);
    console.log('Burn transaction sent:', tx.hash);
    
    // 4. Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log('Burn transaction confirmed:', receipt.transactionHash);
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId,
      auctionId: auctionId
    };
    
  } catch (error) {
    console.error('Failed to burn NFT:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

### **Step 4: Get Meeting Access After Burn**
```javascript
// Frontend: Get meeting access after NFT burn
const getMeetingAccess = async (auctionId, tokenId, burnTransactionHash) => {
  try {
    const response = await fetch(`/api/meetings/join-gated/${auctionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` // JWT token from auth
      },
      body: JSON.stringify({
        burnTransactionHash: burnTransactionHash
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        meetingUrl: data.url,
        token: data.token,
        meeting: data.meeting
      };
    } else {
      throw new Error(data.error || 'Failed to get meeting access');
    }
    
  } catch (error) {
    console.error('Failed to get meeting access:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

---

## 🎨 **REACT COMPONENT EXAMPLES**

### **1. Winner Dashboard Component**
```jsx
import React, { useState, useEffect } from 'react';

const WinnerDashboard = ({ userWallet, userToken }) => {
  const [wonAuctions, setWonAuctions] = useState([]);
  const [burnableNFTs, setBurnableNFTs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWinnerData();
  }, [userWallet]);

  const loadWinnerData = async () => {
    setLoading(true);
    try {
      // Get won auctions
      const auctions = await getWonAuctions(userWallet);
      setWonAuctions(auctions);
      
      // Get burnable NFTs
      const nfts = await getBurnableNFTs(userWallet);
      setBurnableNFTs(nfts);
      
    } catch (error) {
      console.error('Failed to load winner data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading your won auctions...</div>;

  return (
    <div className="winner-dashboard">
      <h2>Your Won Auctions</h2>
      
      {wonAuctions.length === 0 ? (
        <p>No won auctions found</p>
      ) : (
        <div className="auctions-grid">
          {wonAuctions.map(auction => (
            <AuctionCard 
              key={auction.id} 
              auction={auction}
              userWallet={userWallet}
              userToken={userToken}
            />
          ))}
        </div>
      )}
      
      <h3>Available NFTs for Meeting Access</h3>
      {burnableNFTs.length === 0 ? (
        <p>No NFTs available for meeting access</p>
      ) : (
        <div className="nfts-grid">
          {burnableNFTs.map(nft => (
            <NFTCard 
              key={nft.tokenId} 
              nft={nft}
              userWallet={userWallet}
              userToken={userToken}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WinnerDashboard;
```

### **2. NFT Burn Component**
```jsx
import React, { useState } from 'react';

const NFTCard = ({ nft, userWallet, userToken }) => {
  const [burning, setBurning] = useState(false);
  const [meetingAccess, setMeetingAccess] = useState(null);

  const handleBurnNFT = async () => {
    if (!confirm(`Are you sure you want to burn NFT #${nft.tokenId} to access the meeting? This action cannot be undone.`)) {
      return;
    }

    setBurning(true);
    try {
      // Step 1: Burn NFT on blockchain
      const burnResult = await burnNFTForMeeting(nft.tokenId, nft.auctionId);
      
      if (!burnResult.success) {
        throw new Error(burnResult.error);
      }

      // Step 2: Get meeting access
      const accessResult = await getMeetingAccess(
        nft.auctionId, 
        nft.tokenId, 
        burnResult.transactionHash
      );

      if (accessResult.success) {
        setMeetingAccess(accessResult);
        alert('NFT burned successfully! You now have access to the meeting.');
      } else {
        throw new Error(accessResult.error);
      }

    } catch (error) {
      console.error('Burn process failed:', error);
      alert(`Failed to burn NFT: ${error.message}`);
    } finally {
      setBurning(false);
    }
  };

  return (
    <div className="nft-card">
      <div className="nft-info">
        <h4>NFT #{nft.tokenId}</h4>
        <p>Auction ID: {nft.auctionId}</p>
        <p>Meeting Ready: {nft.meetingReady ? 'Yes' : 'No'}</p>
      </div>
      
      {meetingAccess ? (
        <div className="meeting-access">
          <p>✅ Meeting access granted!</p>
          <a 
            href={meetingAccess.meetingUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="join-meeting-btn"
          >
            Join Meeting
          </a>
        </div>
      ) : (
        <button 
          onClick={handleBurnNFT}
          disabled={burning || !nft.meetingReady}
          className="burn-nft-btn"
        >
          {burning ? 'Burning NFT...' : 'Burn NFT for Meeting Access'}
        </button>
      )}
    </div>
  );
};

export default NFTCard;
```

### **3. Meeting Room Component**
```jsx
import React, { useEffect, useRef } from 'react';
import JitsiMeetExternalAPI from '@jitsi/react-sdk';

const MeetingRoom = ({ meetingUrl, token, userName, userEmail }) => {
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  useEffect(() => {
    if (meetingUrl && token) {
      initializeJitsi();
    }

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [meetingUrl, token]);

  const initializeJitsi = () => {
    const domain = 'meet.jit.si'; // or your Jitsi domain
    const options = {
      roomName: extractRoomName(meetingUrl),
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: userName,
        email: userEmail
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
          'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
        ]
      }
    };

    jitsiApiRef.current = new JitsiMeetExternalAPI(domain, options);

    // Add event listeners
    jitsiApiRef.current.addEventListeners({
      readyToClose: () => {
        console.log('Meeting ended');
      },
      participantLeft: (participant) => {
        console.log('Participant left:', participant);
      },
      participantJoined: (participant) => {
        console.log('Participant joined:', participant);
      }
    });
  };

  const extractRoomName = (url) => {
    // Extract room name from Jitsi URL
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1];
  };

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <h3>Meeting Room</h3>
        <p>You have successfully burned your NFT and gained access to this meeting.</p>
      </div>
      
      <div 
        ref={jitsiContainerRef} 
        className="jitsi-container"
        style={{ height: '600px', width: '100%' }}
      />
    </div>
  );
};

export default MeetingRoom;
```

---

## 🔧 **REQUIRED API ENDPOINTS**

### **1. Get User's Won Auctions**
```javascript
// GET /api/contract/dashboard/user/:address
// Returns: User's auction participation and won auctions
```

### **2. Get User's NFTs**
```javascript
// GET /api/contract/nfts/:address
// Returns: All NFTs owned by user
```

### **3. Check NFT Burn Eligibility**
```javascript
// GET /api/contract/can-burn/:tokenId/:userAddress
// Returns: { canBurn: boolean, reason: string, auctionId: number }
```

### **4. Join Gated Meeting**
```javascript
// POST /api/meetings/join-gated/:roomId
// Body: { burnTransactionHash: string }
// Returns: { success: boolean, token: string, url: string, meeting: object }
```

---

## 📱 **COMPLETE USER FLOW**

### **1. User Wins Auction**
```
Auction Ends → NFT Minted to Winner → Winner Notified → Winner Dashboard
```

### **2. Winner Checks Available NFTs**
```
Winner Dashboard → Check NFTs → Display Burnable NFTs → Show Meeting Status
```

### **3. Winner Burns NFT**
```
Select NFT → Confirm Burn → Execute Smart Contract → Wait for Confirmation
```

### **4. Winner Joins Meeting**
```
Burn Confirmed → Get Meeting Access → Join Jitsi Room → Meeting Started
```

---

## 🎯 **FRONTEND INTEGRATION CHECKLIST**

### **✅ Required Components:**
- [ ] Winner Dashboard
- [ ] NFT Selection Interface
- [ ] Burn Confirmation Modal
- [ ] Transaction Status Tracker
- [ ] Meeting Room Component
- [ ] Jitsi Integration

### **✅ Required API Calls:**
- [ ] Get user's won auctions
- [ ] Get user's NFTs
- [ ] Check NFT burn eligibility
- [ ] Burn NFT (smart contract)
- [ ] Get meeting access
- [ ] Join meeting room

### **✅ Required Smart Contract Functions:**
- [ ] `burnNFTForMeeting(tokenId)` - Burn NFT for meeting access
- [ ] `ownerOf(tokenId)` - Check NFT ownership
- [ ] `nftUsedForMeeting(tokenId)` - Check if NFT already used

### **✅ Required Backend Endpoints:**
- [ ] `/api/contract/dashboard/user/:address` - User dashboard
- [ ] `/api/contract/nfts/:address` - User's NFTs
- [ ] `/api/contract/can-burn/:tokenId/:userAddress` - Burn eligibility
- [ ] `/api/meetings/join-gated/:roomId` - Meeting access

---

## 🚀 **IMPLEMENTATION STEPS**

### **Step 1: Set Up Winner Dashboard**
1. Create winner dashboard component
2. Implement API calls to get won auctions
3. Display available NFTs for burning

### **Step 2: Implement NFT Burning**
1. Add smart contract integration
2. Create burn confirmation flow
3. Handle transaction status

### **Step 3: Add Meeting Access**
1. Implement meeting access API calls
2. Create Jitsi meeting component
3. Handle meeting room joining

### **Step 4: Test Complete Flow**
1. Test NFT burning process
2. Test meeting access verification
3. Test Jitsi meeting integration

This complete integration will allow auction winners to seamlessly burn their NFTs and join meetings! 🎉
