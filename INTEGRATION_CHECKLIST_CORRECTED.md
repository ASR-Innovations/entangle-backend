# Frontend Integration Checklist - CORRECTED

## ❌ Your Table Had Errors - Here's the Correct Version

### Issues in Your Table:
1. ❌ Wrong HTTP method: `PATCH` → Should be `POST` (fulfill) and `DELETE` (cancel)
2. ❌ Wrong path: `:hash` → Should be `:orderHash`

---

## ✅ CORRECTED INTEGRATION CHECKLIST

```
┌────────────────────────────────────────────────────────────┐
│                    FULL INTEGRATION                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CREATE (OFF-CHAIN) - NEW HOOKS ✅                      │
│     ✅ useCreateListing()                                   │
│        → POST /api/orders/listings/create                  │
│                                                             │
│     ✅ useCreateOffer()                                     │
│        → POST /api/orders/offers/create                    │
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  2. FULFILL (ON-CHAIN + OFF-CHAIN) - NEEDS UPDATE ⚠️       │
│                                                             │
│     marketplaceService.buyNow()                             │
│     ├─ Step 1: seaport.fulfillOrder() [ON-CHAIN] ✅        │
│     └─ Step 2: POST /api/orders/:orderHash/fulfill ❌      │
│                 ^^^^                   ^^^^^^^             │
│                 POST (not PATCH)       orderHash (not hash)│
│                                                             │
│     marketplaceService.acceptOffer()                        │
│     ├─ Step 1: seaport.fulfillOrder() [ON-CHAIN] ✅        │
│     └─ Step 2: POST /api/orders/:orderHash/fulfill ❌      │
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  3. CANCEL (ON-CHAIN + OFF-CHAIN) - NEEDS UPDATE ⚠️        │
│                                                             │
│     marketplaceService.cancelListing()                      │
│     ├─ Step 1: seaport.cancel() [ON-CHAIN] (optional) ✅   │
│     └─ Step 2: DELETE /api/orders/:orderHash/cancel ❌     │
│                 ^^^^^^                                      │
│                 DELETE (not PATCH)                          │
│                                                             │
│     marketplaceService.cancelOffer()                        │
│     ├─ Step 1: seaport.cancel() [ON-CHAIN] (optional) ✅   │
│     └─ Step 2: DELETE /api/orders/:orderHash/cancel ❌     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Exact Backend API Endpoints (From Verified Code)

### 1. Create Orders
```
✅ POST /api/orders/listings/create
   Body: { orderHash, orderComponents, signature, ... }
   Auth: Required (JWT)

✅ POST /api/orders/offers/create
   Body: { orderHash, orderComponents, signature, ... }
   Auth: Required (JWT)
```

### 2. Fulfill Orders
```
✅ POST /api/orders/:orderHash/fulfill
   ^^^^                ^^^^^^^^^
   POST not PATCH      orderHash not hash

   Body: {
     fulfiller: "0xBuyerAddress",
     transactionHash: "0xTxHash",
     blockNumber: 12345,
     amountPaid: "1000000000000000000", // optional
     platformFeePaid: "25000000000000000" // optional
   }
   Auth: Required (JWT)
```

### 3. Cancel Orders
```
✅ DELETE /api/orders/:orderHash/cancel
   ^^^^^^
   DELETE not PATCH

   Body: {
     reason: "User cancelled", // optional
     transactionHash: "0xTxHash" // optional if on-chain cancel
   }
   Auth: Required (JWT)
```

---

## 🔧 What You Need to Update in Your Frontend

### Current Code (Your Existing Implementation)

```typescript
// services/marketplaceService.ts

export const marketplaceService = {

  // ✅ WORKS - No backend integration needed
  async createListing(params) {
    const order = await seaport.createOrder(...);
    return order; // NOT SENT TO BACKEND
  },

  // ❌ INCOMPLETE - Missing backend call
  async buyNow(order) {
    // Step 1: On-chain fulfillment ✅
    const tx = await seaport.fulfillOrder(order);
    await tx.wait();

    // Step 2: MISSING - Need to notify backend ❌
    // Should call: POST /api/orders/:orderHash/fulfill

    return tx;
  },

  // ❌ INCOMPLETE - Missing backend call
  async acceptOffer(offer) {
    // Step 1: On-chain fulfillment ✅
    const tx = await seaport.fulfillOrder(offer);
    await tx.wait();

    // Step 2: MISSING - Need to notify backend ❌
    // Should call: POST /api/orders/:orderHash/fulfill

    return tx;
  },

  // ❌ INCOMPLETE - Missing backend call
  async cancelListing(orderHash) {
    // Step 1: On-chain cancel (optional) ✅
    const tx = await seaport.cancel(orderHash);
    await tx.wait();

    // Step 2: MISSING - Need to notify backend ❌
    // Should call: DELETE /api/orders/:orderHash/cancel

    return tx;
  },

  // ❌ INCOMPLETE - Missing backend call
  async cancelOffer(orderHash) {
    // Step 1: On-chain cancel (optional) ✅
    const tx = await seaport.cancel(orderHash);
    await tx.wait();

    // Step 2: MISSING - Need to notify backend ❌
    // Should call: DELETE /api/orders/:orderHash/cancel

    return tx;
  }
};
```

---

## ✅ UPDATED CODE (What It Should Look Like)

```typescript
// services/marketplaceService.ts
import axios from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5009';

// Add JWT token to requests
const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const marketplaceService = {

  // ✅ UPDATED - Now sends to backend
  async createListing(params) {
    // Step 1: Sign order with Seaport SDK
    const { executeAllActions } = await seaport.createOrder(params);
    const order = await executeAllActions();

    // Step 2: Calculate order hash
    const orderHash = seaport.getOrderHash(order.parameters);

    // Step 3: Send to backend ✅ NEW
    await api.post('/api/orders/listings/create', {
      orderHash,
      orderType: 'listing',
      orderComponents: order.parameters,
      signature: order.signature,
      // ... other required fields
    });

    return order;
  },

  // ✅ UPDATED - Now notifies backend
  async buyNow(order) {
    // Step 1: On-chain fulfillment ✅
    const { executeAllActions } = await seaport.fulfillOrder({
      order: {
        parameters: order.orderComponents,
        signature: order.signature,
      },
      accountAddress: buyerAddress,
    });

    const tx = await executeAllActions();
    const receipt = await tx.wait();

    // Step 2: Notify backend ✅ NEW
    await api.post(`/api/orders/${order.orderHash}/fulfill`, {
      fulfiller: buyerAddress,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });

    return receipt;
  },

  // ✅ UPDATED - Now notifies backend
  async acceptOffer(offer) {
    // Step 1: On-chain fulfillment ✅
    const { executeAllActions } = await seaport.fulfillOrder({
      order: {
        parameters: offer.orderComponents,
        signature: offer.signature,
      },
      accountAddress: sellerAddress,
    });

    const tx = await executeAllActions();
    const receipt = await tx.wait();

    // Step 2: Notify backend ✅ NEW
    await api.post(`/api/orders/${offer.orderHash}/fulfill`, {
      fulfiller: sellerAddress,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    });

    return receipt;
  },

  // ✅ UPDATED - Now notifies backend
  async cancelListing(orderHash) {
    // Step 1: On-chain cancel (optional) ✅
    // Note: Seaport allows off-chain cancellation by just removing from DB
    let txHash = null;

    if (onChainCancel) {
      const tx = await seaport.cancel(orderHash);
      const receipt = await tx.wait();
      txHash = receipt.transactionHash;
    }

    // Step 2: Notify backend ✅ NEW
    await api.delete(`/api/orders/${orderHash}/cancel`, {
      data: {
        reason: 'User cancelled listing',
        transactionHash: txHash,
      },
    });

    return { success: true };
  },

  // ✅ UPDATED - Now notifies backend
  async cancelOffer(orderHash) {
    // Step 1: On-chain cancel (optional) ✅
    let txHash = null;

    if (onChainCancel) {
      const tx = await seaport.cancel(orderHash);
      const receipt = await tx.wait();
      txHash = receipt.transactionHash;
    }

    // Step 2: Notify backend ✅ NEW
    await api.delete(`/api/orders/${orderHash}/cancel`, {
      data: {
        reason: 'User cancelled offer',
        transactionHash: txHash,
      },
    });

    return { success: true };
  }
};
```

---

## 📊 Summary of Changes Needed

| Function | Current State | What to Add |
|----------|--------------|-------------|
| `createListing()` | ✅ Signs order | ➕ `POST /api/orders/listings/create` |
| `createOffer()` | ✅ Signs order | ➕ `POST /api/orders/offers/create` |
| `buyNow()` | ✅ On-chain fulfill | ➕ `POST /api/orders/:orderHash/fulfill` |
| `acceptOffer()` | ✅ On-chain fulfill | ➕ `POST /api/orders/:orderHash/fulfill` |
| `cancelListing()` | ✅ On-chain cancel | ➕ `DELETE /api/orders/:orderHash/cancel` |
| `cancelOffer()` | ✅ On-chain cancel | ➕ `DELETE /api/orders/:orderHash/cancel` |

---

## ⚠️ Important Notes

### 1. HTTP Methods Matter
```
❌ WRONG: PATCH /api/orders/:hash/fulfill
✅ RIGHT: POST /api/orders/:orderHash/fulfill

❌ WRONG: PATCH /api/orders/:hash/cancel
✅ RIGHT: DELETE /api/orders/:orderHash/cancel
```

### 2. Parameter Names Matter
```
❌ WRONG: /api/orders/:hash/fulfill
✅ RIGHT: /api/orders/:orderHash/fulfill
```

### 3. Order of Operations
```
1. On-chain transaction first (seaport.fulfillOrder)
2. Wait for confirmation (tx.wait())
3. Then notify backend (POST /api/orders/:orderHash/fulfill)
```

### 4. Error Handling
```typescript
async buyNow(order) {
  try {
    // Step 1: On-chain
    const tx = await seaport.fulfillOrder(...);
    const receipt = await tx.wait();

    // Step 2: Backend (don't fail if this fails)
    try {
      await api.post(`/api/orders/${order.orderHash}/fulfill`, {
        fulfiller: buyerAddress,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });
    } catch (backendError) {
      console.warn('Backend notification failed:', backendError);
      // Don't throw - the transaction already succeeded on-chain
      // The OrderFulfillmentMonitorService will detect it automatically
    }

    return receipt;
  } catch (error) {
    // On-chain transaction failed - this is a real error
    throw error;
  }
}
```

### 5. Automatic Detection
Your backend has `OrderFulfillmentMonitorService` that **automatically** detects fulfilled orders from the blockchain. So even if the manual notification fails, the order will eventually be marked as fulfilled.

---

## 🎯 Action Items

- [ ] Fix HTTP methods in your code:
  - [ ] Change `PATCH` to `POST` for fulfill
  - [ ] Change `PATCH` to `DELETE` for cancel

- [ ] Fix URL parameters:
  - [ ] Change `:hash` to `:orderHash`

- [ ] Add backend calls to:
  - [ ] `createListing()` → POST to backend
  - [ ] `createOffer()` → POST to backend
  - [ ] `buyNow()` → POST fulfillment to backend
  - [ ] `acceptOffer()` → POST fulfillment to backend
  - [ ] `cancelListing()` → DELETE from backend
  - [ ] `cancelOffer()` → DELETE from backend

- [ ] Test each function end-to-end

---

## ✅ Verification

After updating your code, test:

```typescript
// 1. Create listing
const order = await marketplaceService.createListing({...});
// Check: Should appear in database

// 2. Buy NFT
await marketplaceService.buyNow(order);
// Check: Order should be marked as fulfilled in database

// 3. Cancel listing
await marketplaceService.cancelListing(orderHash);
// Check: Order should be marked as cancelled in database
```

---

**Bottom Line:** Your table showed the right **concept** but wrong **HTTP methods** and **parameter names**. Use the corrected versions above! 🎯
