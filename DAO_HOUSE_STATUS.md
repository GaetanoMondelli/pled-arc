# DAO House Implementation Status

## What We've Accomplished

### 1. ✅ Architecture & Planning
- Created comprehensive document type specification ([DOCUMENT_TYPES.md](./DOCUMENT_TYPES.md))
- Defined 4 document types with smart contract actions:
  - Profit & Loss Report → `distributeProfits()`
  - Payroll Summary → `paySalary()`
  - Director Resolution → `payBonus()`
  - Shareholder Update → `updateShares()`
- Designed share-based treasury model using ERC20-like shares

### 2. ✅ Smart Contract Development
- Created TreasuryDAO.sol ([web3/contracts/TreasuryDAO.sol](./web3/contracts/TreasuryDAO.sol))
- Features:
  - Share-based profit distribution (Michael Burry: 60%, Richard Branson: 40%)
  - Fixed salary payments (not share-based)
  - Bonus payments with on-chain reasoning
  - Dynamic share allocation updates
  - Payment history tracking
  - Emergency withdrawal (owner only)
- Compiled successfully with OpenZeppelin dependencies

### 3. ✅ Backend Services
- Created `dao-house-service.ts` for Firebase operations
- Created `/api/dao-house/init` route to:
  - Fetch Circle wallets
  - Create fake people directory (Michael Burry, Richard Branson)
  - Create "Web3 Scion Limited" company profile
  - Create execution for corporate filings
- Integrated with existing execution API for document events

### 4. ✅ Frontend Pages
- Created `/dao-house` route with Companies House-inspired UI
- Features:
  - Search bar for companies/officers
  - Company profile display
  - Officer list with wallet addresses and allocations
  - Tabs: Overview, Filing History, People
  - Initialize button for first-time setup
- Uses DAO House logo from `app/public/daohouse.png`

### 5. ✅ Data Structure
Firebase storage structure defined:
```
arcpled/dao-house/
├── companies/{companyId}/profile.json
├── documents/{companyId}/{executionId}/
│   ├── original/document.pdf
│   └── formats/
│       ├── text.txt
│       ├── markdown.md
│       └── structured.json
└── people/directory.json
```

## What's Left to Do

### 6. ⏳ Smart Contract Deployment
**Status**: Contract created but deployment to Arc Testnet failed due to Circle SCP API issue

**Next Steps**:
1. Debug Circle Smart Contract Platform API error (400 Bad Request)
2. Alternative: Deploy using Hardhat directly with Arc RPC
3. Once deployed, call `initializeShares()` with officer addresses
4. Fund treasury with test USDC

### 7. ⏳ Document Upload & Processing
**Status**: Service layer created but UI not built yet

**Needed**:
1. Create `DocumentUploader.tsx` component
2. Implement file upload to Firebase
3. Integrate Docling service for PDF parsing
4. Store multiple formats (PDF, JSON, TXT, MD)
5. Add events to execution when document processed

### 8. ⏳ Filing History Component
**Status**: Not started

**Needed**:
1. Create `FilingHistory.tsx` with document list
2. Display document type, date, status
3. Add upload button
4. Link documents to executions
5. Show associated claims

### 9. ⏳ Docling Integration
**Status**: Service endpoints identified but not integrated

**Needed**:
1. Create API route `/api/dao-house/upload-document`
2. Send PDF to Docling service: `https://a5fd808de8a8.ngrok-free.app`
3. Parse response and extract:
   - Document type (P&L, Payroll, Resolution, Shareholder Update)
   - Key amounts and officer names
   - Dates and status
4. Generate external event for execution

### 10. ⏳ Treasury Dashboard
**Status**: GatewayPlayground exists but not integrated

**Needed**:
1. Create `TreasuryDashboard.tsx` reusing GatewayPlayground logic
2. Show unified USDC balance across chains
3. Display officer allocations (60% / 40%)
4. Show recent payment history from smart contract
5. Link to treasury contract address on Arcscan

### 11. ⏳ Payment Executor
**Status**: Design complete but not implemented

**Needed**:
1. Add "Execute Payment" button in Claims Registry
2. When claim status = "approved":
   - Read claim's sink values
   - Determine document type
   - Call appropriate TreasuryDAO function:
     - Profit report → `distributeProfits(amount)`
     - Payroll → `paySalary(officer, amount)`
     - Resolution → `payBonus(officer, amount, reason)`
     - Shareholder update → `updateShares(officer, newShares)`
3. Use Circle Gateway for cross-chain USDC delivery
4. Update IncrementalVerifiableClaim with payment proof
5. Mark filing as "executed"

### 12. ⏳ Template Editor Scenario
**Status**: Not created

**Needed** (Manual setup in UI):
1. Create "Corporate Treasury Management" template
2. Add nodes:
   - DataSource: Document upload events
   - Process: Document type classifier
   - FSM: Approval workflow (pending → approved → executed)
   - Sink: Treasury actions (aggregate by officer)
3. Link to claims for approval

### 13. ⏳ End-to-End Testing
**Status**: Not started

**Test Flow**:
1. Initialize DAO House (create company, people, execution)
2. Upload "Q4 Profit Report.pdf" (£120k profit)
3. Docling parses → extracts £120,000
4. Event added to execution
5. Template processes → creates claim
6. Approve claim → triggers `distributeProfits(120000)`
7. Michael Burry gets 72,000 USDC (60%)
8. Richard Branson gets 48,000 USDC (40%)
9. Verify payment on Arcscan
10. Check updated filing status

## Key Files Created

### Smart Contracts
- `web3/contracts/TreasuryDAO.sol` - Main treasury contract
- `web3/deploy-treasury-dao.js` - Deployment script (needs debugging)

### Backend
- `app/src/lib/services/dao-house-service.ts` - Firebase operations
- `app/src/app/api/dao-house/init/route.ts` - Initialization endpoint

### Frontend
- `app/src/app/dao-house/page.tsx` - Main DAO House interface

### Documentation
- `DOCUMENT_TYPES.md` - Complete document type specification
- `DAO_HOUSE_STATUS.md` - This file

## Next Immediate Steps

1. **Fix Contract Deployment**
   - Debug Circle SCP API or use Hardhat deployment
   - Initialize shares: Michael (60), Richard (40)
   - Fund treasury with test USDC

2. **Build Document Upload**
   - Create upload component
   - Integrate Docling
   - Store parsed data
   - Add execution events

3. **Create Filing History Tab**
   - List uploaded documents
   - Show status and type
   - Display linked claims

4. **Integrate Treasury Dashboard**
   - Show officer balances
   - Display allocations
   - Recent payments

5. **Build Payment Executor**
   - Link claims to treasury actions
   - Execute payments on approval
   - Update on-chain state

## Hackathon Track Alignment

### Track 1: Best Smart Contracts on Arc with Advanced Stablecoin Logic
✅ **Achieved**:
- TreasuryDAO contract with advanced USDC logic
- Share-based distribution model
- Multi-officer support
- Payment history tracking
- Integration with IncrementalVerifiableClaim

⏳ **Pending**: Deployment to Arc Testnet

### Track 3: Best Smart Contract Wallet Infrastructure for Treasury Management with Gateway & Arc
✅ **Achieved**:
- Multi-wallet support (Circle developer-controlled wallets)
- Cross-chain architecture (ARC-TESTNET, ETH-SEPOLIA, BASE-SEPOLIA)
- Treasury management infrastructure

⏳ **Pending**:
- Circle Gateway integration for cross-chain distributions
- Actual USDC transfers via Gateway
- Complete end-to-end flow

## Circle SDK Usage

### Already Integrated:
- Developer-Controlled Wallets SDK (wallet creation, balance checking)
- Smart Contract Platform SDK (contract deployment attempt)

### To Integrate:
- Circle Gateway API for unified USDC balance
- Cross-chain withdrawal/distribution
- Transaction monitoring

## Environment Variables Needed

Add to `.env.local`:
```bash
# After successful deployment
NEXT_PUBLIC_TREASURY_DAO_ADDRESS=0x...

# Docling service (already configured)
DOCLING_SERVICE_URL=https://a5fd808de8a8.ngrok-free.app
DOCLING_API_KEY=your-api-key

# Circle (already configured)
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_SDK_API_KEY=TEST_CLIENT_KEY:...
CIRCLE_ENTITY_SECRET=...
```

## Demo Flow for Hackathon

1. **Show DAO House Interface** - Companies House-style UI with Web3 Scion
2. **Display Officers** - Michael Burry (60%) and Richard Branson (40%) with wallet addresses
3. **Upload Profit Report** - "Q4 profit: £120k" → Docling parses
4. **Show Template Processing** - Event flows through nodes, creates claim
5. **Approve Claim** - Manual approval in Claims Registry
6. **Execute Payment** - Treasury distributes 72k to Michael, 48k to Richard
7. **Verify On-Chain** - Show Arcscan transaction, payment history
8. **Display Updated State** - Treasury balance, payment history, claim status

---

**Status Summary**: 40% Complete
- ✅ Architecture & Design
- ✅ Smart Contract Development
- ✅ Basic UI & Services
- ⏳ Contract Deployment (blocked)
- ⏳ Document Processing
- ⏳ Payment Execution
- ⏳ End-to-End Integration
