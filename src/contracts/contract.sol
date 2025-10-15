// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MeetingAuction is ReentrancyGuard, Ownable, Pausable, ERC721 {
    struct Auction {
        uint256 id;
        address host;
        uint256 endBlock;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        string metadataIPFS;
        string hostTwitterId;
        bool ended;
        bool meetingScheduled;
        uint256 duration; // Meeting duration in minutes
        uint256 nftTokenId;
        // Dashboard display fields
        string sellerName; // Host display name
        string eventName;
        uint256 eventDate;
        uint256 eventStartTime;
        uint256 eventEndTime;
        string profilePicture; // Host profile image URL
    }
    
    struct NFTMetadata {
        uint256 auctionId;
        address host;
        string hostTwitterId;
        string metadataIPFS;
        uint256 duration;
    }
    
    struct BidInfo {
        uint256 amount;
        uint256 timestamp;
        address bidder;
    }
    
    struct UserBidStats {
        uint256 bidCount; // Total bids placed by user in this auction
        uint256 firstBidTime;
        uint256 lastBidTime;
        uint256 currentBid; // User's current active bid amount
        bool hasWon; // Did user win the auction
    }
    
    // Core mappings
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;
    mapping(string => uint256) public twitterIdAuctionCount;
    mapping(uint256 => NFTMetadata) public nftMetadata;
    mapping(uint256 => bool) public nftUsedForMeeting;
    
    // Bid tracking
    mapping(uint256 => BidInfo[]) public bidHistory;
    mapping(address => uint256[]) public userAuctions;
    mapping(uint256 => mapping(address => UserBidStats)) public userBidStats;
    
    // State variables
    uint256 public auctionCounter;
    uint256 public nftCounter;
    uint256 public platformFee = 250; // 2.5%
    uint256 public constant MIN_BID_INCREMENT = 0.01 ether;
    uint256 public constant ANTI_SNIPE_BLOCKS = 50;
    uint256 public constant EXTENSION_BLOCKS = 25;
    uint256 public constant MAX_AUCTIONS_PER_TWITTER = 3;
    
    // Events
    event AuctionCreated(uint256 indexed auctionId, address indexed host, string twitterId);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 amount, uint256 nftTokenId);
    event MeetingScheduled(uint256 indexed auctionId, string accessHash);
    event RefundProcessed(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event NFTBurned(uint256 indexed tokenId, uint256 indexed auctionId);
    
    constructor() Ownable() ERC721("MeetingPass", "MEET") {}
    
    // Create auction with all dashboard fields
    function createAuction(
        address _host,
        string memory _twitterId,
        uint256 _duration,
        uint256 _reservePrice,
        string memory _metadataIPFS,
        uint256 _meetingDuration,
        string memory _sellerName,
        string memory _eventName,
        uint256 _eventDate,
        uint256 _eventStartTime,
        uint256 _eventEndTime,
        string memory _profilePicture
    ) external whenNotPaused returns (uint256) {
        require(_host != address(0), "Invalid host");
        require(bytes(_twitterId).length > 0, "No Twitter ID");
        require(twitterIdAuctionCount[_twitterId] < MAX_AUCTIONS_PER_TWITTER, "Limit reached");
        require(_duration > ANTI_SNIPE_BLOCKS, "Duration short");
        require(_reservePrice >= MIN_BID_INCREMENT, "Reserve low");
        
        uint256 auctionId = ++auctionCounter;
        
        auctions[auctionId] = Auction({
            id: auctionId,
            host: _host,
            endBlock: block.number + _duration,
            reservePrice: _reservePrice,
            highestBid: 0,
            highestBidder: address(0),
            metadataIPFS: _metadataIPFS,
            hostTwitterId: _twitterId,
            ended: false,
            meetingScheduled: false,
            duration: _meetingDuration,
            nftTokenId: 0,
            sellerName: _sellerName,
            eventName: _eventName,
            eventDate: _eventDate,
            eventStartTime: _eventStartTime,
            eventEndTime: _eventEndTime,
            profilePicture: _profilePicture
        });
        
        twitterIdAuctionCount[_twitterId]++;
        
        emit AuctionCreated(auctionId, _host, _twitterId);
        return auctionId;
    }
    
    // Place bid - FIXED for multiple bids from same user
    function placeBid(uint256 _auctionId) external payable nonReentrant whenNotPaused {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.id != 0, "No auction");
        require(!auction.ended, "Ended");
        require(msg.sender != auction.host, "Host cannot bid");
        require(block.number < auction.endBlock, "Expired");
        
        // Get user's current stats
        UserBidStats storage userStats = userBidStats[_auctionId][msg.sender];
        
        // Calculate minimum required bid
        uint256 minBid = auction.highestBid > 0 ? 
            auction.highestBid + MIN_BID_INCREMENT : 
            auction.reservePrice;
        
        // Calculate total user bid (accumulate with previous bid)
        uint256 totalUserBid = msg.value + userStats.currentBid;
        
        require(totalUserBid >= minBid, "Bid too low");
        
        // Anti-snipe extension
        if (auction.endBlock - block.number < ANTI_SNIPE_BLOCKS) {
            auction.endBlock += EXTENSION_BLOCKS;
        }
        
        // Handle previous highest bidder (if not same user)
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            // Refund previous highest bidder
            UserBidStats storage prevBidderStats = userBidStats[_auctionId][auction.highestBidder];
            pendingReturns[_auctionId][auction.highestBidder] += prevBidderStats.currentBid;
        }
        
        // Update auction state
        auction.highestBid = totalUserBid;
        auction.highestBidder = msg.sender;
        
        // Update user stats
        if (userStats.bidCount == 0) {
            // First bid from this user
            userStats.firstBidTime = block.timestamp;
            userAuctions[msg.sender].push(_auctionId);
        }
        userStats.bidCount++;
        userStats.lastBidTime = block.timestamp;
        userStats.currentBid = totalUserBid;
        
        // Track bid history
        bidHistory[_auctionId].push(BidInfo({
            amount: totalUserBid,
            timestamp: block.timestamp,
            bidder: msg.sender
        }));
        
        emit BidPlaced(_auctionId, msg.sender, totalUserBid);
    }
    
    // End auction - for backend cron
    function endAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.id != 0, "No auction");
        require(block.number >= auction.endBlock, "Still active");
        require(!auction.ended, "Already ended");
        
        auction.ended = true;
        
        // Decrement Twitter count
        if (twitterIdAuctionCount[auction.hostTwitterId] > 0) {
            twitterIdAuctionCount[auction.hostTwitterId]--;
        }
        
        if (auction.highestBidder != address(0)) {
            // Mark winner
            userBidStats[_auctionId][auction.highestBidder].hasWon = true;
            
            // Calculate fees
            uint256 platformAmount = (auction.highestBid * platformFee) / 10000;
            uint256 hostAmount = auction.highestBid - platformAmount;
            
            // Transfer funds
            (bool platformSuccess,) = payable(owner()).call{value: platformAmount}("");
            require(platformSuccess, "Platform transfer failed");
            
            (bool hostSuccess,) = auction.host.call{value: hostAmount}("");
            require(hostSuccess, "Host transfer failed");
            
            // Mint NFT for winner
            uint256 tokenId = ++nftCounter;
            auction.nftTokenId = tokenId;
            _safeMint(auction.highestBidder, tokenId);
            
            nftMetadata[tokenId] = NFTMetadata({
                auctionId: _auctionId,
                host: auction.host,
                hostTwitterId: auction.hostTwitterId,
                metadataIPFS: auction.metadataIPFS,
                duration: auction.duration
            });
            
            // Process refunds for non-winners
            _processRefunds(_auctionId);
        }
        
        emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid, auction.nftTokenId);
    }
    
    // Batch end auctions
    function batchEndAuctions(uint256[] calldata _auctionIds) external {
        for (uint256 i = 0; i < _auctionIds.length; i++) {
            Auction storage auction = auctions[_auctionIds[i]];
            if (auction.id != 0 && !auction.ended && block.number >= auction.endBlock) {
                this.endAuction(_auctionIds[i]);
            }
        }
    }
    
    // Process refunds (limited for gas)
    function _processRefunds(uint256 _auctionId) internal {
        BidInfo[] storage bids = bidHistory[_auctionId];
        uint256 maxRefunds = 20;
        uint256 processed = 0;
        
        for (uint256 i = 0; i < bids.length && processed < maxRefunds; i++) {
            address bidder = bids[i].bidder;
            if (bidder != auctions[_auctionId].highestBidder) {
                uint256 refund = pendingReturns[_auctionId][bidder];
                if (refund > 0) {
                    pendingReturns[_auctionId][bidder] = 0;
                    (bool success,) = bidder.call{value: refund}("");
                    if (!success) {
                        pendingReturns[_auctionId][bidder] = refund;
                    } else {
                        emit RefundProcessed(_auctionId, bidder, refund);
                    }
                    processed++;
                }
            }
        }
    }
    
    // Withdraw pending returns
    function withdrawPendingReturns(uint256 _auctionId) external nonReentrant {
        uint256 amount = pendingReturns[_auctionId][msg.sender];
        require(amount > 0, "No funds");
        
        pendingReturns[_auctionId][msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit RefundProcessed(_auctionId, msg.sender, amount);
    }
    
    // Schedule meeting
    function scheduleMeeting(uint256 _auctionId, string memory _accessHash) external {
        Auction storage auction = auctions[_auctionId];
        require(auction.ended, "Not ended");
        require(msg.sender == auction.host || msg.sender == owner(), "Unauthorized");
        require(!auction.meetingScheduled, "Already scheduled");
        
        auction.meetingScheduled = true;
        emit MeetingScheduled(_auctionId, _accessHash);
    }
    
    // Burn NFT for meeting access
    function burnNFTForMeeting(uint256 _tokenId) external nonReentrant returns (uint256) {
        require(_exists(_tokenId), "No token");
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        require(!nftUsedForMeeting[_tokenId], "Already used");
        
        NFTMetadata memory metadata = nftMetadata[_tokenId];
        uint256 auctionId = metadata.auctionId;
        
        Auction memory auction = auctions[auctionId];
        require(auction.ended && auction.meetingScheduled, "Not ready");
        
        nftUsedForMeeting[_tokenId] = true;
        _burn(_tokenId);
        
        emit NFTBurned(_tokenId, auctionId);
        return auctionId;
    }
    
    // Cancel auction
    function cancelAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.id != 0, "No auction");
        require(auction.host == msg.sender, "Not host");
        require(!auction.ended, "Already ended");
        require(block.number < auction.endBlock, "Expired");
        
        auction.ended = true;
        
        if (twitterIdAuctionCount[auction.hostTwitterId] > 0) {
            twitterIdAuctionCount[auction.hostTwitterId]--;
        }
        
        // Refund all bidders
        BidInfo[] storage bids = bidHistory[_auctionId];
        for (uint256 i = 0; i < bids.length; i++) {
            address bidder = bids[i].bidder;
            UserBidStats storage stats = userBidStats[_auctionId][bidder];
            if (stats.currentBid > 0) {
                pendingReturns[_auctionId][bidder] += stats.currentBid;
                stats.currentBid = 0;
            }
        }
        
        emit AuctionEnded(_auctionId, address(0), 0, 0);
    }
    
    // ========= DASHBOARD VIEW FUNCTIONS =========
    
    // Get Host Dashboard Data (optimized)
    function getHostDashboard(address _host) external view returns (
        uint256[] memory liveAuctionIds,
        uint256[] memory upcomingEventIds,
        uint256[] memory pastEventIds
    ) {
        uint256[] memory tempLive = new uint256[](50);
        uint256[] memory tempUpcoming = new uint256[](50);
        uint256[] memory tempPast = new uint256[](50);
        
        uint256 liveCount = 0;
        uint256 upcomingCount = 0;
        uint256 pastCount = 0;
        
        // Iterate backwards for most recent first
        for (uint256 i = auctionCounter; i > 0 && (liveCount < 50 || upcomingCount < 50 || pastCount < 50); i--) {
            Auction storage auction = auctions[i];
            if (auction.host == _host) {
                if (!auction.ended && block.number < auction.endBlock && liveCount < 50) {
                    tempLive[liveCount++] = i;
                } else if (auction.ended && !auction.meetingScheduled && upcomingCount < 50) {
                    tempUpcoming[upcomingCount++] = i;
                } else if (auction.meetingScheduled && pastCount < 50) {
                    tempPast[pastCount++] = i;
                }
            }
        }
        
        // Resize arrays
        liveAuctionIds = new uint256[](liveCount);
        upcomingEventIds = new uint256[](upcomingCount);
        pastEventIds = new uint256[](pastCount);
        
        for (uint256 i = 0; i < liveCount; i++) liveAuctionIds[i] = tempLive[i];
        for (uint256 i = 0; i < upcomingCount; i++) upcomingEventIds[i] = tempUpcoming[i];
        for (uint256 i = 0; i < pastCount; i++) pastEventIds[i] = tempPast[i];
    }
    
    // Get User Dashboard Data (for attendees)
    function getUserDashboard(address _user) external view returns (
        uint256[] memory myBidAuctionIds,
        uint256[] memory wonAuctionIds
    ) {
        uint256[] memory userAuctionIds = userAuctions[_user];
        uint256[] memory tempBids = new uint256[](userAuctionIds.length);
        uint256[] memory tempWon = new uint256[](userAuctionIds.length);
        
        uint256 bidCount = 0;
        uint256 wonCount = 0;
        
        for (uint256 i = 0; i < userAuctionIds.length; i++) {
            uint256 auctionId = userAuctionIds[i];
            Auction storage auction = auctions[auctionId];
            UserBidStats storage stats = userBidStats[auctionId][_user];
            
            if (!auction.ended) {
                tempBids[bidCount++] = auctionId;
            } else if (stats.hasWon) {
                tempWon[wonCount++] = auctionId;
            }
        }
        
        // Resize arrays
        myBidAuctionIds = new uint256[](bidCount);
        wonAuctionIds = new uint256[](wonCount);
        
        for (uint256 i = 0; i < bidCount; i++) myBidAuctionIds[i] = tempBids[i];
        for (uint256 i = 0; i < wonCount; i++) wonAuctionIds[i] = tempWon[i];
    }
    
    // Get bid status for user
    function getUserBidStatus(uint256 _auctionId, address _user) external view returns (
        string memory status,
        uint256 userBidAmount,
        uint256 currentHighestBid,
        uint256 bidCount,
        bool hasWon
    ) {
        Auction storage auction = auctions[_auctionId];
        UserBidStats storage stats = userBidStats[_auctionId][_user];
        
        userBidAmount = stats.currentBid;
        currentHighestBid = auction.highestBid;
        bidCount = stats.bidCount;
        hasWon = stats.hasWon;
        
        if (stats.bidCount == 0) {
            status = "No Bid";
        } else if (!auction.ended) {
            status = auction.highestBidder == _user ? "Winning" : "Outbid";
        } else {
            status = stats.hasWon ? "Won" : "Lost";
        }
    }
    
    // Get user's NFTs
    function getUserNFTs(address _user) external view returns (uint256[] memory, uint256[] memory) {
        uint256 balance = balanceOf(_user);
        if (balance == 0) return (new uint256[](0), new uint256[](0));
        
        uint256[] memory tokens = new uint256[](balance);
        uint256[] memory auctionIds = new uint256[](balance);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= nftCounter && count < balance; i++) {
            if (_exists(i) && ownerOf(i) == _user && !nftUsedForMeeting[i]) {
                tokens[count] = i;
                auctionIds[count] = nftMetadata[i].auctionId;
                count++;
            }
        }
        
        return (tokens, auctionIds);
    }
    
    // Get active auctions
    function getActiveAuctions(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256[] memory active = new uint256[](limit);
        uint256 count = 0;
        
        for (uint256 i = auctionCounter; i > offset && count < limit; i--) {
            if (!auctions[i].ended && block.number < auctions[i].endBlock) {
                active[count++] = i;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) result[i] = active[i];
        return result;
    }
    
    // Get auction details
    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }
    
    // Get user bid stats
    function getUserBidStats(uint256 _auctionId, address _user) external view returns (UserBidStats memory) {
        return userBidStats[_auctionId][_user];
    }
    
    // Get bid history
    function getBidHistory(uint256 _auctionId) external view returns (BidInfo[] memory) {
        return bidHistory[_auctionId];
    }
    
    // Get bid count for auction
    function getAuctionBidCount(uint256 _auctionId) external view returns (uint256) {
        return bidHistory[_auctionId].length;
    }
    
    // Check if can create auction
    function canCreateAuction(string memory _twitterId) external view returns (bool) {
        return twitterIdAuctionCount[_twitterId] < MAX_AUCTIONS_PER_TWITTER;
    }
    
    // Emergency functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high");
        platformFee = _newFee;
    }
    
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // NFT Override
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "No token");
        return string(abi.encodePacked("ipfs://", nftMetadata[tokenId].metadataIPFS));
    }
    
    // Override transfer to allow NFT transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        // NFT transfers are allowed by default in ERC721
    }
}
