# Treasury Contract API Usage

## Overview

The treasury contract service reads officer allocations **directly from the blockchain** using Circle SDK, ensuring data integrity and eliminating the need for off-chain storage of share allocations.

---

## Files Created

1. **Service Layer**: `app/src/lib/services/treasury-contract-service.ts`
   - Circle SDK integration
   - View functions (read blockchain state)
   - Write functions (execute transactions)
   - Helper utilities (wei conversion, formatting)

2. **API Routes**:
   - `GET /api/treasury` - Read treasury state
   - `POST /api/treasury/execute` - Execute treasury actions

---

## Reading Treasury State (View Functions)

### 1. Get All Officers and Their Allocations

```bash
curl http://localhost:3000/api/treasury?action=officers
```

**Response**:
```json
{
  "success": true,
  "data": {
    "officers": [
      {
        "address": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
        "shares": 50,
        "percentage": 5000,  // Basis points (50.00%)
        "percentageFormatted": "50.00%"
      },
      {
        "address": "0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37",
        "shares": 30,
        "percentage": 3000,  // 30.00%
        "percentageFormatted": "30.00%"
      },
      {
        "address": "0x3c4b268b88ca7374e2f597b6627011225263d8b4",
        "shares": 20,
        "percentage": 2000,  // 20.00%
        "percentageFormatted": "20.00%"
      }
    ],
    "count": 3
  }
}
```

**Frontend Usage**:
```typescript
const response = await fetch('/api/treasury?action=officers');
const { data } = await response.json();

// Display officer allocations
data.officers.forEach(officer => {
  console.log(`${officer.address}: ${officer.percentageFormatted}`);
});
```

---

### 2. Get Specific Officer Info

```bash
curl "http://localhost:3000/api/treasury?action=officer&address=0x5a79daf48e3b02e62bdaf8554b50083617f4a359"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "address": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "shares": 50,
    "percentage": 5000,
    "percentageFormatted": "50.00%"
  }
}
```

---

### 3. Get Treasury USDC Balance

```bash
curl http://localhost:3000/api/treasury?action=balance
```

**Response**:
```json
{
  "success": true,
  "data": {
    "balanceWei": "120000000000000000000000",  // 18 decimals
    "balanceUsdc": 120000,
    "formatted": "120,000 USDC"
  }
}
```

---

### 4. Get Total Shares

```bash
curl http://localhost:3000/api/treasury?action=totalShares
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalShares": 100
  }
}
```

---

### 5. Get Payment Count

```bash
curl http://localhost:3000/api/treasury?action=paymentCount
```

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentCount": 5
  }
}
```

---

## Executing Treasury Actions (Write Functions)

### 1. Initialize Shares (One-Time Setup)

```bash
curl -X POST http://localhost:3000/api/treasury/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "initializeShares",
    "officers": [
      "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
      "0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37",
      "0x3c4b268b88ca7374e2f597b6627011225263d8b4"
    ],
    "shares": [50, 30, 20]
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Shares initialization transaction submitted",
  "data": {
    "transactionId": "0x123abc...",
    "officers": ["0x5a79...", "0x43d1...", "0x3c4b..."],
    "shares": [50, 30, 20],
    "totalShares": 100
  }
}
```

**Frontend Usage**:
```typescript
const initShares = async () => {
  const response = await fetch('/api/treasury/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'initializeShares',
      officers: [
        '0x5a79daf48e3b02e62bdaf8554b50083617f4a359',  // Michael Burry
        '0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37',  // Richard Branson
        '0x3c4b268b88ca7374e2f597b6627011225263d8b4',  // Cathie Wood
      ],
      shares: [50, 30, 20],
    }),
  });

  const result = await response.json();
  console.log('Transaction ID:', result.data.transactionId);
};
```

---

### 2. Distribute Profits (Profit & Loss Document)

```bash
curl -X POST http://localhost:3000/api/treasury/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "distributeProfits",
    "amount": 120000,
    "documentHash": "0xabc123..."
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Profit distribution transaction submitted",
  "data": {
    "transactionId": "0x456def...",
    "amountUsdc": 120000,
    "amountWei": "120000000000000000000000",
    "documentHash": "0xabc123..."
  }
}
```

**What Happens On-Chain**:
```
Total: 120,000 USDC distributed proportionally:
- Michael Burry (50%): 60,000 USDC → 0x5a79...a359
- Richard Branson (30%): 36,000 USDC → 0x43d1...dc37
- Cathie Wood (20%): 24,000 USDC → 0x3c4b...d8b4
```

---

### 3. Pay Salary (Payroll Document)

```bash
curl -X POST http://localhost:3000/api/treasury/execute \
  -H "Content-Type": application/json" \
  -d '{
    "action": "paySalary",
    "address": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "amount": 5000,
    "documentHash": "0xdef456..."
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Salary payment transaction submitted",
  "data": {
    "transactionId": "0x789ghi...",
    "officer": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "amountUsdc": 5000,
    "amountWei": "5000000000000000000000",
    "documentHash": "0xdef456..."
  }
}
```

---

### 4. Pay Bonus (Director Resolution)

```bash
curl -X POST http://localhost:3000/api/treasury/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "payBonus",
    "address": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "amount": 10000,
    "reason": "Exceptional Q4 Performance",
    "documentHash": "0xghi789..."
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Bonus payment transaction submitted",
  "data": {
    "transactionId": "0xabcdef...",
    "officer": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "amountUsdc": 10000,
    "amountWei": "10000000000000000000000",
    "reason": "Exceptional Q4 Performance",
    "documentHash": "0xghi789..."
  }
}
```

---

### 5. Update Shares (Dilution Event / Shareholder Update)

```bash
curl -X POST http://localhost:3000/api/treasury/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "updateShares",
    "address": "0xNEW_INVESTOR_ADDRESS",
    "newShares": 11
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Shares update transaction submitted",
  "data": {
    "transactionId": "0xjklmno...",
    "officer": "0xNEW_INVESTOR_ADDRESS",
    "newShares": 11
  }
}
```

**What Happens**:
- New investor gets 11 shares
- Total shares: 100 → 111
- Existing shareholders diluted:
  - Michael: 50 shares = 50/111 = 45.05%
  - Richard: 30 shares = 30/111 = 27.03%
  - Cathie: 20 shares = 20/111 = 18.02%
  - New Investor: 11 shares = 11/111 = 9.91%

---

## Integration with DAO House Page

### Display Officer Allocations (Live from Blockchain)

```typescript
'use client';

import { useEffect, useState } from 'react';

export function OfficersList() {
  const [officers, setOfficers] = useState([]);

  useEffect(() => {
    loadOfficersFromChain();
  }, []);

  const loadOfficersFromChain = async () => {
    const response = await fetch('/api/treasury?action=officers');
    const { data } = await response.json();
    setOfficers(data.officers);
  };

  return (
    <div>
      <h3>Officer Allocations (Live from Blockchain)</h3>
      {officers.map(officer => (
        <div key={officer.address}>
          <p>{officer.address}</p>
          <p>Shares: {officer.shares}</p>
          <p>Ownership: {officer.percentageFormatted}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Complete Flow: Document → Claim → Treasury Payment

1. **Upload Document** (Profit & Loss Report)
   - Parse with Docling: Extract £120,000 profit
   - Store in Firebase
   - Add event to execution

2. **Template Processes Event**
   - Creates claim: "Q4 Dividend Distribution"
   - Sink aggregates amount: 120,000 USDC
   - Claim status: "pending"

3. **Approve Claim**
   - User clicks "Approve" in Claims Registry
   - Claim status → "approved"

4. **Execute Payment** (Triggered by claim approval)
   ```typescript
   const executeDividendPayment = async (claimId) => {
     // Get claim details
     const claim = await getClaimById(claimId);
     const amount = claim.aggregateValue; // 120,000
     const documentHash = keccak256(claimId);

     // Call treasury contract
     const response = await fetch('/api/treasury/execute', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         action: 'distributeProfits',
         amount: amount,
         documentHash: documentHash,
       }),
     });

     const { data } = await response.json();
     console.log('Payment transaction:', data.transactionId);
   };
   ```

5. **Verify On-Chain**
   - Check transaction on Arcscan: `https://testnet.arcscan.app/tx/${transactionId}`
   - Verify officer balances increased
   - View payment history in contract

---

## Benefits of Reading from Blockchain

1. **Single Source of Truth**: Allocations stored on-chain, not in database
2. **Tamper-Proof**: Cannot modify allocations without blockchain transaction
3. **Auditable**: Full history of share changes via blockchain events
4. **Real-Time**: Always reflects current on-chain state
5. **Dilution Support**: Automatic percentage recalculation when new shares issued

---

## Environment Variables

Add to `.env.local` after deploying contract:

```bash
# Treasury contract address on Arc Testnet
NEXT_PUBLIC_TREASURY_DAO_ADDRESS=0x... # Address after deployment

# Circle SDK (already configured)
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
```

---

## Example: DAO House Officers Tab

```typescript
// app/src/components/dao-house/OfficersTab.tsx
'use client';

import { useEffect, useState } from 'react';

export function OfficersTab({ companyId }: { companyId: string }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOfficers();
  }, []);

  const loadOfficers = async () => {
    try {
      // Read live allocations from blockchain
      const response = await fetch('/api/treasury?action=officers');
      const { data } = await response.json();

      // Match with officer names from Firebase
      const peopleResponse = await fetch(`/api/dao-house/people?companyId=${companyId}`);
      const { people } = await peopleResponse.json();

      // Merge blockchain data with officer names
      const merged = data.officers.map(o => {
        const person = people.find(p =>
          p.wallets.some(w => w.address.toLowerCase() === o.address.toLowerCase())
        );

        return {
          ...o,
          name: person?.name || 'Unknown',
          role: person?.role || 'Officer',
        };
      });

      setOfficers(merged);
    } catch (error) {
      console.error('Error loading officers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading officers from blockchain...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Officers & Shareholding</h3>
      {officers.map(officer => (
        <div key={officer.address} className="border-l-4 border-blue-500 pl-4">
          <p className="font-bold">{officer.name}</p>
          <p className="text-sm text-gray-600">{officer.role}</p>
          <p className="text-sm">Shares: {officer.shares}</p>
          <p className="text-sm font-bold">Ownership: {officer.percentageFormatted}</p>
          <p className="text-xs font-mono">{officer.address}</p>
        </div>
      ))}
    </div>
  );
}
```

---

This setup ensures **all allocation data is read directly from the blockchain**, making the DAO House demo fully transparent and verifiable!
