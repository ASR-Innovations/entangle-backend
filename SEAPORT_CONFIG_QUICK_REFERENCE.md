# Seaport Configuration Quick Reference

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SEAPORT_CONTRACT_ADDRESS` | Seaport protocol contract address | `0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC` |
| `SEAPORT_CHAIN_ID` | Blockchain chain ID | `43113` (Fuji) or `43114` (Mainnet) |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_RPC_URL` | - | WebSocket RPC endpoint for blockchain events |
| `ENABLE_ORDER_MONITORING` | `true` | Enable/disable order fulfillment monitoring |
| `ORDER_CLEANUP_CRON_SCHEDULE` | `*/5 * * * *` | Cron schedule for expired order cleanup |
| `PLATFORM_FEE_RECIPIENT` | - | Wallet address for platform fees (optional) |
| `PLATFORM_FEE_BASIS_POINTS` | `250` | Platform fee in basis points (2.5%) |

## Quick Setup

### Fuji Testnet
```bash
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43113
WS_RPC_URL=wss://api.avax-test.network/ext/bc/C/ws
ENABLE_ORDER_MONITORING=true
ORDER_CLEANUP_CRON_SCHEDULE=*/5 * * * *
PLATFORM_FEE_BASIS_POINTS=250
```

### Avalanche Mainnet
```bash
SEAPORT_CONTRACT_ADDRESS=0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC
SEAPORT_CHAIN_ID=43114
WS_RPC_URL=wss://api.avax.network/ext/bc/C/ws
ENABLE_ORDER_MONITORING=true
ORDER_CLEANUP_CRON_SCHEDULE=*/10 * * * *
PLATFORM_FEE_RECIPIENT=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
PLATFORM_FEE_BASIS_POINTS=250
```

## Validation

Configuration is validated on server startup. Check logs for:
- ✅ Success: "Seaport configuration validated successfully"
- ❌ Error: "Configuration error: [details]"
- ⚠️ Warning: "Configuration warning: [details]"

## Common Issues

| Error | Solution |
|-------|----------|
| "SEAPORT_CONTRACT_ADDRESS is required" | Add contract address to .env |
| "SEAPORT_CHAIN_ID is required" | Add chain ID to .env |
| "WS_RPC_URL must be a valid WebSocket URL" | Use wss:// or ws:// prefix |
| "PLATFORM_FEE_BASIS_POINTS must be between 0 and 10000" | Use valid basis points (0-10000) |

## Testing Configuration

Run validation test:
```bash
node test-seaport-config-validation.js
```

Test server startup:
```bash
node -e "require('dotenv').config(); require('./src/config/seaportConfig').validateAndLogConfig()"
```

## Documentation

- Full documentation: [SEAPORT_CONFIGURATION.md](./SEAPORT_CONFIGURATION.md)
- Design document: [.kiro/specs/seaport-orderbook/design.md](./.kiro/specs/seaport-orderbook/design.md)
- Requirements: [.kiro/specs/seaport-orderbook/requirements.md](./.kiro/specs/seaport-orderbook/requirements.md)
