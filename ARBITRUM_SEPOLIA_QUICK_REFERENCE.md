# Arbitrum Sepolia - Quick Reference Guide

## Network Information

| Parameter | Value |
|-----------|-------|
| **Network Name** | Arbitrum Sepolia Testnet |
| **Chain ID** | 421614 |
| **Currency Symbol** | ETH |
| **Block Time** | ~0.25 seconds |
| **RPC URL** | https://sepolia-rollup.arbitrum.io/rpc |
| **WebSocket URL** | wss://sepolia-rollup.arbitrum.io/rpc |
| **Explorer** | https://sepolia.arbiscan.io |

## Alternative RPC Endpoints

### HTTP RPC
If the primary endpoint has issues, try these alternatives:

1. **BlockPI**: https://arbitrum-sepolia.blockpi.network/v1/rpc/public
2. **Alchemy**: https://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY (requires API key)
3. **Infura**: https://arbitrum-sepolia.infura.io/v3/YOUR_API_KEY (requires API key)

### WebSocket RPC
⚠️ **Note**: Public WebSocket endpoints for Arbitrum Sepolia have limitations. For production use, consider:

1. **Alchemy** (Recommended): wss://arb-sepolia.g.alchemy.com/v2/YOUR_API_KEY
2. **Infura**: wss://arbitrum-sepolia.infura.io/ws/v3/YOUR_API_KEY
3. **QuickNode**: Custom endpoint (requires account)

**Free tier options:**
- Alchemy: 300M compute units/month
- Infura: 100k requests/day

## Contract Addresses

### Seaport Protocol
- **Seaport 1.6**: `0x0000000000000068F116a894984e2DB1123eB395`
- **Seaport 1.5**: `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC`

### Your Auction Contract
- **Current**: Update this after deploying to Arbitrum Sepolia
- **Environment Variable**: `AUCTION_CONTRACT_ADDRESS`

## Getting Testnet ETH

### Faucets
1. **QuickNode Faucet**: https://faucet.quicknode.com/arbitrum/sepolia
2. **Alchemy Faucet**: https://www.alchemy.com/faucets/arbitrum-sepolia
3. **Chainlink Faucet**: https://faucets.chain.link/arbitrum-sepolia

### Requirements
- Usually requires a wallet address
- Some faucets require social media verification
- Typical amount: 0.01 - 0.1 ETH per request

## MetaMask Configuration

To add Arbitrum Sepolia to MetaMask:

1. Open MetaMask
2. Click network dropdown
3. Click "Add Network"
4. Enter these details:
   - **Network Name**: Arbitrum Sepolia
   - **RPC URL**: https://sepolia-rollup.arbitrum.io/rpc
   - **Chain ID**: 421614
   - **Currency Symbol**: ETH
   - **Block Explorer**: https://sepolia.arbiscan.io

Or use this quick add link: https://chainlist.org/?search=arbitrum+sepolia

## Environment Variables

### Minimal Configuration
```bash
BLOCKCHAIN_NETWORK=ARBITRUM_SEPOLIA
ETH_HTTP_ENDPOINT=https://sepolia-rollup.arbitrum.io/rpc
ETH_WSS_ENDPOINT=wss://sepolia-rollup.arbitrum.io/rpc
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
WS_RPC_URL=wss://sepolia-rollup.arbitrum.io/rpc
SEAPORT_CHAIN_ID=421614
SEAPORT_CONTRACT_ADDRESS=0x0000000000000068F116a894984e2DB1123eB395
AUCTION_CONTRACT_ADDRESS=<YOUR_CONTRACT_ADDRESS>
```

## Key Differences from Ethereum Sepolia

| Feature | Ethereum Sepolia | Arbitrum Sepolia |
|---------|------------------|------------------|
| Chain ID | 11155111 | 421614 |
| Block Time | ~12 seconds | ~0.25 seconds |
| Gas Costs | Higher | Much Lower (L2) |
| Finality | ~15 minutes | ~15 minutes (L1 finality) |
| TPS | ~15 | ~4000 |

## Testing Your Connection

### Using curl
```bash
# Test HTTP RPC
curl -X POST https://sepolia-rollup.arbitrum.io/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Expected response: {"jsonrpc":"2.0","id":1,"result":"0x66eee"}
# (0x66eee = 421614 in hex)
```

### Using Node.js
```javascript
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');

async function test() {
  const network = await provider.getNetwork();
  console.log('Chain ID:', network.chainId.toString()); // Should be 421614
  
  const blockNumber = await provider.getBlockNumber();
  console.log('Current Block:', blockNumber);
}

test();
```

## Common Issues & Solutions

### Issue: "Chain ID mismatch"
**Solution**: Make sure `SEAPORT_CHAIN_ID=421614` in your `.env` file

### Issue: "Cannot connect to RPC"
**Solution**: Try alternative RPC endpoints listed above

### Issue: "Transaction not found"
**Solution**: Make sure your contract is deployed on Arbitrum Sepolia, not Ethereum Sepolia

### Issue: "Insufficient funds"
**Solution**: Get testnet ETH from one of the faucets listed above

## Useful Links

- **Official Docs**: https://docs.arbitrum.io
- **Arbitrum Portal**: https://portal.arbitrum.io
- **Sepolia Bridge**: https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia
- **Status Page**: https://status.arbitrum.io
- **Discord**: https://discord.gg/arbitrum

## Deployment Checklist

- [ ] Get Arbitrum Sepolia testnet ETH
- [ ] Deploy auction contract to Arbitrum Sepolia
- [ ] Update `AUCTION_CONTRACT_ADDRESS` in `.env`
- [ ] Verify contract on Arbiscan
- [ ] Test contract functions
- [ ] Update frontend to use Chain ID 421614
- [ ] Test end-to-end auction flow
- [ ] Monitor gas costs and performance

## Support

If you encounter issues:
1. Check the Arbitrum status page
2. Verify your RPC endpoint is responding
3. Ensure your contract is deployed on the correct network
4. Check the Arbitrum Discord for known issues
