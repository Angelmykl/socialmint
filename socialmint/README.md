# SocialMint Agent 💡

> AI-powered social media monetization intelligence — charged per-call in USDC via Circle

---

## What you need to go live (full checklist)

### Accounts to create (all free)
- [ ] **Circle** → https://console.circle.com (free, no credit card)
- [ ] **MongoDB Atlas** → https://mongodb.com/atlas (free 512MB tier)
- [ ] **Anthropic** → https://console.anthropic.com (paid per use — ~$0.003/call)
- [ ] **Railway** → https://railway.app (deploy backend, free tier available)
- [ ] **Vercel** → https://vercel.com (deploy frontend, completely free)

That's it. 5 accounts. No server to buy, no DevOps knowledge needed.

---

## Project structure

```
socialmint/
├── backend/                  ← Node.js + Express API
│   ├── server.js             ← All routes (login, analyze, webhook)
│   ├── circle.js             ← Circle USDC payment functions
│   ├── setup.js              ← Run once to create your treasury wallet
│   ├── models/
│   │   └── User.js           ← MongoDB user schema (permanent storage)
│   ├── middleware/
│   │   ├── auth.js           ← JWT wristband checker
│   │   └── rateLimiter.js    ← Abuse protection (bouncer)
│   ├── package.json
│   └── .env.example          ← Copy to .env and fill in
│
├── frontend/                 ← React + Vite app
│   ├── src/
│   │   ├── main.jsx          ← Entry point
│   │   └── App.jsx           ← Full UI (login, wallet, analyze, results)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example          ← Copy to .env and fill in
│
├── .gitignore
└── README.md
```

---

## Step-by-step launch guide

### Step 1 — Clone and install

```bash
git clone https://github.com/yourusername/socialmint.git
cd socialmint

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Step 2 — Set up MongoDB (free)

1. Go to https://mongodb.com/atlas → click "Try Free"
2. Sign up → create a project → create a cluster → choose **Free (M0)**
3. Create a database user (save the username + password)
4. Click Connect → Connect your application → copy the connection string
5. Replace `<password>` in the string with your password

### Step 3 — Set up Circle (free)

1. Go to https://console.circle.com → sign up free
2. Create an app → go to **Developer → API Keys** → create a key → copy it
3. Go to **Wallets → Wallet Sets** → create one → copy the ID

### Step 4 — Configure backend

```bash
cd backend
cp .env.example .env
# Open .env and fill in:
#   CIRCLE_API_KEY
#   CIRCLE_WALLET_SET_ID
#   MONGODB_URI
#   ANTHROPIC_API_KEY
#   JWT_SECRET (generate below)
```

Generate your JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 5 — Create your treasury wallet (ONE TIME)

```bash
cd backend
npm run setup
# Copy the output values into your .env file
# This is the wallet that collects all 0.50 USDC fees
```

### Step 6 — Run locally

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173 — the app is running!

---

### Step 7 — Deploy backend to Railway

1. Go to https://railway.app → sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo → select the **backend** folder as root
4. Go to **Variables** → add all your `.env` values
5. Railway gives you a URL like `https://socialmint-backend.railway.app`
6. Set up Circle webhook: console.circle.com → Notifications → add `https://your-backend.railway.app/api/webhooks/circle`

### Step 8 — Deploy frontend to Vercel

1. Go to https://vercel.com → sign up with GitHub
2. Click **New Project → Import** your repo
3. Set **Root Directory** to `frontend`
4. Add environment variable: `VITE_API_URL` = your Railway backend URL
5. Click Deploy → Vercel gives you a live URL

**Your app is live.** Share the Vercel URL with users.

---

## How money flows (no smart contract needed)

```
User logs in (Google / Twitter / Wallet)
        ↓
Backend calls Circle API → creates USDC wallet for user
        ↓
User funds their wallet (sends USDC to their wallet address)
        ↓
User clicks "Pay 0.50 USDC & Analyze"
        ↓
Backend calls Circle API → transfers 0.50 USDC:
    user wallet ──────────────────────▶ your treasury wallet
        ↓
Anthropic API called → analysis generated
        ↓
Result returned to user
```

Every transaction is logged in your Circle developer dashboard.

---

## Revenue projection

| Daily calls | Monthly revenue | Monthly costs | Monthly profit |
|---|---|---|---|
| 50 | $750 | ~$5 (API) | ~$745 |
| 500 | $7,500 | ~$50 (API) | ~$7,450 |
| 5,000 | $75,000 | ~$500 (API) | ~$74,500 |

---

## Grant submission to Circle

Apply at: https://circle.com/grant

Key things to mention:
- Built on Circle Programmable Wallets API
- USDC on Base (with Arc roadmap when mainnet launches)
- Real per-call micropayments using Circle Agent Stack model
- Targeting emerging markets (Nigeria, Africa, LATAM) — underserved audience
- Trackable via your Circle developer dashboard (wallet creations + transfer volume)
