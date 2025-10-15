// Frontend NFT Gating Implementation Example
// Complete working code for auction winners to burn NFTs and join meetings

// ========================================
// 1. UTILITY FUNCTIONS
// ========================================

// Get user's won auctions
const getWonAuctions = async (userWallet) => {
  try {
    const response = await fetch(`/api/contract/dashboard/user/${userWallet}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('userToken')}`
      }
    });
    const data = await response.json();
    
    if (data.success) {
      // Filter for auctions where user is the winner (not creator)
      const wonAuctions = data.database.userAuctions.filter(auction => 
        auction.creator_wallet.toLowerCase() !== userWallet.toLowerCase()
      );
      return wonAuctions;
    }
    return [];
  } catch (error) {
    console.error('Failed to get won auctions:', error);
    return [];
  }
};

// Get user's NFTs that can be burned
const getBurnableNFTs = async (userWallet) => {
  try {
    const response = await fetch(`/api/contract/nfts/${userWallet}`);
    const data = await response.json();
    
    if (data.success) {
      const burnableNFTs = [];
      
      // Check each NFT for burn eligibility
      for (const nft of data.nfts) {
        try {
          const canBurnResponse = await fetch(`/api/contract/can-burn/${nft.tokenId}/${userWallet}`);
          const canBurnData = await canBurnResponse.json();
          
          if (canBurnData.success && canBurnData.canBurn) {
            burnableNFTs.push({
              ...nft,
              auctionId: canBurnData.auctionId,
              meetingReady: canBurnData.meetingReady
            });
          }
        } catch (error) {
          console.warn(`Failed to check NFT ${nft.tokenId}:`, error);
        }
      }
      
      return burnableNFTs;
    }
    return [];
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

// ========================================
// 2. SMART CONTRACT INTERACTION
// ========================================

// Burn NFT for meeting access
const burnNFTForMeeting = async (tokenId, auctionId) => {
  try {
    // Check if MetaMask is available
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Please install MetaMask.');
    }

    // Get provider and signer
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Contract configuration
    const contractAddress = process.env.REACT_APP_AUCTION_CONTRACT_ADDRESS;
    const contractABI = [
      {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "burnNFTForMeeting",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    
    // Call burnNFTForMeeting function
    console.log(`Burning NFT ${tokenId} for auction ${auctionId}...`);
    const tx = await contract.burnNFTForMeeting(tokenId);
    console.log('Burn transaction sent:', tx.hash);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log('Burn transaction confirmed:', receipt.transactionHash);
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      tokenId: tokenId,
      auctionId: auctionId,
      gasUsed: receipt.gasUsed.toString()
    };
    
  } catch (error) {
    console.error('Failed to burn NFT:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ========================================
// 3. MEETING ACCESS
// ========================================

// Get meeting access after NFT burn
const getMeetingAccess = async (auctionId, tokenId, burnTransactionHash) => {
  try {
    const response = await fetch(`/api/meetings/join-gated/${auctionId}`, {
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
    console.error('Failed to get meeting access:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ========================================
// 4. REACT COMPONENTS
// ========================================

// Winner Dashboard Component
const WinnerDashboard = ({ userWallet, userToken }) => {
  const [wonAuctions, setWonAuctions] = useState([]);
  const [burnableNFTs, setBurnableNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWinnerData();
  }, [userWallet]);

  const loadWinnerData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get won auctions
      const auctions = await getWonAuctions(userWallet);
      setWonAuctions(auctions);
      
      // Get burnable NFTs
      const nfts = await getBurnableNFTs(userWallet);
      setBurnableNFTs(nfts);
      
    } catch (error) {
      console.error('Failed to load winner data:', error);
      setError('Failed to load your auction data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your won auctions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={loadWinnerData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="winner-dashboard">
      <div className="dashboard-header">
        <h2>🏆 Your Won Auctions</h2>
        <p>Manage your auction wins and access meetings</p>
      </div>
      
      {wonAuctions.length === 0 ? (
        <div className="no-auctions">
          <p>No won auctions found</p>
          <p>Win an auction to see it here!</p>
        </div>
      ) : (
        <div className="auctions-section">
          <h3>Your Auction Wins</h3>
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
        </div>
      )}
      
      <div className="nfts-section">
        <h3>🎫 Available NFTs for Meeting Access</h3>
        {burnableNFTs.length === 0 ? (
          <div className="no-nfts">
            <p>No NFTs available for meeting access</p>
            <p>Burn your NFTs to join meetings!</p>
          </div>
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
    </div>
  );
};

// NFT Card Component
const NFTCard = ({ nft, userWallet, userToken }) => {
  const [burning, setBurning] = useState(false);
  const [meetingAccess, setMeetingAccess] = useState(null);
  const [error, setError] = useState(null);

  const handleBurnNFT = async () => {
    if (!confirm(`Are you sure you want to burn NFT #${nft.tokenId} to access the meeting?\n\nThis action cannot be undone and will permanently destroy your NFT.`)) {
      return;
    }

    setBurning(true);
    setError(null);
    
    try {
      // Step 1: Burn NFT on blockchain
      console.log(`Starting NFT burn process for token ${nft.tokenId}...`);
      const burnResult = await burnNFTForMeeting(nft.tokenId, nft.auctionId);
      
      if (!burnResult.success) {
        throw new Error(burnResult.error);
      }

      console.log('NFT burned successfully, getting meeting access...');

      // Step 2: Get meeting access
      const accessResult = await getMeetingAccess(
        nft.auctionId, 
        nft.tokenId, 
        burnResult.transactionHash
      );

      if (accessResult.success) {
        setMeetingAccess(accessResult);
        console.log('Meeting access granted!');
      } else {
        throw new Error(accessResult.error);
      }

    } catch (error) {
      console.error('Burn process failed:', error);
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
        <p><strong>Token ID:</strong> {nft.tokenId}</p>
      </div>
      
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}
      
      {meetingAccess ? (
        <div className="meeting-access">
          <div className="success-message">
            <p>✅ NFT burned successfully!</p>
            <p>You now have access to the meeting.</p>
          </div>
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
          className={`burn-nft-btn ${burning ? 'burning' : ''}`}
        >
          {burning ? '🔥 Burning NFT...' : '🔥 Burn NFT for Meeting Access'}
        </button>
      )}
    </div>
  );
};

// Auction Card Component
const AuctionCard = ({ auction, userWallet, userToken }) => {
  return (
    <div className="auction-card">
      <div className="auction-header">
        <h4>{auction.title}</h4>
        <span className={`auction-status ${auction.auto_ended ? 'ended' : 'active'}`}>
          {auction.auto_ended ? 'Ended' : 'Active'}
        </span>
      </div>
      
      <div className="auction-info">
        <p><strong>Creator:</strong> {auction.creator_name || 'Unknown'}</p>
        <p><strong>Meeting Duration:</strong> {auction.meeting_duration} minutes</p>
        <p><strong>Created:</strong> {new Date(auction.created_at).toLocaleDateString()}</p>
        {auction.has_meeting && (
          <p><strong>Meeting:</strong> ✅ Created</p>
        )}
      </div>
    </div>
  );
};

// ========================================
// 5. CSS STYLES
// ========================================

const styles = `
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

.loading-container, .error-container {
  text-align: center;
  padding: 40px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

.auction-header, .nft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.auction-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.auction-status.ended {
  background: #e74c3c;
  color: white;
}

.auction-status.active {
  background: #27ae60;
  color: white;
}

.nft-status {
  font-size: 12px;
  font-weight: bold;
}

.auction-info, .nft-info {
  margin-bottom: 15px;
}

.auction-info p, .nft-info p {
  margin: 5px 0;
  font-size: 14px;
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

.success-message p {
  margin: 5px 0;
  color: #27ae60;
  font-weight: bold;
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

.error-message p {
  margin: 0;
  color: #721c24;
  font-size: 14px;
}

.no-auctions, .no-nfts {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
}

.no-auctions p, .no-nfts p {
  margin: 10px 0;
}
`;

// ========================================
// 6. USAGE EXAMPLE
// ========================================

// Example usage in your main App component
const App = () => {
  const [userWallet, setUserWallet] = useState(null);
  const [userToken, setUserToken] = useState(null);

  useEffect(() => {
    // Get user data from your auth system
    const wallet = localStorage.getItem('userWallet');
    const token = localStorage.getItem('userToken');
    
    if (wallet && token) {
      setUserWallet(wallet);
      setUserToken(token);
    }
  }, []);

  if (!userWallet || !userToken) {
    return <div>Please connect your wallet and authenticate</div>;
  }

  return (
    <div>
      <style>{styles}</style>
      <WinnerDashboard 
        userWallet={userWallet} 
        userToken={userToken} 
      />
    </div>
  );
};

export default App;
