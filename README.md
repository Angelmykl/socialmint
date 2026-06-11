# SocialMint Agent

**AI-powered social media monetization intelligence, built on Circle's Agent Stack.**

Pay-per-inference. Autonomous payments. Zero crypto knowledge required.

Live at **[socialmint.org](https://socialmint.org)** · API: **[health check](https://socialmint-production.up.railway.app/api/health)** · **[GitHub](https://github.com/Angelmykl/socialmint)**

---

## What it does

SocialMint Agent analyzes a creator, business owner, influencer, or digital marketer's social media presence and returns specific, actionable monetization intelligence:

- Products to sell — physical, digital, or services with real price ranges tailored to your market
- Content ideas — hooks, formats, and viral angles that convert followers to buyers
- Marketing channels — where to push harder and what specific tactic to use

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
│  │  - Verify Clerk token                                      │ │
│  │  - Create Circle wallet on Arc Testnet (new users)         │ │
│  │  - Auto-fund wallet via Circle Faucet API                  │ │
│  │  - Save user + wallet to MongoDB                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   /api/analyze                             │ │
│  │  1. Check wallet balance via Circle API                    │ │
│  │  2. Charge 0.50 USDC to treasury (Circle transfer API)     │ │
│  │  3. Call Anthropic Claude Sonnet                           │ │
│  │  4. Save analysis + transaction to MongoDB                 │ │
│  │  5. Return results to user                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              /api/predictions (Prediction Agent)           │ │
│  │  - User sets condition once                                │ │
│  │  - Agent monitors BTC, ETH, SOL prices 24/7               │ │
│  │  - Condition met → charges Circle wallet → places bet      │ │
│  │  - Bet settles on Arc Testnet smart contract               │ │
│  │  - House earnings auto-swept to treasury every 24h         │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────┬──────────────────────────┘
               │                       │
┌──────────────▼───────┐  ┌────────────▼──────────────────────────┐
│   Circle Wallets API  │  │         Anthropic Claude API          │
│   Arc Testnet         │  │         claude-sonnet-4-20250514      │
│                       │  └───────────────────────────────────────┘
│  - Wallet creation    │
│  - Balance checks     │  ┌───────────────────────────────────────┐
│  - USDC transfers     │  │         MongoDB Atlas                 │
│  - Faucet auto-fund   │  │                                       │
│  - Webhooks           │  │  - users (wallets, freeRunsUsed)      │
└───────────────────────┘  │  - analyses (full results history)    │
                           │  - transactions (Circle tx ledger)    │
                           │  - conditions (prediction agent)      │
                           │  - bets (settlement history)          │
                           └───────────────────────────────────────┘
```

---

## The Agentic Payment Loop

Every time a user clicks Analyze this happens autonomously — no human approves any step:

```
User signs in with Google / Email OTP
        ↓
Circle Programmable Wallet auto-created on Arc Testnet
        ↓
Wallet auto-funded via Circle Faucet API (testnet)
        ↓
User submits niche + platform + monetization goals
        ↓
Agent checks wallet balance
        ↓
Balance >= 0.50 USDC? Agent executes transfer
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
| Wallet creation | `POST /v1/w3s/developer/wallets` | One SCA wallet per user on signup |
| Auto-funding | `POST /v1/faucet/drips` | Auto-fund new wallets on Arc Testnet |
| Balance checks | `GET /v1/w3s/wallets/{id}/balances` | Checked before every analysis and bet |
| USDC transfers | `POST /v1/w3s/developer/transactions/transfer` | 0.50 USDC per inference, variable per bet |
| Entity secret | `GET /v1/w3s/config/entity/publicKey` | Per-request encryption |
| Webhooks | `transfers.complete` · `wallets.created` | Real-time settlement events |

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
| Frontend | React + Vite → Vercel |
| Backend | Node.js + Express → Railway |
| Auth | Clerk (Google OAuth, Email OTP) |
| Payments | Circle Programmable Wallets (Arc Testnet) |
| AI | Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) |
| Database | MongoDB Atlas (local `db.json` fallback for dev) |
| Smart Contract | Solidity → Arc Testnet |
| Price Data | Binance Public API (no key required) |
| Domain | socialmint.org (Porkbun + Vercel) |

---

## Key Features

- **Real social authentication** — Clerk handles Google OAuth and Email OTP. Every user gets a Circle USDC wallet created automatically on first sign-in. No seed phrases. No crypto knowledge needed.

- **Autonomous per-call micropayments** — 0.50 USDC charged per analysis via Circle's transfer API. The agent checks balance, executes payment, and calls Claude — all autonomously before returning results.

- **AI monetization intelligence** — Claude analyzes niche, audience, platform, and goals and returns platform-specific, market-aware recommendations priced in local currency context.

- **12 ready-made prompts** — Pre-built prompts across Nigerian and African niches, business owners, and creators. First 3 are free — tracked server-side in MongoDB.

- **Server-side security** — Free demo limit enforced at the API level. Clearing browser storage, incognito mode, or different devices cannot reset free runs — stored per user in MongoDB.

- **Permanent analysis history** — Every paid and free analysis saved permanently. View full results anytime, run again with one click, build on previous insights.

- **Auto-funding on signup** — New users on Arc Testnet are auto-funded via Circle Faucet API on wallet creation — they can use the app immediately without visiting the faucet manually.

---

## Prediction Agent (Phase 2 — Beta)

The Prediction Agent is an autonomous on-chain betting agent built on top of Circle's Agent Stack and Arc Testnet.

**Contract address:** `0xdc7505d03392d59D700035A5fcEceb341A78B34f`  
**Network:** Arc Testnet  
**Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)

### How it works

The user sets a condition once and the agent monitors BTC, ETH, and SOL prices 24/7 from Binance — even while they are offline. When the condition is met the agent fires automatically.

```
User sets condition:
"If ETH rises by 0.3% → bet it continues rising in 5 min"
        ↓
Agent monitors prices every 10 seconds
        ↓
Condition met → charges user's Circle wallet
        ↓
Agent places bet on-chain via Arc smart contract
        ↓
Timeframe expires → agent checks price → settles bet
        ↓
Win: 1.70x paid from contract balance
Loss: USDC moves to house balance
        ↓
Every 24h → house balance auto-swept to Circle treasury
```

### Bet mechanics

- Bets are sequential — Bet 1 settles before Bet 2 fires
- Up to 10 sequential bets per condition
- Max loss protection — after 3 consecutive losses the agent enters a cooldown, resets the counter, and resumes automatically when the condition triggers again
- Auto-reactivate — optionally restarts the entire condition from bet 1 after all bets complete
- Max 3 active conditions per user at any time

### Money flow

```
User places bet → USDC locked in contractBalance
User loses      → USDC moves to houseBalance
User wins       → 1.70x paid from contractBalance
Every 24h       → houseBalance swept to Circle treasury
```

The `contractBalance` is never touched for sweeps — only confirmed profit (`houseBalance`) moves to treasury. Winners are always paid.

### Revenue from Prediction Agent

- Win payout: 1.70x (net 1.5725 USDC per 1 USDC bet after 7.5% house fee)
- Target win rate: ~60% (tuned via price movement thresholds)
- House margin: ~5.65% per 100 bets

Both revenue streams flow into one Circle treasury automatically:

- AI analysis fee — 0.50 USDC per run
- Prediction house earnings — 7.5% fee on wins + all losing bets

### Supported assets

BTC, ETH, SOL — prices fetched from Binance Public API every 10 seconds.

### Outcome types

| Trigger | Outcomes available |
|---------|-------------------|
| Price drops | Recovers, Continues dropping, Reverses hard, Stays flat |
| Price rises | Continues rising, Reverses, Surges hard, Stays flat |

---

## Unit Economics

### AI Analysis

| | Per call |
|---|---|
| User pays | 0.50 USDC |
| Anthropic API cost | ~0.008 USDC |
| Gross margin | ~98.4% |
| Revenue at 1,000 users x 5 analyses/month | 2,500 USDC/month |

### Prediction Agent (per 100 bets at 1 USDC each)

| | Amount |
|---|---|
| Total collected | 100 USDC |
| Paid to winners (60% win rate x 1.5725) | 94.35 USDC |
| House profit | 5.65 USDC |
| Margin | 5.65% |

---

## Security

- JWT authentication on all API routes
- Free run limits enforced server-side (MongoDB, not browser)
- Circle Entity Secret registered and encrypted per Circle spec
- Rate limiting on all endpoints (`express-rate-limit`)
- CORS restricted to production domain (`socialmint.org`)
- MongoDB Atlas with IP allowlist
- Environment variables never committed (`.gitignore`)
- Max 3 concurrent prediction conditions per user
- Agent wallet private key stored as environment variable only

---

## Network Configuration

SocialMint uses a single environment variable to switch networks:

| Variable | Value | Network |
|---|---|---|
| *(default)* | — | Base Sepolia testnet |
| `USE_ARC=true` | `true` | Arc Testnet (current) |
| `USE_MAINNET=true` | `true` | Base Mainnet |

---

## Running Locally

```bash
# Clone
git clone https://github.com/Angelmykl/socialmint
cd socialmint

# Backend
cd backend
cp .env.example .env
# Fill in your keys
npm install
npm run dev

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
AGENT_PRIVATE_KEY=0x...
PREDICTION_CONTRACT_ADDRESS=0xdc7505d03392d59D700035A5fcEceb341A78B34f
ARC_RPC_URL=https://rpc.testnet.arc.network
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key
```

---

## Deployment

| Service | Purpose | Config |
|---|---|---|
| Railway | Backend | Root dir: `socialmint/backend` |
| Vercel | Frontend | Root dir: `socialmint/frontend` |
| MongoDB Atlas | Database | IP allowlist: `0.0.0.0/0` |
| Clerk | Auth | Production instance, domain: `socialmint.org` |
| Porkbun | Domain | DNS → Vercel + Clerk CNAMEs |

---

## Roadmap

### Phase 1 — AI Monetization Intelligence (Live)

- Pay-per-inference AI analysis at 0.50 USDC per call
- Circle Programmable Wallets on Arc Testnet
- Google OAuth + Email OTP via Clerk
- 12 ready-made prompts for creators and business owners
- Server-side free run enforcement via MongoDB
- Full analysis history with view and run again
- Auto-funding new user wallets on signup

### Phase 2 — Prediction Agent (Beta)

- Autonomous on-chain betting agent running 24/7
- User sets condition once — agent monitors prices and bets while they sleep
- Sequential bets with max loss protection and auto-reactivate
- Real USDC flow from user Circle wallet to agent to contract
- User address recorded on-chain for full verifiability
- House earnings auto-swept to Circle treasury every 24h
- Arc Testnet smart contract deployed and live
- Contract: `0xdc7505d03392d59D700035A5fcEceb341A78B34f`

### Phase 3 — Mainnet Launch

- Switch to Arc Mainnet
- Real USDC payments from real users
- Facebook and Twitter OAuth
- Circle Webhooks for real-time settlement
- Mobile app (iOS and Android)
- Push notifications for bet results and condition triggers

### Phase 4 — Agent Trade

The next major autonomous agent: monitors low-cap tokens, screens for rug risk, and executes trades 24/7 on behalf of users.

```
User sets condition:
"Buy 5 USDC of [token] when market cap drops to $500k"
"Sell when market cap reaches $2M"
        ↓
Agent monitors 24/7 via Circle Programmable Wallet
        ↓
Condition met → Agent executes trade autonomously
        ↓
Fee charged per execution via USDC
```

Key features:
- Autonomous 24/7 execution — agent trades while user is offline
- AI-powered rug screening — flags unverified contracts, unlocked liquidity, whale concentration
- Limit order logic — buy low, sell high, set and forget
- Per-trade fee model — charged on execution, not subscription
- Full trade history — PnL per position, total agent fees, performance tracking
- Circle Unified Balance Kit — fund from any supported chain, no manual bridging

---

| | |
|---|---|
| Live app | https://socialmint.org |
| API health | https://socialmint-production.up.railway.app/api/health |
| GitHub | https://github.com/Angelmykl/socialmint |
| Circle console | console.circle.com (Testnet → Wallets → Wallet Set `bf6301a4`) |
| Prediction contract | https://testnet.arcscan.app/address/0xdc7505d03392d59D700035A5fcEceb341A78B34f |

---

*Built with Circle Agent Stack · Anthropic Claude · MongoDB · Deployed on Railway + Vercel · Running on Arc Testnet*