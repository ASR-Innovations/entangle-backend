# Seaport Orderbook Performance Testing Guide

## Overview

This guide describes the performance testing suite for the Seaport Orderbook backend integration. The tests validate database query performance, WebSocket scalability, and cron job efficiency.

## Test Coverage

### 1. Database Performance Tests

#### Test 1: Single Order Query Performance
- **Purpose**: Measure query performance for retrieving individual orders
- **Threshold**: < 100ms average
- **Method**: 100 iterations of `getOrderByHash()`
- **Metrics**: Average, min, max query time

#### Test 2: Bulk Order Queries
- **Purpose**: Test performance with 100 orders
- **Threshold**: < 500ms
- **Method**: Create 100 orders, query marketplace
- **Metrics**: Query duration, orders retrieved

#### Test 3: Large Dataset Queries
- **Purpose**: Test performance with 1000 orders
- **Threshold**: < 1000ms per query
- **Tests**:
  - Get all marketplace orders
  - Get listings only
  - Get offers only
  - Get offers for token (sorted by price)
- **Metrics**: Query duration for each pattern

#### Test 4: Concurrent Query Performance
- **Purpose**: Test database under concurrent load
- **Threshold**: < 100ms average per query
- **Method**: 100 simultaneous queries
- **Metrics**: Total duration, average per query

#### Test 5: Complex Join Queries
- **Purpose**: Test queries with multiple table joins
- **Threshold**: < 100ms
- **Method**: Query orders with fulfillments and events
- **Metrics**: Query duration

#### Test 6: Index Effectiveness
- **Purpose**: Verify indexes are being used
- **Method**: EXPLAIN analysis on key queries
- **Metrics**: Index usage confirmation

### 2. WebSocket Performance Tests

#### Test 7: WebSocket Connection Performance
- **Purpose**: Measure connection establishment time
- **Threshold**: < 200ms average
- **Method**: Connect 50 clients simultaneously
- **Metrics**: Average and max connection time

#### Test 8: WebSocket Broadcast Performance
- **Purpose**: Test message broadcast efficiency
- **Threshold**: < 500ms
- **Method**: Broadcast to 20 connected clients
- **Metrics**: Broadcast duration, messages received

#### Test 9: WebSocket Scalability
- **Purpose**: Test scalability with varying client counts
- **Method**: Test with 10, 25, and 50 clients
- **Metrics**: Connection time per client count

### 3. Cron Job Performance Tests

#### Test 10: Cleanup Cron Job Performance
- **Purpose**: Measure cleanup job execution time
- **Threshold**: < 5000ms
- **Method**: Cleanup 100 expired orders
- **Metrics**: Duration, orders cleaned

#### Test 11: Cleanup Cron Job Scalability
- **Purpose**: Test cleanup with varying dataset sizes
- **Method**: Test with 100, 500, and 1000 expired orders
- **Metrics**: Duration per dataset size

### 4. Optimization Analysis

#### Slow Query Analysis
- Identifies queries with high execution time
- Requires `pg_stat_statements` extension

#### Missing Index Analysis
- Checks for recommended indexes
- Compares against design document specifications

#### Table Statistics
- Table and index sizes
- Row counts and distribution
- Active vs inactive orders

#### Optimization Recommendations
- Prioritized recommendations based on test results
- Specific suggestions for failed tests
- General best practices

## Running the Tests

### Prerequisites

1. **Database Setup**
   ```bash
   # Ensure database is running and migrations are applied
   npm run migrate
   ```

2. **Server Running**
   ```bash
   # Start the server in a separate terminal
   npm start
   ```

3. **Environment Variables**
   ```bash
   # Required variables in .env
   DATABASE_URL=postgresql://...
   SERVER_URL=http://localhost:3000
   NFT_CONTRACT_ADDRESS=0x...
   ```

### Execute Tests

```bash
# Run the complete performance test suite
node test-seaport-performance.js
```

### Test Duration

- **Estimated time**: 10-15 minutes
- **Database tests**: 5-8 minutes
- **WebSocket tests**: 2-3 minutes
- **Cron tests**: 2-3 minutes
- **Analysis**: 1 minute

## Performance Thresholds

| Test Category | Threshold | Rationale |
|--------------|-----------|-----------|
| Single Query | < 100ms | Fast user experience |
| Bulk Query | < 500ms | Acceptable for list views |
| Large Dataset | < 1000ms | Reasonable for complex queries |
| Cron Job | < 5000ms | Runs every 5 minutes |
| WebSocket Connection | < 200ms | Real-time feel |
| WebSocket Broadcast | < 500ms | Acceptable latency |

## Interpreting Results

### Success Criteria

- ✅ **All tests pass**: System meets performance requirements
- ⚠️ **Some tests fail**: Review optimization recommendations
- ❌ **Many tests fail**: Significant performance issues

### Common Issues and Solutions

#### Slow Database Queries

**Symptoms**: Database tests failing thresholds

**Solutions**:
1. Verify all indexes are created
2. Run `ANALYZE` on tables
3. Check database configuration
4. Review connection pool settings
5. Consider query result caching

#### WebSocket Performance Issues

**Symptoms**: WebSocket tests failing thresholds

**Solutions**:
1. Implement Redis adapter for Socket.IO
2. Use room-based broadcasting
3. Implement connection pooling
4. Review server resources
5. Consider horizontal scaling

#### Cron Job Slowness

**Symptoms**: Cleanup tests exceeding thresholds

**Solutions**:
1. Optimize cleanup query
2. Add batch processing
3. Implement pagination
4. Run during off-peak hours
5. Add monitoring and alerting

## Optimization Recommendations

### Database Optimizations

1. **Connection Pooling**
   ```javascript
   // Already configured in src/config/database.js
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000
   });
   ```

2. **Query Result Caching**
   ```javascript
   // Consider implementing Redis caching
   const cachedResult = await redis.get(cacheKey);
   if (cachedResult) return JSON.parse(cachedResult);
   ```

3. **Index Maintenance**
   ```sql
   -- Run periodically
   ANALYZE seaport_orders;
   REINDEX TABLE seaport_orders;
   ```

### WebSocket Optimizations

1. **Redis Adapter**
   ```javascript
   const { createAdapter } = require('@socket.io/redis-adapter');
   io.adapter(createAdapter(redisClient, redisClient.duplicate()));
   ```

2. **Room-Based Broadcasting**
   ```javascript
   // Broadcast only to relevant clients
   io.to(`nft:${tokenId}`).emit('order:created', data);
   ```

### Cron Job Optimizations

1. **Batch Processing**
   ```javascript
   // Process in batches of 100
   const batchSize = 100;
   for (let offset = 0; offset < total; offset += batchSize) {
     await cleanupBatch(offset, batchSize);
   }
   ```

2. **Monitoring**
   ```javascript
   // Add performance monitoring
   const duration = Date.now() - start;
   if (duration > threshold) {
     logger.warn('Cleanup job exceeded threshold', { duration });
   }
   ```

## Continuous Performance Testing

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [push, pull_request]
jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Database
        run: docker-compose up -d postgres
      - name: Run Performance Tests
        run: npm run test:performance
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: performance-results.json
```

### Monitoring in Production

1. **Database Query Monitoring**
   - Enable `pg_stat_statements`
   - Set up slow query logging
   - Monitor query execution times

2. **WebSocket Monitoring**
   - Track connection counts
   - Monitor message throughput
   - Alert on connection failures

3. **Cron Job Monitoring**
   - Log execution times
   - Alert on failures
   - Track cleanup statistics

## Troubleshooting

### Tests Timing Out

**Issue**: Tests fail with timeout errors

**Solutions**:
- Increase timeout values in test configuration
- Check database connectivity
- Verify server is running
- Review system resources

### Inconsistent Results

**Issue**: Test results vary significantly between runs

**Solutions**:
- Run tests multiple times
- Check for background processes
- Verify database is not under load
- Review system resource availability

### Memory Issues

**Issue**: Tests fail with out-of-memory errors

**Solutions**:
- Reduce test dataset sizes
- Implement cleanup between tests
- Check for memory leaks
- Increase Node.js memory limit

## Best Practices

1. **Run tests in isolation**: Avoid running other processes during tests
2. **Use consistent environment**: Test on similar hardware to production
3. **Baseline measurements**: Establish baseline before optimizations
4. **Regular testing**: Run performance tests regularly to catch regressions
5. **Document changes**: Track performance impact of code changes

## Support

For issues or questions:
- Review test logs for detailed error messages
- Check database and server logs
- Consult optimization recommendations
- Review design document for requirements

## References

- [Design Document](.kiro/specs/seaport-orderbook/design.md)
- [Requirements Document](.kiro/specs/seaport-orderbook/requirements.md)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Socket.IO Performance](https://socket.io/docs/v4/performance-tuning/)
