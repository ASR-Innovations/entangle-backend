const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/config/database');

describe('Auction Endpoints', () => {
  let authToken;
  let creatorToken;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create test users
    const creatorAuth = await createTestCreator();
    const bidderAuth = await createTestBidder();
    
    creatorToken = creatorAuth.token;
    authToken = bidderAuth.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/auctions/create', () => {
    it('should create auction for authenticated creator', async () => {
      const auctionData = {
        title: 'Test Auction',
        description: 'Test description',
        duration: 60,
        reservePrice: '0.1',
        meetingDuration: 60
      };

      const response = await request(app)
        .post('/api/auctions/create')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send(auctionData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.auctionId).toBeDefined();
    });

    it('should reject auction creation for non-creator', async () => {
      const auctionData = {
        title: 'Test Auction',
        duration: 60,
        reservePrice: '0.1'
      };

      const response = await request(app)
        .post('/api/auctions/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(auctionData);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/auctions/active', () => {
    it('should return active auctions', async () => {
      const response = await request(app)
        .get('/api/auctions/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.auctions)).toBe(true);
    });
  });
});

// Helper functions
async function setupTestDatabase() {
  // Create test tables
  await pool.query('CREATE TABLE IF NOT EXISTS test_users AS SELECT * FROM users WHERE 1=0');
  await pool.query('CREATE TABLE IF NOT EXISTS test_auctions AS SELECT * FROM auctions WHERE 1=0');
}

async function cleanupTestDatabase() {
  await pool.query('DROP TABLE IF EXISTS test_users');
  await pool.query('DROP TABLE IF EXISTS test_auctions');
}

async function createTestCreator() {
  // Create test creator logic
  return { token: 'test_creator_token' };
}

async function createTestBidder() {
  // Create test bidder logic
  return { token: 'test_bidder_token' };
}
