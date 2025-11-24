# Backend Order Verification Requirements

## Problem

The backend is rejecting orders with: `"Order hash does not match calculated hash"`

This happens because the backend is not correctly reconstructing the order components for EIP-712 hash verification.

## Root Cause

When the frontend sends order components to the backend:
1. Numeric fields (`startTime`, `endTime`, `counter`) are sent as **strings** (for JSON serialization)
2. The backend must convert these back to **numbers** before calculating the EIP-712 hash
3. The backend must use the **exact same EIP-712 domain and types** as the frontend

## Frontend Implementation

The frontend is correctly:
1. ✅ Checksumming all addresses using `ethers.getAddress()`
2. ✅ Signing with proper EIP-712 domain and types
3. ✅ Sending order components with string values for numeric fields

### Frontend EIP-712 Configuration

```typescript
// Domain
{
  name: 'Seaport',
  version: '1.6',
  chainId: 11155111, // Sepolia
  verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395'
}

// Types
{
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' }
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' }
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' }
  ]
}
```

## Backend Requirements

### 1. Parse Order Components from Request

The backend receives order components with these field types:

```typescript
{
  offerer: string,              // Checksummed address
  zone: string,                 // Checksummed address
  offer: OfferItem[],
  consideration: ConsiderationItem[],
  orderType: number,
  startTime: string,            // ← STRING (must convert to number)
  endTime: string,              // ← STRING (must convert to number)
  zoneHash: string,             // Hex string (0x...)
  salt: string,                 // Hex string (0x...)
  conduitKey: string,           // Hex string (0x...)
  counter: string               // ← STRING (must convert to number)
}
```

### 2. Convert to EIP-712 Format

Before calculating the hash, convert string fields to numbers:

```javascript
const orderComponentsForHashing = {
  offerer: orderComponents.offerer,           // Keep as-is (checksummed address)
  zone: orderComponents.zone,                 // Keep as-is (checksummed address)
  offer: orderComponents.offer,               // Keep as-is (already correct format)
  consideration: orderComponents.consideration, // Keep as-is (already correct format)
  orderType: orderComponents.orderType,       // Keep as-is (number)
  startTime: parseInt(orderComponents.startTime, 10),  // ← Convert to number
  endTime: parseInt(orderComponents.endTime, 10),      // ← Convert to number
  zoneHash: orderComponents.zoneHash,         // Keep as-is (hex string)
  salt: orderComponents.salt,                 // Keep as-is (hex string)
  conduitKey: orderComponents.conduitKey,     // Keep as-is (hex string)
  counter: parseInt(orderComponents.counter, 10)       // ← Convert to number
};
```

### 3. Calculate EIP-712 Hash

Use the exact same domain and types as the frontend:

```javascript
const ethers = require('ethers');

const domain = {
  name: 'Seaport',
  version: '1.6',
  chainId: 11155111, // Must match the network
  verifyingContract: '0x0000000000000068F116a894984e2DB1123eB395'
};

const types = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' }
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' }
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' }
  ]
};

// Calculate the hash
const calculatedOrderHash = ethers.TypedDataEncoder.hash(
  domain,
  types,
  orderComponentsForHashing
);
```

### 4. Verify Signature

```javascript
const recoveredAddress = ethers.verifyTypedData(
  domain,
  types,
  orderComponentsForHashing,
  signature
);

// Compare with expected offerer (case-insensitive)
const isValid = recoveredAddress.toLowerCase() === orderComponents.offerer.toLowerCase();
```

### 5. Verify Order Hash Matches

```javascript
if (calculatedOrderHash !== receivedOrderHash) {
  throw new Error('Order hash does not match calculated hash');
}

if (!isValid) {
  throw new Error('Invalid signature');
}
```

## Common Mistakes

### ❌ Wrong: Using string values for numeric fields in hash calculation
```javascript
// This will produce the WRONG hash
const orderHash = ethers.TypedDataEncoder.hash(domain, types, {
  ...orderComponents,
  startTime: "1234567890",  // ← WRONG: string instead of number
  endTime: "1234567890",
  counter: "0"
});
```

### ✅ Correct: Converting strings to numbers
```javascript
// This will produce the CORRECT hash
const orderHash = ethers.TypedDataEncoder.hash(domain, types, {
  ...orderComponents,
  startTime: parseInt(orderComponents.startTime, 10),  // ← CORRECT: number
  endTime: parseInt(orderComponents.endTime, 10),
  counter: parseInt(orderComponents.counter, 10)
});
```

### ❌ Wrong: Not using checksummed addresses
```javascript
// This will produce the WRONG hash
const orderHash = ethers.TypedDataEncoder.hash(domain, types, {
  ...orderComponents,
  offerer: orderComponents.offerer.toLowerCase()  // ← WRONG: lowercase
});
```

### ✅ Correct: Using checksummed addresses as received
```javascript
// This will produce the CORRECT hash
const orderHash = ethers.TypedDataEncoder.hash(domain, types, {
  ...orderComponents,
  offerer: orderComponents.offerer  // ← CORRECT: checksummed address from frontend
});
```

## Testing

To verify the backend is working correctly:

1. Log the received order components
2. Log the converted order components (after string→number conversion)
3. Log the calculated order hash
4. Log the received order hash
5. Compare them - they should match exactly

Example log output:
```
Received order components: {
  offerer: "0xab5F4A53287482F6e8118b7736dCa9c02704DaFD",
  startTime: "1732451234",
  endTime: "1732537634",
  counter: "0"
}

Converted for hashing: {
  offerer: "0xab5F4A53287482F6e8118b7736dCa9c02704DaFD",
  startTime: 1732451234,
  endTime: 1732537634,
  counter: 0
}

Calculated hash: 0x6137fdb4dc571cb37a6c6985c2a2df474bde8901390aaf81187bb62b0dd14484
Received hash:   0x6137fdb4dc571cb37a6c6985c2a2df474bde8901390aaf81187bb62b0dd14484
✅ Hashes match!
```

## Summary

The backend MUST:
1. ✅ Accept order components with string values for `startTime`, `endTime`, `counter`
2. ✅ Convert these strings to numbers before EIP-712 hash calculation
3. ✅ Use the exact same EIP-712 domain and types as the frontend
4. ✅ Preserve checksummed addresses exactly as received
5. ✅ Calculate the hash and verify it matches the received hash
6. ✅ Verify the signature recovers to the expected offerer address

If any of these steps are incorrect, the hash will not match and signature verification will fail.
