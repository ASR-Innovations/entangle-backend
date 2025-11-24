# Seaport Orderbook Configuration Guide

This document describes all environment variables required for the Seaport orderbook backend integration.

## Overview

The Seaport orderbook integration requires several environment variables to function correctly. These variables control contract addresses, blockchain connections, cron job schedules, and platform fee settings.

## Required Variables

### SEAPORT_CONTRACT_ADDRESS

**Description:** Address of the Seaport protocol smart contract.

**Required:** Yes

**Format:** Ethereum address (0x followed by 40 hexadecimal characters)

**Example:**
```bash
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
```

**Networks:**
- Avalanche Fuji Testnet: `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC`
- Avalanche Mainnet: `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC`

**Requirements:** 1.1, 2.1, 2.2, 6.1

---

### SEAPORT_CHAIN_ID

**Description:** Chain ID of the blockchain network for EIP-712 signature verification.

**Required:** Yes

**Format:** Positive integer

**Example:**
```bash
SEAPORT_CHAIN_ID=43113
```

**Networks:**
- Avalanche Fuji Testnet: `43113`
- Avalanche Mainnet: `43114`

**Requirements:** 2.1, 2.2

---

## Optional Variables

### WS_RPC_URL

**Description:** WebSocket RPC endpoint for listening to blockchain events in real-time.

**Required:** No (but recommended if `ENABLE_ORDER_MONITORING=true`)

**Format:** WebSocket URL (ws:// or wss://)

**Example:**
```bash
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
```

**Networks:**
- Avalanche Fuji Testnet: `wss://api.avax-test.network/ext/bc/C/ws`
- Avalanche Mainnet: `wss://api.avax.network/ext/bc/C/ws`

**Note:** Required for the OrderFulfillmentMonitorService to detect on-chain order fulfillments.

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5

---

### ENABLE_ORDER_MONITORING

**Description:** Enable or disable blockchain event monitoring for order fulfillments.

**Required:** No

**Format:** Boolean string (`true` or `false`)

**Default:** `true`

**Example:**
```bash
ENABLE_ORDER_MONITORING=true
```

**Note:** Set to `false` to disable the OrderFulfillmentMonitorService. Useful for development or when blockchain monitoring is not needed.

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5

---

### ORDER_CLEANUP_CRON_SCHEDULE

**Description:** Cron schedule expression for the expired order cleanup job.

**Required:** No

**Format:** Standard cron expression (5 parts: minute hour day month weekday)

**Default:** `*/5 * * * *` (every 5 minutes)

**Examples:**
```bash
# Every 5 minutes (default)
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *

# Every 10 minutes
ORDER_CLEANUP_CRON_SCHEDULE=*/10 * * * *

# Every hour
ORDER_CLEANUP_CRON_SCHEDULE=0 * * * *

# Every day at midnight
ORDER_CLEANUP_CRON_SCHEDULE=0 0 * * *
```

**Requirements:** 7.1, 7.2, 7.3, 7.4, 7.5

---

### PLATFORM_FEE_RECIPIENT

**Description:** Wallet address that receives platform fees from order fulfillments.

**Required:** No

**Format:** Ethereum address (0x followed by 40 hexadecimal characters)

**Example:**
```bash
PLATFORM_FEE_RECIPIENT=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Note:** 
- If not set, platform fee validation is disabled
- When set, all orders must include the platform fee in their consideration items
- The fee amount is calculated using `PLATFORM_FEE_BASIS_POINTS`

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5

---

### PLATFORM_FEE_BASIS_POINTS

**Description:** Platform fee as basis points (1 basis point = 0.01%).

**Required:** No (but recommended if `PLATFORM_FEE_RECIPIENT` is set)

**Format:** Integer between 0 and 10000

**Default:** `250` (2.5%)

**Examples:**
```bash
# 1% fee
PLATFORM_FEE_BASIS_POINTS=100

# 2.5% fee (default)
PLATFORM_FEE_BASIS_POINTS=250

# 5% fee
PLATFORM_FEE_BASIS_POINTS=500

# 10% fee
PLATFORM_FEE_BASIS_POINTS=1000
```

**Conversion Table:**
| Basis Points | Percentage |
|--------------|------------|
| 100          | 1%         |
| 250          | 2.5%       |
| 500          | 5%         |
| 1000         | 10%        |

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5

---

## Configuration Validation

The server validates all Seaport configuration variables on startup. If validation fails, the server will not start and will display detailed error messages.

### Validation Rules

1. **SEAPORT_CONTRACT_ADDRESS**: Must be a valid Ethereum address
2. **SEAPORT_CHAIN_ID**: Must be a positive integer
3. **WS_RPC_URL**: Must be a valid WebSocket URL (if monitoring is enabled)
4. **ORDER_CLEANUP_CRON_SCHEDULE**: Must be a valid cron expression (5 parts)
5. **PLATFORM_FEE_RECIPIENT**: Must be a valid Ethereum address (if set)
6. **PLATFORM_FEE_BASIS_POINTS**: Must be between 0 and 10000

### Validation Output

On successful validation, you'll see:
```
✅ Seaport configuration validated successfully
📋 Seaport Configuration:
   - Contract Address: 0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
   - Chain ID: 43113
   - WebSocket RPC: wss://api.avax-test.network/ext/bc/C/ws
   - Order Monitoring: enabled
   - Cleanup Schedule: */5 * * * *
   - Platform Fee Recipient: not configured
   - Platform Fee: 250 basis points (2.50%)
```

On validation failure, you'll see:
```
❌ Configuration error: SEAPORT_CONTRACT_ADDRESS is required
❌ Configuration error: SEAPORT_CHAIN_ID is required
Error: Seaport configuration validation failed
```

---

## Example Configurations

### Development (Fuji Testnet)

```bash
# Seaport Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43113

# WebSocket Configuration
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
ENABLE_ORDER_MONITORING=true

# Cron Configuration
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *

# Platform Fee Configuration (optional)
# PLATFORM_FEE_RECIPIENT=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
PLATFORM_FEE_BASIS_POINTS=250
```

### Production (Avalanche Mainnet)

```bash
# Seaport Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43114

# WebSocket Configuration
WS_RPC_URL=wss://api.avax.network/ext/bc/C/ws
ENABLE_ORDER_MONITORING=true

# Cron Configuration
ORDER_CLEANUP_CRON_SCHEDULE=*/10 * * * *

# Platform Fee Configuration
PLATFORM_FEE_RECIPIENT=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
PLATFORM_FEE_BASIS_POINTS=250
```

### Testing (No Blockchain Monitoring)

```bash
# Seaport Configuration
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43113

# Disable monitoring for testing
ENABLE_ORDER_MONITORING=false

# Cron Configuration
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *

# No platform fee
PLATFORM_FEE_BASIS_POINTS=250
```

---

## Troubleshooting

### Error: "SEAPORT_CONTRACT_ADDRESS is required"

**Solution:** Add the Seaport contract address to your `.env` file:
```bash
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
```

### Error: "SEAPORT_CHAIN_ID is required"

**Solution:** Add the chain ID to your `.env` file:
```bash
SEAPORT_CHAIN_ID=43113
```

### Warning: "WS_RPC_URL is not set - order fulfillment monitoring will be disabled"

**Solution:** Add a WebSocket RPC URL to enable blockchain monitoring:
```bash
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
```

Or disable monitoring explicitly:
```bash
ENABLE_ORDER_MONITORING=false
```

### Error: "WS_RPC_URL must be a valid WebSocket URL"

**Solution:** Ensure the URL starts with `ws://` or `wss://`:
```bash
# Correct
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws

# Incorrect
WS_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

### Error: "PLATFORM_FEE_BASIS_POINTS must be a number between 0 and 10000"

**Solution:** Use a valid basis points value:
```bash
# Correct (2.5%)
PLATFORM_FEE_BASIS_POINTS=250

# Incorrect
PLATFORM_FEE_BASIS_POINTS=25000
```

---

## Related Documentation

- [Seaport Protocol Documentation](https://docs.opensea.io/reference/seaport-overview)
- [EIP-712 Typed Data Signing](https://eips.ethereum.org/EIPS/eip-712)
- [Cron Expression Format](https://crontab.guru/)
- [Backend Architecture](./BACKEND_ARCHITECTURE.md)
- [Seaport Orderbook Integration](./SEAPORT_ORDERBOOK_BACKEND_INTEGRATION.md)

---

## Support

For issues or questions about Seaport configuration:
1. Check the validation output on server startup
2. Review this documentation
3. Check the `.env.example` file for reference values
4. Review the requirements document at `.kiro/specs/seaport-orderbook/requirements.md`
