# Platform Fee Integration - Quick Reference

## Configuration

```bash
# Enable platform fees
PLATFORM_FEE_RECIPIENT=0x1234567890123456789012345678901234567890
PLATFORM_FEE_BASIS_POINTS=250  # 2.5%

# Disable platform fees
# PLATFORM_FEE_RECIPIENT=0x1234567890123456789012345678901234567890
```

## Fee Calculation

```javascript
// Formula
platformFee = (price × basisPoints) / 10,000

// Examples
250 basis points = 2.5%
100 basis points = 1.0%
500 basis points = 5.0%
```

## Frontend Integration

```javascript
// 1. Calculate platform fee
const price = ethers.parseEther("1.0"); // 1 ETH
const basisPoints = 250; // 2.5%
const platformFee = (price * BigInt(basisPoints)) / 10000n;

// 2. Include in order consideration
const orderComponents = {
  consideration: [
    // Payment to seller
    {
      itemType: 0,
      token: paymentTokenAddress,
      startAmount: price.toString(),
      endAmount: price.toString(),
      recipient: sellerAddress
    },
    // Platform fee
    {
      itemType: 0,
      token: paymentTokenAddress,
      startAmount: platformFee.toString(),
      endAmount: platformFee.toString(),
      recipient: process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
    }
  ]
};

// 3. Send to backend
await fetch('/api/orders/listings/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ...orderData,
    platformFeeAmount: platformFee.toString(),
    platformFeeRecipient: process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
  })
});
```

## Backend Validation

Automatic validation when:
- ✅ Order is created
- ✅ Order is fulfilled

No additional code needed!

## Testing

```bash
# Run platform fee tests
node test-platform-fee-validation.js

# Expected: ✅ ALL TESTS PASSED
```

## Common Issues

### Issue: "Platform fee must be included in consideration items"
**Solution:** Add platform fee item to consideration array

### Issue: "Platform fee recipient must be X"
**Solution:** Use correct recipient address from environment variable

### Issue: "Platform fee amount incorrect"
**Solution:** Recalculate fee using correct formula: `(price × basisPoints) / 10,000`

## API Response

Orders include platform fee information:

```json
{
  "orderHash": "0x...",
  "price": "1000000000000000000",
  "platformFeeAmount": "25000000000000000",
  "platformFeeRecipient": "0x1234...",
  ...
}
```

## Disabling Platform Fees

Comment out `PLATFORM_FEE_RECIPIENT`:

```bash
# PLATFORM_FEE_RECIPIENT=0x1234567890123456789012345678901234567890
```

Orders without platform fees will be accepted.

---

**For full documentation, see:** `PLATFORM_FEE_IMPLEMENTATION_SUMMARY.md`
