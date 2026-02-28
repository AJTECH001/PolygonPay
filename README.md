# PolygonPay — AI-Powered Onchain Payroll

> **Live on Polygon Amoy Testnet** · Replace bank wires with smart contracts. Pay your global team in crypto — streaming per-second or scheduled lump-sum — in seconds, not days.

[![Contract Deployed](https://img.shields.io/badge/Contract-Amoy%20Testnet-8247E5?style=flat-square&logo=polygon)](https://amoy.polygonscan.com/address/0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127)
[![Verified on PolygonScan](https://img.shields.io/badge/PolygonScan-Verified-00AC4F?style=flat-square)](https://amoy.polygonscan.com/address/0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity)](https://soliditylang.org)
[![Powered by Claude](https://img.shields.io/badge/AI-Claude%20Opus%204.6-D4A520?style=flat-square)](https://anthropic.com)

---

## Live Deployment

| Component | Link |
|-----------|------|
| **Smart Contract** | [`0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127`](https://amoy.polygonscan.com/address/0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127) |
| **PolygonScan** | [View contract + transactions](https://amoy.polygonscan.com/address/0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127) |
| **Network** | Polygon Amoy Testnet (chainId 80002) |
| **Deploy Block** | `34567860` |

---

## What is PolygonPay?

PolygonPay is an AI-augmented onchain payroll system deployed on Polygon. It gives companies a non-custodial smart contract vault to pay global employees in **POL, USDC, or any ERC-20 token**, with two payment modes:

- **Streaming** — salary accrues per-second, mathematically. Employees claim accumulated earnings anytime with a single transaction.
- **Lump-Sum** — employer runs payroll on a configurable schedule (e.g. every 28 days). Contract validates funding before execution.

A **Claude AI layer** continuously analyzes payroll data for anomalies, risk signals, and optimization recommendations — surfaced directly in the employer dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│  Employer Dashboard          Employee Portal                │
│  (Register · Add staff ·     (View salary · Claim stream ·  │
│   Deposit · Run payroll ·     Verify payment history)       │
│   AI Insights · History)                                    │
└────────────────────┬──────────────────┬─────────────────────┘
                     │                  │
┌────────────────────▼──────────────────▼─────────────────────┐
│                    NEXT.JS 16 FRONTEND                      │
│  wagmi v2 + viem + RainbowKit  ·  Tailwind + shadcn/ui      │
│  NetworkGuard (Amoy enforcement)  ·  ERC-20 approve flow    │
└──────────┬────────────────────────────┬──────────────────────┘
           │ contract reads/writes      │ API routes
┌──────────▼──────────┐    ┌────────────▼────────────────────┐
│  PayrollRegistry    │    │  Next.js API Routes (server)    │
│  Smart Contract     │    │  ┌──────────────────────────┐   │
│  (Polygon Amoy)     │    │  │ /api/analyze  → Claude   │   │
│                     │    │  │ /api/events   → viem logs │   │
│  deposits[employer] │    │  │ /api/payroll  → status   │   │
│  [token] → bigint   │    │  │ /api/prices   → CoinGecko│   │
│                     │    │  └──────────────────────────┘   │
│  PaymentType:       │    └─────────────────────────────────┘
│  0 = LUMP_SUM       │
│  1 = STREAMING      │
└─────────────────────┘
```

---

## Smart Contract — `PayrollRegistry.sol`

**Contract Address:** [`0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127`](https://amoy.polygonscan.com/address/0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127)

### Core Design Decisions

**Per-company deposit buckets** — `deposits[employer][token]` isolates each company's funds. Employers can only withdraw their own balance; employees can only claim their own stream.

**Non-custodial** — The contract never holds funds on behalf of PolygonPay. All deposits are employer-owned and withdrawable at any time.

**Streaming math** — Instead of a continuous transfer loop (prohibitively expensive), the contract stores a `streamRate` (tokens/second) and `streamStartedAt` timestamp. Claimable amount is computed on-demand:
```
claimable = (now - streamStartedAt) × streamRate - streamClaimedAmount
```

**Safe settlement** — When an employee is removed or salary updated, any accrued-but-unclaimed stream balance is settled immediately, preventing loss on state changes.

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerCompany(name, description, interval)` | Public | One-time company setup |
| `addEmployee(wallet, name, role, token, salary, streamRate, type)` | Employer | Add employee + set payment config |
| `depositFunds(token, amount)` | Employer | Fund the payroll pool (POL = payable, ERC-20 = transferFrom) |
| `executePayroll()` | Employer | Pay all due lump-sum employees in one transaction |
| `claimStream(employer)` | Employee | Claim accrued streaming salary |
| `getStreamableAmount(employer, employee)` | View | Real-time claimable balance |
| `getEmployees(employer)` | View | Full employee roster |
| `withdrawFunds(token, amount)` | Employer | Retrieve unused deposit |

### Events (indexed for history)
```solidity
event EmployeePaid(address employer, address employee, address token, uint256 amount)
event StreamClaimed(address employer, address employee, address token, uint256 amount)
event PayrollExecuted(address employer, uint256 paidCount)
event FundsDeposited(address employer, address token, uint256 amount)
```

---

## AI Integration — Claude Opus 4.6

The `/api/analyze` route reads live contract state (employees, salaries, payment history) and submits it to Claude with a structured prompt:

```
Analyze this payroll dataset for:
1. Salary anomalies (outliers vs. role/seniority norms)
2. Payment irregularities (missed cycles, late patterns)
3. Token concentration risk (over-exposure to volatile assets)
4. Budget efficiency recommendations
```

Claude returns structured JSON `{ anomalies[], insights[], recommendations[] }` rendered in the **AI Insights** tab of the employer dashboard. This is not a static heuristic — every analysis is a live inference against real on-chain data.

---

## User Flows

### Employer Flow
```
1. Connect wallet (MetaMask / WalletConnect) on Polygon Amoy
2. Register company → one onchain transaction stores name, description, payroll interval
3. Add employees → set wallet, role, token, payment type (streaming or lump-sum), salary
4. Deposit funds → POL sent as msg.value; ERC-20 auto-approved + transferred
5. Run payroll → contract checks all due employees, validates balances, executes batch
6. Review AI Insights → Claude surfaces anomalies and recommendations
7. View Payment History → all transactions indexed live from chain
```

### Employee Flow
```
1. Navigate to Employee Portal
2. Connect wallet
3. Enter employer's wallet address
4. View salary, payment type, and employment details pulled from contract
5. (Streaming) Watch real-time counter ticking up per second → claim accumulated balance
6. (Lump-Sum) Verify payment history on PolygonScan with transaction proof
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.24, Foundry, OpenZeppelin v5 (ReentrancyGuard, SafeERC20) |
| Blockchain | Polygon Amoy Testnet (chainId 80002) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Web3 | wagmi v2, viem v2, RainbowKit v2 |
| State | @tanstack/react-query v5 |
| AI | Anthropic Claude API (claude-opus-4-6) |
| Event Indexing | viem `getLogs` from deploy block 34567860 |
| Token Prices | CoinGecko API (60s cache) |
| Deployment | Vercel (frontend), Polygon Amoy (contract) |

---

## Running Locally

### Prerequisites
- Node.js 20+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- MetaMask with Polygon Amoy network + testnet POL ([faucet](https://faucet.polygon.technology/))

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in .env.local (see below)
npm run dev
```

**`.env.local` values:**
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id   # cloud.walletconnect.com
NEXT_PUBLIC_CONTRACT_ADDRESS=0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127
NEXT_PUBLIC_POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology/
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Smart Contract (re-deploy)

```bash
cd contracts
cp .env.example .env
# Add PRIVATE_KEY=0x... and POLYGONSCAN_API_KEY
forge build
forge script script/Deploy.s.sol --rpc-url https://rpc-amoy.polygon.technology/ --broadcast
```

---

## Supported Tokens (Amoy Testnet)

| Symbol | Address | Decimals |
|--------|---------|---------|
| POL (native) | `0x0000000000000000000000000000000000000000` | 18 |
| USDC | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | 6 |
| WMATIC | `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` | 18 |

---

## What Makes This Production-Ready

- **No mocks** — all data comes from live contract reads via wagmi + viem
- **ERC-20 approve flow** — automatically checks allowance, requests approval, then deposits in one UX step
- **NetworkGuard** — enforces Polygon Amoy connection; shows one-click switch button on wrong network
- **Gas price floor** — wagmi configured with 25 Gwei minimum priority fee for Polygon Amoy (prevents 0-tip rejections)
- **Non-custodial architecture** — PolygonPay never holds or controls user funds
- **On-chain proof** — every payment is a PolygonScan-verifiable transaction

---

## Project Structure

```
akindo_polygon/
├── contracts/
│   ├── src/PayrollRegistry.sol      # Core smart contract
│   ├── script/Deploy.s.sol          # Foundry deploy script
│   └── foundry.toml
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── employer/page.tsx    # Employer dashboard
    │   │   ├── employee/page.tsx    # Employee portal
    │   │   └── api/
    │   │       ├── analyze/         # Claude AI route
    │   │       ├── events/          # On-chain event indexer
    │   │       ├── payroll/         # Payroll status checker
    │   │       └── prices/          # CoinGecko price feed
    │   ├── components/
    │   │   ├── NetworkGuard.tsx     # Wrong-network enforcer
    │   │   ├── FundsPanel.tsx       # Deposit/withdraw + ERC-20 approve
    │   │   ├── StreamCounter.tsx    # Real-time per-second counter
    │   │   ├── AIInsights.tsx       # Claude analysis panel
    │   │   └── PaymentHistory.tsx   # On-chain event table
    │   ├── hooks/usePayrollRegistry.ts  # All wagmi contract hooks
    │   └── lib/
    │       ├── wagmi.ts             # Chain config (25 Gwei floor)
    │       └── constants.ts        # Token registry, formatters
    └── package.json
```

---

## What's Next

- **Polygon PoS mainnet** deployment with Gnosis Safe multi-sig for payroll approval
- **Compliance layer** — automated tax report exports, jurisdiction-aware token selection
- **Payroll scheduling** — Chainlink Automation for trustless scheduled execution
- **KYC-gated employee wallets** for regulated businesses
- **Mobile app** — employees claim streaming pay from their phone

---

## Acknowledgements

Built for the [Akindo × Polygon Buildathon](https://app.akindo.io). Powered by Polygon Amoy, Anthropic Claude, and the open-source web3 ecosystem.
