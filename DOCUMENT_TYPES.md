# DAO House - Corporate Document Types & Format Specification

This document defines the expected format and content structure for corporate documents uploaded to DAO House. These documents trigger on-chain treasury actions via smart contracts.

---

## Document Type Overview

| Document Type | Triggers | Smart Contract Action | Share-Based |
|--------------|----------|----------------------|-------------|
| Profit & Loss Report | Dividend Distribution | `distributeProfits(amount)` | Yes (based on ERC20 shares) |
| Payroll Summary | Salary Payment | `paySalary(officer, amount)` | No (fixed amount) |
| Director Resolution | Bonus Payment | `payBonus(officer, amount)` | No (fixed amount) |
| Shareholder Update | Allocation Change | `updateShares(officer, newShares)` | N/A (modifies shares) |

---

## 1. Profit & Loss Report

**Purpose**: Distribute profits to shareholders based on their ERC20 share allocation

**Trigger**: Dividend distribution via Circle Gateway to officer wallets across multiple chains

**Smart Contract Function**:
```solidity
function distributeProfits(uint256 totalAmount) external {
    // Calculates: payout = (officer.shares / totalShares) * totalAmount
    // Distributes USDC proportionally to all shareholders
}
```

### Required Document Elements

The AI parser looks for these key phrases and data points:

```markdown
# Profit & Loss Report
**Period**: [Month/Quarter/Year]
**Total Revenue**: £[amount] or $[amount] USDC
**Total Expenses**: £[amount] or $[amount] USDC
**Net Profit**: £[amount] or $[amount] USDC

## Dividend Declaration
**Total Profit for Distribution**: [amount] USDC
**Distribution Date**: [date]
**Status**: Approved/Pending

## Officer Allocations
- Michael Burry: 60% → [calculated amount] USDC
- Richard Branson: 40% → [calculated amount] USDC
```

### AI Parsing Rules
- Extract **Net Profit** or **Total Profit for Distribution** as `distributionAmount`
- Convert £ amounts to USDC equivalent if needed
- Verify status is "Approved" before triggering smart contract
- Generate external event:
  ```json
  {
    "type": "profit_distribution",
    "amount": "120000",
    "currency": "USDC",
    "status": "approved",
    "distributionDate": "2025-11-15"
  }
  ```

### Example Document

```text
PROFIT & LOSS REPORT
WEB3 SCION LIMITED
Company Number: 08675309

Period: Q4 2024 (October - December 2024)

REVENUE
Total Sales: £250,000
Service Income: £75,000
Total Revenue: £325,000

EXPENSES
Operating Costs: £120,000
Salaries: £50,000
Marketing: £35,000
Total Expenses: £205,000

NET PROFIT: £120,000

DIVIDEND DECLARATION
The Board of Directors has approved the distribution of £120,000 (120,000 USDC)
in dividends to shareholders based on their current shareholding percentages.

Distribution Breakdown:
- Michael Burry (60%): £72,000 (72,000 USDC)
- Richard Branson (40%): £48,000 (48,000 USDC)

Status: APPROVED
Distribution Date: 15 November 2025
```

---

## 2. Payroll Summary

**Purpose**: Pay fixed salaries to specific officers

**Trigger**: Direct USDC transfer to officer wallet(s)

**Smart Contract Function**:
```solidity
function paySalary(address officer, uint256 amount) external {
    // Transfers fixed USDC amount to officer
    // Not based on share allocation
}
```

### Required Document Elements

```markdown
# Payroll Summary
**Period**: [Month/Year]
**Total Payroll**: [total] USDC

## Officer Payments
- [Officer Name]: [amount] USDC → [wallet address or blockchain]
- [Officer Name]: [amount] USDC → [wallet address or blockchain]

**Status**: Approved/Pending
**Payment Date**: [date]
```

### AI Parsing Rules
- Extract each officer and their salary amount
- Map officer name to wallet address from people directory
- Generate separate event for each payment:
  ```json
  {
    "type": "salary_payment",
    "officer": "Michael Burry",
    "amount": "5000",
    "currency": "USDC",
    "wallet": "0x5a79daf48e3b02e62bdaf8554b50083617f4a359",
    "blockchain": "ARC-TESTNET"
  }
  ```

### Example Document

```text
PAYROLL SUMMARY
WEB3 SCION LIMITED
Company Number: 08675309

Period: November 2025

OFFICER SALARIES
1. Michael Burry (Director)
   Base Salary: £5,000 (5,000 USDC)
   Payment to: ARC-TESTNET wallet

2. Richard Branson (Shareholder)
   Consulting Fee: £3,000 (3,000 USDC)
   Payment to: BASE-SEPOLIA wallet

Total Payroll: £8,000 (8,000 USDC)

Status: APPROVED
Payment Date: 1 December 2025
```

---

## 3. Director Resolution

**Purpose**: Approve and execute bonus payments or special distributions

**Trigger**: One-time USDC payment to specific officer(s)

**Smart Contract Function**:
```solidity
function payBonus(address officer, uint256 amount, string memory reason) external {
    // Transfers bonus amount to officer
    // Logs reason on-chain
}
```

### Required Document Elements

```markdown
# Director Resolution
**Resolution Number**: [number]
**Date**: [date]
**Subject**: [bonus type/reason]

## Resolution Details
**Resolved That**: [description of bonus/payment]

## Payment Details
- [Officer Name]: [amount] USDC for [reason]

**Status**: Approved/Rejected
**Execution Date**: [date]
```

### AI Parsing Rules
- Extract officer, amount, and reason
- Only process if status is "Approved"
- Generate event:
  ```json
  {
    "type": "bonus_payment",
    "officer": "Michael Burry",
    "amount": "10000",
    "currency": "USDC",
    "reason": "Exceptional Q4 Performance",
    "resolutionNumber": "2025-11-001"
  }
  ```

### Example Document

```text
DIRECTOR RESOLUTION
WEB3 SCION LIMITED
Company Number: 08675309

Resolution Number: 2025-11-001
Date: 15 November 2025

Subject: Approval of Performance Bonus

RESOLVED THAT:

The Board of Directors approves a special performance bonus for exceptional
work during Q4 2024, recognizing outstanding contributions to the company's
growth and profitability.

PAYMENT DETAILS:
- Michael Burry: £10,000 (10,000 USDC) for exceptional Q4 performance and
  strategic leadership

Status: APPROVED
Execution Date: 20 November 2025

Signed by the Board of Directors
```

---

## 4. Shareholder Update

**Purpose**: Modify shareholder allocation percentages (ERC20 share distribution)

**Trigger**: Mint/burn treasury ERC20 tokens to rebalance ownership

**Smart Contract Function**:
```solidity
function updateShares(address officer, uint256 newShares) external onlyGovernance {
    // Updates officer's share count
    // Recalculates totalShares
    // Future profit distributions use new percentages
}
```

### Required Document Elements

```markdown
# Shareholder Update
**Update Number**: [number]
**Date**: [date]
**Reason**: [share split/transfer/issuance]

## Previous Allocation
| Officer | Shares | Percentage |
|---------|--------|------------|
| [Name]  | [num]  | [%]        |

## New Allocation
| Officer | Shares | Percentage |
|---------|--------|------------|
| [Name]  | [num]  | [%]        |

**Status**: Approved/Pending
**Effective Date**: [date]
```

### AI Parsing Rules
- Extract old and new share allocations
- Verify total = 100 shares
- Generate event for each officer:
  ```json
  {
    "type": "shares_update",
    "officer": "Michael Burry",
    "oldShares": 60,
    "newShares": 70,
    "oldPercentage": 60,
    "newPercentage": 70,
    "reason": "Additional investment"
  }
  ```

### Example Document

```text
SHAREHOLDER UPDATE
WEB3 SCION LIMITED
Company Number: 08675309

Update Number: 2025-11-002
Date: 15 November 2025

Reason: Additional Investment by Michael Burry

PREVIOUS ALLOCATION:
| Shareholder      | Shares | Percentage |
|------------------|--------|------------|
| Michael Burry    | 60     | 60%        |
| Richard Branson  | 40     | 40%        |
| Total            | 100    | 100%       |

NEW ALLOCATION:
| Shareholder      | Shares | Percentage |
|------------------|--------|------------|
| Michael Burry    | 70     | 70%        |
| Richard Branson  | 30     | 30%        |
| Total            | 100    | 100%       |

DETAILS:
Michael Burry has made an additional investment of £50,000, resulting in
an increased shareholding from 60% to 70%. Richard Branson's shareholding
has been diluted proportionally to 30%.

Status: APPROVED
Effective Date: 20 November 2025

Future profit distributions will be calculated based on the new allocation.
```

---

## AI Parsing Instructions

When processing uploaded documents via Docling:

1. **Identify Document Type**
   - Scan for keywords: "Profit & Loss", "Payroll", "Director Resolution", "Shareholder Update"
   - Extract document type from title/header

2. **Extract Key Data**
   - Look for currency amounts (£, $, USDC)
   - Identify officer names (match against people directory)
   - Extract dates (format: DD Month YYYY or YYYY-MM-DD)
   - Find status indicators (Approved, Pending, Rejected)

3. **Validate**
   - Ensure required fields are present
   - Verify amounts are numeric
   - Check officer names exist in directory
   - Confirm status is "Approved" for execution

4. **Generate External Event**
   - Create JSON event with extracted data
   - Include timestamp, document ID, type
   - Add to execution via `/api/executions/{executionId}/events`

5. **Store Metadata**
   - Save document type, status, amounts
   - Link to execution ID and filing date
   - Store in Firebase: `arcpled/dao-house/documents/{companyId}/{executionId}/metadata.json`

---

## Document Status Workflow

```
Uploaded → Pending → Processed → Approved → Executed
                                      ↓
                               Smart Contract
                                  Triggered
```

1. **Uploaded**: Document stored in Firebase
2. **Pending**: Awaiting Docling parsing
3. **Processed**: AI extracted data successfully
4. **Approved**: Manual or automated approval (claim status = "approved")
5. **Executed**: Smart contract function called, treasury action complete

---

## Template Editor Integration

The Template Editor scenario should process these events:

**Nodes**:
1. **DataSource**: "Document Upload Events"
   - Listens for: `document_uploaded`, `document_parsed`

2. **Process**: "Document Type Classifier"
   - Routes event based on type: profit_distribution, salary_payment, bonus_payment, shares_update

3. **FSM**: "Approval Workflow"
   - States: pending → approved → executed
   - Transitions based on manual approval or automated rules

4. **Sink**: "Treasury Actions"
   - Aggregates approved payments by officer
   - Filters by document type
   - Outputs: `{ officer: address, amount: USDC, action: type }`

**Claims**:
- One claim per document filing
- Evidence: document events + approval events
- Formula: THRESHOLD (requires approval event)
- When claim becomes "approved" → trigger smart contract execution

---

## Smart Contract Integration

When a claim status changes to "approved", the payment executor:

1. Reads claim's sink values
2. Determines document type
3. Calls appropriate treasury contract function:
   - **Profit & Loss** → `TreasuryDAO.distributeProfits(120000 USDC)`
   - **Payroll** → `TreasuryDAO.paySalary(0x5a79..., 5000 USDC)`
   - **Resolution** → `TreasuryDAO.payBonus(0x5a79..., 10000 USDC, "Q4 Performance")`
   - **Shareholder Update** → `TreasuryDAO.updateShares(0x5a79..., 70)`

4. Uses Circle Gateway for cross-chain USDC delivery
5. Updates IncrementalVerifiableClaim contract with payment proof
6. Marks filing as "executed"

---

## Example Full Flow

1. User uploads "Q4 Profit Report.pdf"
2. Docling extracts: Net Profit = £120,000
3. AI creates event: `profit_distribution` with amount = 120000 USDC
4. Event added to execution
5. Template processes event → creates claim "Q4 Dividends"
6. Claim status = "pending"
7. User approves claim → status = "approved"
8. Payment executor triggers:
   ```solidity
   TreasuryDAO.distributeProfits(120000)
   // → Michael Burry gets 72,000 USDC (60%)
   // → Richard Branson gets 48,000 USDC (40%)
   ```
9. Circle Gateway delivers USDC to wallets across chains
10. Filing status = "executed"
