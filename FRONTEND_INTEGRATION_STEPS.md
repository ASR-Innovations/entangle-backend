# Frontend NFT Gating Integration - Step by Step

## 🎯 **Complete Integration Guide for Auction Winners**

This guide provides step-by-step instructions to integrate NFT burning and meeting access functionality into your frontend.

---

## 📋 **PREREQUISITES**

### **Required Dependencies:**
```bash
npm install ethers @jitsi/react-sdk
```

### **Environment Variables:**
```env
REACT_APP_AUCTION_CONTRACT_ADDRESS=0x...
REACT_APP_JITSI_DOMAIN=meet.jit.si
REACT_APP_API_BASE_URL=http://localhost:5000
```

---

## 🚀 **STEP 1: SET UP WINNER DASHBOARD**

### **1.1 Create Winner Dashboard Component**
```jsx
// components/WinnerDashboard.jsx
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

  return (
    <div className="winner-dashboard">
      <h2>🏆 Your Won Auctions</h2>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="auctions-section">
            <h3>Your Auction Wins</h3>
            {wonAuctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
          
          <div className="nfts-section">
            <h3>🎫 Available NFTs for Meeting Access</h3>
            {burnableNFTs.map(nft => (
              <NFTCard 
                key={nft.tokenId} 
                nft={nft}
                userWallet={userWallet}
                userToken={userToken}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WinnerDashboard;
```

### **1.2 Add API Functions**
```javascript
// utils/api.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const getWonAuctions = async (userWallet) => {
  const response = await fetch(`${API_BASE_URL}/api/contract/dashboard/user/${userWallet}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('userToken')}`
    }
  });
  const data = await response.json();
  
  if (data.success) {
    return data.database.userAuctions.filter(auction => 
      auction.creator_wallet.toLowerCase() !== userWallet.toLowerCase()
    );
  }
  return [];
};

export const getBurnableNFTs = async (userWallet) => {
  const response = await fetch(`${API_BASE_URL}/api/contract/nfts/${userWallet}`);
  const data = await response.json();
  
  if (data.success) {
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
  }
  return [];
};

export const checkCanBurnNFT = async (tokenId, userWallet) => {
  const response = await fetch(`${API_BASE_URL}/api/contract/can-burn/${tokenId}/${userWallet}`);
  const data = await response.json();
  return data;
};
```

---

## 🔥 **STEP 2: IMPLEMENT NFT BURNING**

### **2.1 Create NFT Burn Component**
```jsx
// components/NFTCard.jsx
import React, { useState } from 'react';
import { burnNFTForMeeting, getMeetingAccess } from '../utils/blockchain';

const NFTCard = ({ nft, userWallet, userToken }) => {
  const [burning, setBurning] = useState(false);
  const [meetingAccess, setMeetingAccess] = useState(null);
  const [error, setError] = useState(null);

  const handleBurnNFT = async () => {
    if (!confirm(`Burn NFT #${nft.tokenId} to access the meeting?\n\nThis action cannot be undone!`)) {
      return;
    }

    setBurning(true);
    setError(null);
    
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
      } else {
        throw new Error(accessResult.error);
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setBurning(false);
    }
  };

  return (
    <div className="nft-card">
      <div className="nft-header">
        <h4>NFT #{nft.tokenId}</h4>
        <span className="nft-status">
          {nft.meetingReady ? '✅ Meeting Ready' : '⏳ Meeting Pending'}
        </span>
      </div>
      
      <div className="nft-info">
        <p><strong>Auction ID:</strong> {nft.auctionId}</p>
        <p><strong>Contract:</strong> {nft.contract}</p>
      </div>
      
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}
      
      {meetingAccess ? (
        <div className="meeting-access">
          <p>✅ NFT burned successfully!</p>
          <a 
            href={meetingAccess.meetingUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="join-meeting-btn"
          >
            🎥 Join Meeting
          </a>
        </div>
      ) : (
        <button 
          onClick={handleBurnNFT}
          disabled={burning || !nft.meetingReady}
          className="burn-nft-btn"
        >
          {burning ? '🔥 Burning NFT...' : '🔥 Burn NFT for Meeting Access'}
        </button>
      )}
    </div>
  );
};

export default NFTCard;
```

### **2.2 Add Blockchain Functions**
```javascript
// utils/blockchain.js
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = process.env.REACT_APP_AUCTION_CONTRACT_ADDRESS;
const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "burnNFTForMeeting",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const burnNFTForMeeting = async (tokenId, auctionId) => {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    const tx = await contract.burnNFTForMeeting(tokenId);
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId,
      auctionId: auctionId
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const getMeetingAccess = async (auctionId, tokenId, burnTransactionHash) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/meetings/join-gated/${auctionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('userToken')}`
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
    return {
      success: false,
      error: error.message
    };
  }
};
```

---

## 🎥 **STEP 3: ADD MEETING INTEGRATION**

### **3.1 Create Meeting Room Component**
```jsx
// components/MeetingRoom.jsx
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
    const domain = process.env.REACT_APP_JITSI_DOMAIN;
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
      }
    };

    jitsiApiRef.current = new JitsiMeetExternalAPI(domain, options);

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

### **3.2 Update NFT Card with Meeting Integration**
```jsx
// components/NFTCard.jsx (updated)
import React, { useState } from 'react';
import MeetingRoom from './MeetingRoom';

const NFTCard = ({ nft, userWallet, userToken }) => {
  const [burning, setBurning] = useState(false);
  const [meetingAccess, setMeetingAccess] = useState(null);
  const [showMeeting, setShowMeeting] = useState(false);
  const [error, setError] = useState(null);

  const handleBurnNFT = async () => {
    // ... existing burn logic ...
  };

  const handleJoinMeeting = () => {
    setShowMeeting(true);
  };

  if (showMeeting && meetingAccess) {
    return (
      <MeetingRoom
        meetingUrl={meetingAccess.meetingUrl}
        token={meetingAccess.token}
        userName={localStorage.getItem('userName')}
        userEmail={localStorage.getItem('userEmail')}
      />
    );
  }

  return (
    <div className="nft-card">
      {/* ... existing JSX ... */}
      
      {meetingAccess ? (
        <div className="meeting-access">
          <p>✅ NFT burned successfully!</p>
          <button onClick={handleJoinMeeting} className="join-meeting-btn">
            🎥 Join Meeting
          </button>
        </div>
      ) : (
        <button 
          onClick={handleBurnNFT}
          disabled={burning || !nft.meetingReady}
          className="burn-nft-btn"
        >
          {burning ? '🔥 Burning NFT...' : '🔥 Burn NFT for Meeting Access'}
        </button>
      )}
    </div>
  );
};

export default NFTCard;
```

---

## 🎨 **STEP 4: ADD STYLING**

### **4.1 Create CSS File**
```css
/* styles/WinnerDashboard.css */
.winner-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
}

.dashboard-header h2 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.auctions-grid, .nfts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.auction-card, .nft-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.nft-status {
  font-size: 12px;
  font-weight: bold;
}

.burn-nft-btn {
  width: 100%;
  padding: 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s;
}

.burn-nft-btn:hover:not(:disabled) {
  background: #c0392b;
}

.burn-nft-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.burn-nft-btn.burning {
  background: #f39c12;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.meeting-access {
  text-align: center;
}

.success-message {
  background: #d5f4e6;
  border: 1px solid #27ae60;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}

.join-meeting-btn {
  display: inline-block;
  padding: 12px 24px;
  background: #27ae60;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  transition: background 0.3s;
}

.join-meeting-btn:hover {
  background: #229954;
}

.error-message {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 15px;
}

.meeting-room {
  width: 100%;
  height: 100vh;
}

.jitsi-container {
  border-radius: 8px;
  overflow: hidden;
}
```

---

## 🔧 **STEP 5: INTEGRATE INTO MAIN APP**

### **5.1 Update App.js**
```jsx
// App.js
import React, { useState, useEffect } from 'react';
import WinnerDashboard from './components/WinnerDashboard';
import './styles/WinnerDashboard.css';

function App() {
  const [userWallet, setUserWallet] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user data from your auth system
    const wallet = localStorage.getItem('userWallet');
    const token = localStorage.getItem('userToken');
    
    if (wallet && token) {
      setUserWallet(wallet);
      setUserToken(token);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!userWallet || !userToken) {
    return <div>Please connect your wallet and authenticate</div>;
  }

  return (
    <div className="App">
      <WinnerDashboard 
        userWallet={userWallet} 
        userToken={userToken} 
      />
    </div>
  );
}

export default App;
```

### **5.2 Add Route for Winner Dashboard**
```jsx
// App.js (with routing)
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<WinnerDashboard />} />
        <Route path="/meetings" element={<MeetingsPage />} />
      </Routes>
    </Router>
  );
}
```

---

## 🧪 **STEP 6: TESTING**

### **6.1 Test NFT Burning**
1. Connect MetaMask wallet
2. Ensure user has won auctions
3. Check if NFTs are available for burning
4. Test burn process with test NFT
5. Verify meeting access is granted

### **6.2 Test Meeting Access**
1. Burn NFT successfully
2. Verify meeting URL is generated
3. Test Jitsi meeting integration
4. Verify meeting controls work

### **6.3 Test Error Handling**
1. Test with invalid NFT
2. Test with already burned NFT
3. Test with network errors
4. Test with insufficient gas

---

## 🚀 **STEP 7: DEPLOYMENT**

### **7.1 Build for Production**
```bash
npm run build
```

### **7.2 Environment Variables**
```env
REACT_APP_AUCTION_CONTRACT_ADDRESS=0x...
REACT_APP_JITSI_DOMAIN=meet.jit.si
REACT_APP_API_BASE_URL=https://your-api.com
```

### **7.3 Deploy to Hosting**
- Deploy to Vercel, Netlify, or your preferred hosting
- Ensure environment variables are set
- Test production build

---

## ✅ **COMPLETION CHECKLIST**

- [ ] Winner dashboard displays won auctions
- [ ] NFT cards show burnable NFTs
- [ ] NFT burning works with MetaMask
- [ ] Meeting access is granted after burn
- [ ] Jitsi meeting integration works
- [ ] Error handling is implemented
- [ ] Styling is applied
- [ ] Production build works
- [ ] All API endpoints are connected

## 🎉 **RESULT**

Your frontend now has complete NFT gating functionality! Auction winners can:
1. View their won auctions
2. See available NFTs for burning
3. Burn NFTs to access meetings
4. Join Jitsi meetings with proper authentication
5. Enjoy a seamless user experience

The integration is complete and ready for production! 🚀
