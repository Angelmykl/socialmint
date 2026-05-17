# SocialMint Agent 🌿

**AI-powered social media monetization intelligence, built on Circle's Agent Stack.**

Live at **[socialmint.org](https://socialmint.org)**

---

## What it does

SocialMint Agent analyzes a creator or business owner's social media presence and returns specific, actionable monetization intelligence — products to sell, content ideas that earn, and marketing channels to push harder on.

Every analysis costs **0.50 USDC**, charged automatically from the user's Circle Programmable Wallet. No credit cards. No subscriptions. Pay per insight.

---

## Built on Circle Agent Stack

SocialMint is a live demonstration of **agentic economic activity** — the AI agent autonomously manages wallets, executes USDC micropayments, and delivers economic value, all without manual approval at any step.

### The agentic loop on every analysis:

```
User signs in
    ↓
Circle Programmable Wallet created automatically (Base network)
    ↓
User submits niche + goals
    ↓
Agent checks wallet balance via Circle API
    ↓
Agent charges 0.50 USDC → treasury wallet (Circle transfer API)
    ↓
Agent calls Claude (Anthropic) with monetization prompt
    ↓
AI returns products, content hooks, marketing strategies
    ↓
Results saved to MongoDB · Transaction logged to Circle console
```

No human approves any step. The agent holds funds, makes payment decisions, and settles on-chain in seconds.

---

## Circle Integration

| Feature | Implementation |
|---|---|
| **Wallet creation** | `POST /v1/w3s/developer/wallets` — one wallet per user, created on signup |
| **Balance checks** | `GET /v1/w3s/wallets/{id}/balances` — checked before every analysis |
| **USDC transfers** | `POST /v1/w3s/developer/transactions/transfer` — 0.50 USDC per call |
| **Network** | Base Sepolia (testnet) · Base Mainnet (production-ready) |
| **Wallet type** | SCA (Smart Contract Account) via Developer-Controlled Wallets |
| **Treasury** | Developer-controlled treasury wallet receives all fees |
| **Webhooks** | Configured for `transfers.complete` and `wallets.created` |

All API activity is visible and verifiable in the Circle Developer Console under this account's Wallet Set.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite, deployed on Vercel |
| **Backend** | Node.js + Express, deployed on Railway |
| **Auth** | Clerk (Google OAuth, Email OTP, Web3 wallets) |
| **Payments** | Circle Programmable Wallets API |
| **AI** | Anthropic Claude Sonnet |
| **Database** | MongoDB Atlas (local db.json fallback for dev) |
| **Domain** | socialmint.org |

---

## Key Features

### 🔐 Real social authentication
Clerk handles Google OAuth, email OTP, MetaMask, and Coinbase Wallet. Every user gets a Circle USDC wallet created automatically on first sign-in.

### ◎ Per-call USDC micropayments
0.50 USDC charged per analysis via Circle's transfer API. No subscription model. No friction. The agent handles payment autonomously before calling the AI.

### ✦ AI monetization intelligence
Claude analyzes the user's niche, audience, and goals and returns:
- **Products to sell** — physical, digital, or services with price ranges
- **Content ideas** — hooks, formats, and viral angles
- **Marketing channels** — where to push harder and what tactic to use

### 📋 12 ready-made prompts
Pre-built prompts across Nigerian/African niches, business owners, and creators. First 3 are free — tracked server-side in MongoDB (not localStorage — cannot be bypassed).

### 🔒 Server-side free run enforcement
Free demo limit enforced at the API level. Clearing browser storage, incognito mode, or different devices cannot reset it. Limits are stored per user in MongoDB.

### 📊 Full analysis history
Every paid and free analysis saved permanently. Users can view full results anytime, re-run with one click, or build on previous insights.

---

## Security

- JWT authentication on all API routes
- Free run limits enforced server-side (MongoDB, not browser)
- Circle Entity Secret registered and encrypted per API spec
- Rate limiting on all endpoints
- CORS restricted to production domain
- MongoDB Atlas with IP allowlist

---

## Running locally

```bash
# Clone
git clone https://github.com/Angelmykl/socialmint
cd socialmint

# Backend
cd backend
cp .env.example .env
# Fill in your keys
npm install
node server.js

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

### Environment variables (backend)

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
```

### Environment variables (frontend)

```env
VITE_API_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key
```

---

## Deployment

| Service | Purpose |
|---|---|
| **Railway** | Backend — auto-deploys on GitHub push |
| **Vercel** | Frontend — auto-deploys on GitHub push |
| **MongoDB Atlas** | Database — persistent user data and analysis history |
| **Porkbun** | Domain registrar for socialmint.org |

---

## Circle Grant Category

**Primary: Agentic Economic Activity**

SocialMint Agent demonstrates the full Agent Stack vision at the consumer layer:
- AI agent autonomously provisions Circle wallets on user signup
- Agent checks balances, executes USDC transfers, and settles on Base
- No manual approval at any step of the payment flow
- Targeting emerging market creators (Nigeria/Africa) who have no existing crypto infrastructure

**Secondary: Peer-to-peer payments**

Each analysis is a direct micropayment from user wallet to treasury wallet, settled on Base in seconds.

---

## Live

| | |
|---|---|
| **App** | https://socialmint.org |
| **API health** | https://socialmint-production.up.railway.app/api/health |
| **GitHub** | https://github.com/Angelmykl/socialmint |

---

Built with Circle Agent Stack · Anthropic Claude · MongoDB · Deployed on Railway + Vercel