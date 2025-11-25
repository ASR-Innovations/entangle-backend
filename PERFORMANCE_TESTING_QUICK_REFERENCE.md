# Performance Testing Quick Reference

## Quick Start

```bash
# 1. Ensure server is running
npm start

# 2. Run performance tests (in another terminal)
npm run test:performance
```

## Test Categories

### 📊 Database Tests (6 tests)
- Single order query (100 iterations)
- Bulk queries (100 orders)
- Large dataset (1000 orders)
- Concurrent queries (100 simultaneous)
- Complex joins
- Index effectiveness

### 🔌 WebSocket Tests (3 tests)
- Connection performance (50 clients)
- Broadcast performance (20 clients)
- Scalability (10, 25, 50 clients)

### ⏰ Cron Job Tests (2 tests)
- Cleanup performance (100 orders)
- Cleanup scalability (100, 500, 1000 orders)

### 🔧 Optimization Analysis
- Slow query identification
- Missing index detection
- Table statistics
- Recommendations

## Performance Thresholds

| Test | Threshold | Status |
|------|-----------|--------|
| Single Query | < 100ms | ⚡ Fast |
| Bulk Query | < 500ms | ✅ Good |
| Large Dataset | < 1000ms | 📊 Acceptable |
| Cron Job | < 5000ms | ⏰ Reasonable |
| WebSocket Connect | < 200ms | 🔌 Real-time |
| WebSocket Broadcast | < 500ms | 📡 Good |

## Common Commands

```bash
# Run full performance suite
npm run test:performance

# Check database indexes
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'seaport_orders';"

# Monitor active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check table size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_total_relation_size('seaport_orders'));"
```

## Quick Fixes

### Slow Database Queries
```sql
-- Analyze table
ANALYZE seaport_orders;

-- Reindex
REINDEX TABLE seaport_orders;
```

### WebSocket Issues
```javascript
// Check connection count
io.engine.clientsCount

// Monitor events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});
```

### Cron Job Slow
```javascript
// Check last execution
const stats = await cleanupService.getCleanupStats();
console.log(stats);
```

## Expected Results

### ✅ Good Performance
- All tests pass thresholds
- Indexes are used
- No slow queries
- Minimal recommendations

### ⚠️ Needs Optimization
- Some tests fail
- Missing indexes
- Slow queries identified
- Multiple recommendations

### ❌ Performance Issues
- Many tests fail
- No index usage
- Very slow queries
- Critical recommendations

## Optimization Priority

1. **HIGH**: Failed database tests
   - Add missing indexes
   - Optimize slow queries
   - Review connection pool

2. **MEDIUM**: Failed WebSocket tests
   - Implement Redis adapter
   - Use room-based broadcasting
   - Connection pooling

3. **LOW**: General improvements
   - Query caching
   - Monitoring setup
   - Documentation

## Monitoring in Production

```javascript
// Database query time
const start = Date.now();
const result = await pool.query(query);
const duration = Date.now() - start;
if (duration > 100) logger.warn('Slow query', { duration, query });

// WebSocket connections
setInterval(() => {
  const count = io.engine.clientsCount;
  logger.info('Active connections', { count });
}, 60000);

// Cron job execution
const start = Date.now();
await cleanupService.cleanupExpiredOrders();
const duration = Date.now() - start;
logger.info('Cleanup completed', { duration });
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests timeout | Increase timeout, check server |
| Inconsistent results | Run multiple times, check load |
| Memory errors | Reduce dataset size |
| Connection errors | Check database, verify server |
| Slow queries | Add indexes, optimize queries |

## Resources

- Full Guide: `PERFORMANCE_TESTING_GUIDE.md`
- Design Doc: `.kiro/specs/seaport-orderbook/design.md`
- Requirements: `.kiro/specs/seaport-orderbook/requirements.md`

## Support

1. Check test logs for errors
2. Review optimization recommendations
3. Consult performance guide
4. Check database and server logs
