# SocialMint Agent 🌿

**AI-powered social media monetization intelligence, built on Circle's Agent Stack.**

> Pay-per-inference. Autonomous payments. Zero crypto knowledge required.

Live at **[socialmint.org](https://socialmint.org)** · API: **[health check](https://socialmint-production.up.railway.app/api/health)** · **[GitHub](https://github.com/Angelmykl/socialmint)**

---

## What it does

SocialMint Agent analyzes a creator, business owner, influencer, or digital marketer's social media presence and returns specific, actionable monetization intelligence:

- **📦 Products to sell** — physical, digital, or services with real price ranges tailored to your market
- **🎬 Content ideas** — hooks, formats, and viral angles that convert followers to buyers
- **📣 Marketing channels** — where to push harder and what specific tactic to use

Every analysis costs **0.50 USDC**, charged autonomously from the user's Circle Programmable Wallet on Arc Testnet. No credit cards. No subscriptions. No crypto knowledge needed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        socialmint.org                           │
│                    React + Vite (Vercel)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                    Express API (Railway)                         │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │    Clerk    │    │   MongoDB    │    │  Rate Limiter +    │  │
│  │    Auth     │    │    Atlas     │    │  JWT Middleware    │  │
│  └──────┬──────┘    └──────┬───────┘    └────────────────────┘  │
│         │                 │                                     │
│  ┌──────▼──────────────────▼──────────────────────────────────┐ │
│  │                   /api/auth/login                          │ │
│  │  • Verify Clerk token                                      │ │
│  │  • Create Circle wallet on Arc Testnet (new users)         │ │
│  │  • Auto-fund wallet via Circle Faucet API                  │ │
│  │  • Save user + wallet to MongoDB                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   /api/analyze                             │ │
│  │  1. Check wallet balance → Circle API                      │ │
│  │  2. Charge 0.50 USDC → treasury (Circle transfer API)      │ │
│  │  3. Call Anthropic Claude Sonnet                           │ │
│  │  4. Save analysis + transaction to MongoDB                 │ │
│  │  5. Return results to user                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────┬──────────────────────────┘
               │                       │
┌──────────────▼───────┐  ┌────────────▼──────────────────────────┐
│   Circle Wallets API  │  │         Anthropic Claude API          │
│   Arc Testnet         │  │         claude-sonnet-4-20250514      │
│                       │  └───────────────────────────────────────┘
│  • Wallet creation    │
│  • Balance checks     │  ┌───────────────────────────────────────┐
│  • USDC transfers     │  │         MongoDB Atlas                 │
│  • Faucet auto-fund   │  │                                       │
│  • Webhooks           │  │  • users (wallets, freeRunsUsed)      │
└───────────────────────┘  │  • analyses (full results history)    │
                           │  • transactions (Circle tx ledger)    │
                           └───────────────────────────────────────┘
```

---

## The Agentic Payment Loop

Every time a user clicks **Analyze** this happens autonomously — no human approves any step:

```
User signs in with Google / Email OTP
        ↓
Circle Programmable Wallet auto-created on Arc Testnet
        ↓
Wallet auto-funded via Circle Faucet API (testnet)
        ↓
User submits niche + platform + monetization goals
        ↓
Agent checks wallet balance → GET /v1/w3s/wallets/{id}/balances
        ↓
Balance ≥ 0.50 USDC? → Agent executes transfer
POST /v1/w3s/developer/transactions/transfer
        ↓
Payment confirmed → Anthropic Claude Sonnet called
        ↓
AI returns products, content hooks, marketing strategies
        ↓
Results + transaction saved to MongoDB permanently
        ↓
Treasury wallet receives 0.50 USDC · User sees results
```

---

## Circle Integration

| Circle API | Endpoint | Purpose |
|---|---|---|
| **Wallet creation** | `POST /v1/w3s/developer/wallets` | One SCA wallet per user on signup |
| **Auto-funding** | `POST /v1/faucet/drips` | Auto-fund new wallets on Arc Testnet |
| **Balance checks** | `GET /v1/w3s/wallets/{id}/balances` | Checked before every analysis |
| **USDC transfers** | `POST /v1/w3s/developer/transactions/transfer` | 0.50 USDC per inference call |
| **Entity secret** | `GET /v1/w3s/config/entity/publicKey` | Per-request encryption |
| **Webhooks** | `transfers.complete` · `wallets.created` | Real-time settlement events |

**Network:** Arc Testnet (`ARC-TESTNET`)
**USDC token:** `0x3600000000000000000000000000000000000000`
**Wallet type:** SCA (Smart Contract Account) via Developer-Controlled Wallets
**Wallet Set ID:** `bf6301a4-d50b-5aa1-92ea-e27c575c09cb`
**Treasury:** `0xce67b5c7a1e1e2ef75fad910fa590d97fb046312`

All API activity is verifiable in the Circle Developer Console.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite → Vercel |
| **Backend** | Node.js + Express → Railway |
| **Auth** | Clerk (Google OAuth, Email OTP, MetaMask, Coinbase Wallet) |
| **Payments** | Circle Programmable Wallets (Arc Testnet) |
| **AI** | Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) |
| **Database** | MongoDB Atlas (local `db.json` fallback for dev) |
| **Domain** | socialmint.org (Porkbun + Vercel) |

---

## Key Features

### 🔐 Real social authentication
Clerk handles Google OAuth, Email OTP, MetaMask, and Coinbase Wallet. Every user gets a Circle USDC wallet created automatically on first sign-in. No seed phrases. No crypto knowledge needed.

### ◎ Autonomous per-call micropayments
0.50 USDC charged per analysis via Circle's transfer API. The agent checks balance, executes payment, and calls Claude — all autonomously before returning results.

### ✦ AI monetization intelligence
Claude analyzes niche, audience, platform, and goals and returns platform-specific, market-aware recommendations priced in local currency context.

### 📋 12 ready-made prompts
Pre-built prompts across Nigerian/African niches, business owners, and creators. First 3 are free — tracked server-side in MongoDB.

### 🔒 Server-side security
Free demo limit enforced at the API level. Clearing browser storage, incognito mode, or different devices cannot reset free runs — stored per user in MongoDB.

### 📊 Permanent analysis history
Every paid and free analysis saved permanently. View full results anytime, run again with one click, build on previous insights.

### 💧 Auto-funding on signup
New users on Arc Testnet are auto-funded via Circle Faucet API on wallet creation — they can use the app immediately without visiting the faucet manually.

---

## Unit Economics

| | Per call |
|---|---|
| **User pays** | 0.50 USDC |
| **Anthropic API cost** | ~0.008 USDC |
| **Gross margin** | ~98.4% |
| **$5 API credit covers** | ~625 analysis calls |
| **Revenue at 1,000 users × 5 analyses/month** | 2,500 USDC/month |

The micropayment model is economically viable precisely because USDC on Arc settles at negligible cost — traditional payment rails (Stripe, PayPal) would consume the entire margin in fees at this price point.

---

## Security

- JWT authentication on all API routes
- Free run limits enforced server-side (MongoDB, not browser)
- Circle Entity Secret registered and encrypted per Circle spec
- Rate limiting on all endpoints (`express-rate-limit`)
- CORS restricted to production domain (`socialmint.org`)
- MongoDB Atlas with IP allowlist
- Environment variables never committed (`.gitignore`)

---

## Network Configuration

SocialMint uses a single environment variable to switch networks:

| Variable | Value | Network |
|---|---|---|
| *(default)* | — | Base Sepolia testnet |
| `USE_ARC=true` | `true` | **Arc Testnet** (current) |
| `USE_MAINNET=true` | `true` | Base Mainnet |

Switching to mainnet requires only setting `USE_MAINNET=true` in Railway and creating a new mainnet treasury wallet via `node setup.js`.

---

## Running Locally

```bash
# Clone
git clone https://github.com/Angelmykl/socialmint
cd socialmint

# Backend
cd backend
cp .env.example .env
# Fill in your keys (see below)
npm install
node server.js

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

### Backend `.env`

```env
CIRCLE_API_KEY=TEST_API_KEY:your-key-id:your-key-secret
ENTITY_SECRET=your-64-char-hex
CIRCLE_WALLET_SET_ID=your-wallet-set-id
CIRCLE_TREASURY_WALLET_ID=your-treasury-wallet-id
CIRCLE_TREASURY_ADDRESS=0xYourTreasuryAddress
ANTHROPIC_API_KEY=sk-ant-your-key
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
USE_ARC=true
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key
```

### Generate Entity Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Register the output in Circle Console → Keys → Entity Secret.

### Create Treasury Wallet

```bash
node setup.js
```

---

## Deployment

| Service | Purpose | Config |
|---|---|---|
| **Railway** | Backend | Root dir: `socialmint/backend` |
| **Vercel** | Frontend | Root dir: `socialmint/frontend` |
| **MongoDB Atlas** | Database | IP allowlist: `0.0.0.0/0` |
| **Clerk** | Auth | Production instance, domain: `socialmint.org` |
| **Porkbun** | Domain | DNS → Vercel + Clerk CNAMEs |

---

## Circle Grant Category

**Primary: Agentic Economic Activity**

SocialMint demonstrates the Agent Stack vision at the consumer layer:
- AI agent autonomously provisions Circle wallets on user signup
- Agent checks balances and executes USDC transfers without human approval
- Pay-per-inference model: 0.50 USDC per Claude call, settled on Arc
- Targeting non-crypto-native users (creators, marketers, business owners) globally

**Secondary: Peer-to-peer payments**

Each analysis is a direct micropayment from user wallet to treasury wallet, settled on Arc in seconds.

---

## Roadmap

SocialMint Agent is built in phases — starting with AI monetization intelligence and expanding into a full financial intelligence platform for creators.

### ✅ Phase 1 — AI Monetization Intelligence (Live)
- Pay-per-inference AI analysis at 0.50 USDC per call
- Circle Programmable Wallets on Arc Testnet
- Google OAuth + Email OTP via Clerk
- 12 ready-made prompts for creators and business owners
- Server-side free run enforcement via MongoDB
- Full analysis history with View + Run again
- Auto-funding new user wallets on signup

### 🔄 Phase 2 — Mainnet Launch
- Switch to Arc Mainnet (`USE_MAINNET=true`)
- Real USDC payments from real users
- Facebook and Twitter OAuth
- Circle Webhooks for real-time settlement (replacing polling)
- Mobile-responsive polish

### 🗺️ Phase 3 — SocialMint Agent Trade
The next major feature: an autonomous trading agent that works 24/7 on behalf of users — even when they are offline.

**How it works:**

```
User opens Agent Trade
        ↓
Agent scans market → returns top 5-10 low-cap tokens
(market cap, volume, holder count, rug risk indicators)
        ↓
User sets buy condition:
"Buy 5 USDC of [token] when market cap drops to $500k"
        ↓
User sets sell condition:
"Sell when market cap reaches $2M"
        ↓
Agent monitors 24/7 via Circle Programmable Wallet
        ↓
Condition met → Agent executes trade autonomously
        ↓
Fee charged per execution (buy + sell) via USDC
Scanning is always free
```

**Key features:**
- Autonomous 24/7 execution — agent trades while user is offline
- AI-powered rug screening — flags unverified contracts, unlocked liquidity, whale concentration
- Limit order logic — buy low, sell high, set and forget
- Per-trade fee model — charged on execution, not subscription
- Full trade history — PnL per position, total agent fees, performance tracking

**Multi-chain support via Circle Unified Balance:**

Agent Trade will leverage **Circle's Unified Balance Kit** to let users fund their trading wallet from any supported chain — no manual bridging, no network switching. One USDC balance, accessible everywhere. This makes the product accessible to creators who hold USDC on Base, Ethereum, Arbitrum, or any other Circle-supported chain.

```
User USDC on Base / Ethereum / Arbitrum
        ↓
Circle Unified Balance Kit aggregates liquidity
        ↓
Agent executes trades on Arc using unified balance
        ↓
Settlement in USDC across chains seamlessly
```

### 🔮 Phase 4 — Creator Finance Suite
- **SocialMint Prediction Agent** — autonomous agent that monitors prediction markets (crypto prices, sports, politics, tech) and places bets on behalf of users using their Circle wallet. User sets conditions, agent executes 24/7. Winnings returned to Circle wallet automatically. Powered by Arc smart contracts for escrow + settlement and Circle Programmable Wallets for custody.
- **SocialMint Yield** — idle USDC in wallets earns yield via Circle's USYC
- **SocialMint Pay** — creators accept USDC payments from fans directly via their SocialMint wallet
- **SocialMint Analytics** — cross-platform performance dashboard with monetization scoring
- **Agent Marketplace** — community-built analysis prompts, buy/sell with USDC

---



| | |
|---|---|
| **Live app** | https://socialmint.org |
| **API health** | https://socialmint-production.up.railway.app/api/health |
| **GitHub** | https://github.com/Angelmykl/socialmint |
| **Circle console** | console.circle.com (Testnet → Wallets → Wallet Set `bf6301a4`) |

---

*Built with Circle Agent Stack · Anthropic Claude · MongoDB · Deployed on Railway + Vercel · Running on Arc Testnet*