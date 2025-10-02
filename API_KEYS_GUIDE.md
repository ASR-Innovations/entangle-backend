# API Keys and Configuration Guide

## **🔑 Required API Keys for Production**

### **1. Blockchain Infrastructure**

#### **Alchemy (Recommended)**
- **Service**: Ethereum RPC provider
- **Keys needed**: 
  - `ETH_WSS_ENDPOINT=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
  - `ETH_HTTP_ENDPOINT=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
- **How to get**: 
  1. Go to https://alchemy.com
  2. Create account and project
  3. Select "Ethereum" → "Sepolia" testnet
  4. Copy API key from dashboard
- **Cost**: Free tier available (300M requests/month)

#### **Smart Contract**
- **Keys needed**:
  - `AUCTION_CONTRACT_ADDRESS=0x...` - Your deployed contract address
  - `PLATFORM_PRIVATE_KEY=0x...` - Private key for automated auction ending
- **How to get**:
  1. Deploy MeetingAuction.sol using Hardhat
  2. Copy contract address from deployment
  3. Generate a new wallet for platform operations
  4. Fund it with test ETH for gas fees

### **2. Para Wallet Integration**

#### **Para API Keys**
- **Service**: User authentication and wallet management
- **Keys needed**:
  - `PARA_API_KEY=your-para-api-key`
  - `PARA_SECRET_API_KEY=your-para-secret-api-key`
  - `PARA_ENVIRONMENT=beta` (sandbox, beta, or prod)
- **How to get**:
  1. Go to https://getpara.com/developers
  2. Register for developer account
  3. Create new application
  4. Copy API keys from dashboard
- **Cost**: Contact Para team for pricing

### **3. Lit Protocol**

#### **Lit Protocol Configuration**
- **Service**: NFT-gated access control
- **Keys needed**:
  - `LIT_ACTION_IPFS_CID=your-lit-action-ipfs-cid`
  - `LIT_PKP_PUBLIC_KEY=0x...`
  - `LIT_NETWORK=serrano` (serrano, habanero, manzano)
- **How to get**:
  1. Go to https://developer.litprotocol.com
  2. Create Lit Action for NFT verification
  3. Upload to IPFS, get CID
  4. Generate PKP (Programmable Key Pair)
- **Cost**: Free on testnets, mainnet has usage fees

### **4. Jitsi Video Conferencing**

#### **Jitsi Configuration**
- **Service**: Video meeting rooms
- **Keys needed**:
  - `JITSI_DOMAIN=meet.jit.si` (or your self-hosted domain)
  - `JITSI_APP_ID=meeting-auction-app`
  - `JITSI_SECRET=your-jitsi-jwt-secret`
- **How to get**:
  1. **Option A (Free)**: Use public meet.jit.si (no secret needed)
  2. **Option B (Recommended)**: Self-host Jitsi
     - Deploy Jitsi Meet on your server
     - Configure JWT authentication
     - Generate secret for JWT signing
- **Cost**: Free for public, hosting costs for private

### **5. Database and Caching**

#### **PostgreSQL**
- **Service**: Primary database
- **Keys needed**: `DATABASE_URL=postgresql://user:password@host:5432/database`
- **Options**:
  - **Local**: Install PostgreSQL locally
  - **Cloud**: Heroku Postgres, AWS RDS, Google Cloud SQL
- **Cost**: Free tier available on most platforms

#### **Redis (Optional)**
- **Service**: Session caching
- **Keys needed**: `REDIS_URL=redis://host:6379`
- **Options**:
  - **Local**: Install Redis locally
  - **Cloud**: Redis Cloud, AWS ElastiCache
- **Cost**: Free tier available

### **6. Security**

#### **JWT Secret**
- **Keys needed**: `JWT_SECRET=your-super-secret-jwt-key-min-32-chars`
- **How to generate**: Use crypto.randomBytes(32).toString('hex')
- **Important**: Keep this secret and use different values for dev/prod

## **🛠️ Setup Priority Order**

### **Phase 1: Basic Setup (Required for MVP)**
1. ✅ **Alchemy API** - For blockchain connectivity
2. ✅ **Para API** - For user authentication
3. ✅ **PostgreSQL** - For data storage
4. ✅ **JWT Secret** - For security
5. ✅ **Smart Contract** - Deploy and get address

### **Phase 2: Meeting Functionality**
6. ✅ **Jitsi** - Start with public meet.jit.si
7. ✅ **Platform Private Key** - For automated auction ending

### **Phase 3: Advanced Features**
8. ⏳ **Lit Protocol** - For NFT-gated access
9. ⏳ **Redis** - For performance optimization
10. ⏳ **Custom Jitsi** - For branded experience

## **💰 Cost Estimation (Monthly)**

### **Development/Testing**
- Alchemy: Free
- Para: Contact for pricing
- PostgreSQL: Free (local) or $5-10 (cloud)
- Jitsi: Free (public)
- **Total: ~$5-15/month**

### **Production (1000 users)**
- Alchemy: Free - $49/month
- Para: Contact for pricing
- PostgreSQL: $20-50/month
- Jitsi: $20-100/month (self-hosted)
- Lit Protocol: $10-50/month
- **Total: ~$100-300/month**

## **🔧 Environment Configuration**

Create `.env` file in backend directory:

```bash
# Copy from .env.example
cp .env.example .env

# Edit with your actual values
nano .env
```

## **🧪 Testing Configuration**

For development, you can use these test values:

```bash
# Use testnet values
ETH_WSS_ENDPOINT=wss://eth-sepolia.g.alchemy.com/v2/demo
ETH_HTTP_ENDPOINT=https://eth-sepolia.g.alchemy.com/v2/demo
AUCTION_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
PLATFORM_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001

# Use public Jitsi
JITSI_DOMAIN=meet.jit.si
JITSI_APP_ID=meeting-auction-app
# JITSI_SECRET= (leave empty for public)

# Use local database
DATABASE_URL=postgresql://localhost:5432/meeting_auction_dev
```

## **🚨 Security Best Practices**

1. **Never commit API keys to git**
2. **Use different keys for dev/staging/prod**
3. **Rotate keys regularly**
4. **Use environment-specific .env files**
5. **Restrict API key permissions**
6. **Monitor API usage and costs**
7. **Keep private keys in secure key management**

## **📞 Support Contacts**

- **Alchemy**: https://docs.alchemy.com/reference/api-overview
- **Para**: https://docs.getpara.com
- **Lit Protocol**: https://developer.litprotocol.com
- **Jitsi**: https://jitsi.github.io/handbook/
# Jitsi Configuration
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd
JITSI_SECRET=your-jitsi-jwt-secret
JITSIPUBLIKKEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAksAohFbVIBq6ueolTGny/u9+89xbVgoud4XXfOemSWSRW4aGUH+aNilnP6LylY0DRIz7whTwqCPdPsf88I3GCDpodEFbqw0lgvVbUxAQOH0tdB1nPnQUc0yZnzpZEVZbNZjBJdh6j5gdU7q+NIOfLMDk8O5N2JpyknxghN3rHHHFGcFGMPCx2ToGHIVlmxEn31C4GDrtcBxq/B/0XJ/WyjbT9epbl1AFPWP8bqySqhfsfoAF8Zyecb2FJkS0bZO/3Sy2yiVXqBf934LkYRJQN130FDnu+HFoJU2n1xg4btCsSA8HxWgwM2069qdht0jJ81zukrt8D8wO4/C/Cwj67QIDAQAB
JITSI_PRIVATE_KEY=MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCSwCiEVtUgGrq56iVMafL+737z3FtWCi53hdd856ZJZJFbhoZQf5o2KWc/ovKVjQNEjPvCFPCoI90+x/zwjcYIOmh0QVurDSWC9VtTEBA4fS10HWc+dBRzTJmfOlkRVls1mMEl2HqPmB1Tur40g58swOTw7k3YmnKSfGCE3escccUZwUYw8LHZOgYchWWbESffULgYOu1wHGr8H/Rcn9bKNtP16luXUAU9Y/xurJKqF+x+gAXxnJ5xvYUmRLRtk7/dLLbKJVeoF/3fguRhElA3XfQUOe74cWglTafXGDhu0KxIDwfFaDAzbTr2p2G3SMnzXO6Su3wPzA7j8L8LCPrtAgMBAAECggEALxcmaUEL5t9s59ew3FJrPU9Q56PgUz21J3l1aolTHN3+nuYOF6q6q4KhtRPuz/qN/+NVrjPV/b50cn7uNarozx8fAZ8vcTYowVtGUOMosVfJzCbbSHkrTsxXx3aLujqBzjMUV7adrZJcZs/X1TYfT9ceIAn4RPdaqJLszfYASgHi9nDbcKKrTteyc26mHjhN4pfUkDT0p0VBIBTNjQyatPFzJNDAjwoS1eZieGnZecr6mdXSPksWEZU3YKbNW4iEXGtwRC2jVZxdJ59hBuG1kOlwOyrx2Q/kJAEqvBUEwqVPvTYlQIioHKMC/cMZtrDp3IwOIVJpmVsb1yAjPzZU6QKBgQDWzgA2n0Hu6MZaxRsqqsFw35MmgThHHFucXK4T8+2LAxhWLAf0iM2slLBgBNyyCMFyoVEjX74UFTOsQf0AHNCL930ZTu4TVbNjztOZNa5kYzZEJNEzDciofTRC8b1gXmXzInoQuovCVvX/px9l/j4EFCeT20A0UHdgN15ASknqVwKBgQCu5P27oTCZra6xagz9Z8Xdk6WfUheZ7qUF+EKyvMMMlKXIL/HeuHyHc+FBbAYMjhlKEANHs9Dm91cS4sr0V4IHgLNU7zPEV9mmHd+106+6z/SL3wKENmc+KR40pqRiLx3VVVN+FRZp8zc66WXbOSTdhMNuLUk819a5mkndr8ICWwKBgDbRaaKG8BedVgmSJcW0wBsjI3V/IrKbHRIBYPd8l9GTH6HWKM2SIBL7+yr18rCIpX2wh3lklKihZIeAa6WctOgTZ9yOlRlgFKDTBpMh7Ph3jUDEuJKz4NKG6VBwSukODiyHTul4AfS9ppfwuYWY5ZC66ALGwFLZei2W07nKe6SPAoGAO8JAtHDCQ3BmBXbgE2H26Nv/Nm39ZHp3Zo/KcnovB0hvUPSY52oQGtRMfmcjtfyDxZutEz3svk57MRfPEygnZNrj67yD6q29z5Xbj6xSGjneLEC6AmT4Z/PyvzjFaEsDHZa3HZik/PS+xWFkjUB8STiI8keFA8YYN3jxjk70sosCgYAChUM60AIT1fmgNDTFA1o3gXJ5xQeWRtmTXKvEImKbHRmbplChpT8zwa7uBX85jYj+TV+WfdBUMcvLOXD3im0W5M1doZffL1AogwGnTwNZi7qjE9aWJg/QgK7/tA4uNrTyn7dgQo9CLkTWMzT57mb3DxNkFw4xpuDu0w2Rl7Hbbw==
CONTRACT_ADDRESS=0xceBD87246e91C7D70C82D5aE5C196a0028543933
JITSI_KID=vpaas-magic-cookie-12e00659b2b144eebab8e26c218191dd/a521af
