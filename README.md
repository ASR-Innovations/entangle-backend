# Meeting Auction Backend - Para Integration

A comprehensive backend system for managing meeting auctions with Para wallet authentication and blockchain integration.

## Features

- **Para Wallet Authentication**: Seamless social login integration
- **Blockchain Integration**: Automated auction management on Ethereum/Sepolia
- **Real-time Updates**: WebSocket integration for live auction updates
- **Meeting Management**: Jitsi integration for video meetings
- **NFT Management**: Automated NFT creation and burning for meeting access
- **Cron Jobs**: Automated auction ending and cleanup

## System Architecture

### Authentication Flow
1. **Frontend**: User clicks "Login with Para" → Para handles social login
2. **Backend**: Receives verification token → Verifies with Para API → Issues JWT
3. **Session Management**: Para session import for wallet operations

### Auction Flow
1. **Creation**: Frontend creates auction on blockchain → Backend records transaction
2. **Bidding**: Frontend handles all bidding (Para wallet integration)
3. **Ending**: Backend cron job automatically ends expired auctions
4. **Meeting**: Backend creates Jitsi room → Issues access tokens

### Meeting Access
1. **NFT Verification**: Winner proves NFT ownership via Lit Protocol
2. **Access Grant**: Backend verifies and grants meeting access
3. **Room Management**: Jitsi integration for video meetings

## Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Core Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://localhost:5432/meeting_auction
REDIS_URL=redis://localhost:6379

# Blockchain
ETH_WSS_ENDPOINT=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETH_HTTP_ENDPOINT=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
AUCTION_CONTRACT_ADDRESS=0x...
PLATFORM_PRIVATE_KEY=0x...

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Para Wallet
PARA_API_KEY=your-para-api-key
PARA_SECRET_API_KEY=your-para-secret-api-key
PARA_ENVIRONMENT=beta

# Lit Protocol
LIT_ACTION_IPFS_CID=your-lit-action-ipfs-cid
LIT_PKP_PUBLIC_KEY=0x...
LIT_NETWORK=serrano

# Jitsi Configuration
JITSI_DOMAIN=meet.jit.si
JITSI_APP_ID=meeting-auction-app
JITSI_SECRET=your-jitsi-jwt-secret

# Cron Configuration
AUCTION_CHECK_INTERVAL=*/1 * * * *
```

## Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   ```bash
   # Create PostgreSQL database
   createdb meeting_auction
   
   # Run migration
   npm run migrate
   ```

3. **Environment Configuration**:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/para-auth` - Para authentication
- `POST /api/auth/para-session` - Import Para session
- `GET /api/auth/verify` - Verify JWT token

### Auctions
- `POST /api/auctions/created` - Record auction creation
- `GET /api/auctions/active` - Get active auctions
- `GET /api/auctions/user/created` - Get user's auctions
- `GET /api/auctions/:id` - Get auction details

### Meetings
- `GET /api/meetings/auction/:id` - Get meeting by auction
- `POST /api/meetings/access/:id` - Access meeting with NFT
- `GET /api/meetings/user` - Get user's meetings
- `POST /api/meetings/:id/extend` - Extend meeting duration
- `POST /api/meetings/:id/close` - Close meeting

## Database Schema

### Core Tables
- **users**: Para user data and wallet addresses
- **auctions**: Auction information and blockchain data
- **meetings**: Meeting rooms and access tokens
- **meeting_access_logs**: Access tracking and NFT burns
- **notifications**: User notifications
- **lit_gate_passes**: Lit Protocol integration
- **para_sessions**: Para session caching

## Services

### ParaService
- Session verification and import
- Wallet ownership verification
- User data management

### Web3Service
- Blockchain event listening
- Automated auction ending
- NFT verification
- Meeting creation

### JitsiService
- Video room management
- Access token generation
- Room configuration

## Cron Jobs

### Auction Management
- **Schedule**: Every minute (configurable)
- **Function**: End expired auctions automatically
- **Command**: `npm run cron`

## Development

### Scripts
- `npm start` - Production server
- `npm run dev` - Development with nodemon
- `npm test` - Run tests
- `npm run migrate` - Database migration
- `npm run cron` - Start auction cron job

### Logging
- Winston-based logging system
- File and console output
- Structured JSON logging

### Error Handling
- Comprehensive error handling
- Development vs production error messages
- Detailed logging for debugging

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auction.test.js
```

## Deployment

### Production Considerations
- Set `NODE_ENV=production`
- Configure proper database URLs
- Set secure JWT secrets
- Enable SSL for database connections
- Configure proper logging levels

### Docker Support
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Troubleshooting

### Common Issues
1. **Para API Errors**: Check API keys and environment settings
2. **Database Connection**: Verify DATABASE_URL and PostgreSQL status
3. **Blockchain Connection**: Check Web3 provider endpoints
4. **JWT Issues**: Verify JWT_SECRET configuration

### Logs
- Check `logs/combined.log` for general logs
- Check `logs/error.log` for error details
- Console output in development mode

## Contributing

1. Follow the existing code structure
2. Add proper error handling and logging
3. Include tests for new features
4. Update documentation as needed

## License

This project is licensed under the MIT License.
