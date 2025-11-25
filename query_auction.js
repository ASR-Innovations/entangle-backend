const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const contractAddress = '0xC189A7E4Aa1dD9eD9a93758898E64aDe8bda5486';

// Minimal ABI for getAuction
const abi = [
  "function getAuction(uint256 _auctionId) view returns (tuple(uint256 id, address host, uint256 endBlock, uint256 reservePrice, uint256 highestBid, address highestBidder, string metadataIPFS, string hostTwitterId, bool ended, bool meetingScheduled, uint256 duration, uint256 nftTokenId, string sellerName, string eventName, uint256 eventDate, uint256 eventStartTime, uint256 eventEndTime, string profilePicture))"
];

const contract = new ethers.Contract(contractAddress, abi, provider);

async function main() {
  try {
    const auction = await contract.getAuction(2);
    const currentBlock = await provider.getBlockNumber();
    
    console.log('=== AUCTION 2 DATA FROM BLOCKCHAIN ===');
    console.log('ID:', auction.id.toString());
    console.log('Host:', auction.host);
    console.log('EndBlock:', auction.endBlock.toString());
    console.log('Duration (meeting mins):', auction.duration.toString());
    console.log('Seller Name:', auction.sellerName);
    console.log('Event Name:', auction.eventName);
    console.log('Ended:', auction.ended);
    console.log('');
    console.log('=== CALCULATED VALUES ===');
    console.log('Current Block:', currentBlock);
    console.log('Blocks Remaining:', (auction.endBlock - BigInt(currentBlock)).toString());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
