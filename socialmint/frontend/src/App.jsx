import { useState, useEffect } from "react";
import { useClerk, useUser, SignIn } from "@clerk/clerk-react";

const API  = import.meta.env.VITE_API_URL || "http://localhost:4000";
const COST = 0.50;

// ── Brand new color palette — deep navy + electric mint ───────────────────────
const C = {
  // Sidebar — deep navy blue (nothing like Veilarc's brown)
  side:        "#0B1121",
  sideHover:   "#131E35",
  sideBorder:  "#1A2740",
  sideMuted:   "#4A6080",
  sideText:    "#F0F4FF",
  sideSubtext: "#8BA3C4",

  // Main — clean white with cool grey tint
  canvas:      "#F4F6FB",
  surface:     "#FFFFFF",
  surfaceAlt:  "#EEF1F8",
  border:      "#E2E7F0",
  borderStrong:"#C8D0E0",

  // Typography
  ink:         "#0D1526",
  inkSub:      "#3D526E",
  inkMuted:    "#8BA3C4",

  // Accent — electric mint green (USDC / money vibes)
  mint:        "#00C896",
  mintDark:    "#00A87E",
  mintBg:      "#E6FAF4",
  mintText:    "#006B52",
  mintBorder:  "#00C89640",

  // Semantic
  green:       "#10B981",
  greenBg:     "#ECFDF5",
  greenText:   "#065F46",
  greenBorder: "#6EE7B7",
  red:         "#EF4444",
  redBg:       "#FEF2F2",
  blue:        "#3B82F6",
  blueBg:      "#EFF6FF",
  blueText:    "#1D4ED8",
  purple:      "#8B5CF6",
  purpleBg:    "#F5F3FF",
  purpleText:  "#5B21B6",

  // CTA
  cta:        "#00C896",
  ctaText:    "#FFFFFF",
  ctaDark:    "#00A87E",
};

// ── Social platform logos as SVG components ───────────────────────────────────
const PLATFORM_ICONS = {
  Instagram: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="50%" stopColor="#DD2A7B"/>
          <stop offset="100%" stopColor="#515BD4"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig)"/>
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1" fill="white"/>
    </svg>
  ),
  TikTok: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#010101"/>
      <path d="M16.5 5C16.7 6.5 17.6 7.8 19 8.3V11C18 11 17 10.7 16.2 10.2V15C16.2 17.8 14 20 11.1 20C8.2 20 6 17.8 6 15C6 12.2 8.2 10 11.1 10C11.3 10 11.5 10 11.7 10.1V13.2C11.5 13.1 11.3 13.1 11.1 13.1C9.9 13.1 9 14 9 15.1C9 16.2 9.9 17.1 11.1 17.1C12.3 17.1 13.2 16.2 13.2 15.1V5H16.5Z" fill="white"/>
      <path d="M16.5 5C16.7 6.5 17.6 7.8 19 8.3" stroke="#FE2C55" strokeWidth="0.5"/>
    </svg>
  ),
  "X / Twitter": ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#000000"/>
      <path d="M18 5L13.2 10.5L18.5 18H14.8L11.5 13.5L7.5 18H5L10.1 12.2L5 5H8.8L11.8 9.2L15.5 5H18ZM15 16.5L7.5 6.5H9L16.5 16.5H15Z" fill="white"/>
    </svg>
  ),
  YouTube: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#FF0000"/>
      <path d="M20.5 8C20.3 7.2 19.6 6.6 18.8 6.4C17.3 6 12 6 12 6C12 6 6.7 6 5.2 6.4C4.4 6.6 3.7 7.2 3.5 8C3.2 9.4 3 12 3 12C3 12 3.2 14.6 3.5 16C3.7 16.8 4.4 17.4 5.2 17.6C6.7 18 12 18 12 18C12 18 17.3 18 18.8 17.6C19.6 17.4 20.3 16.8 20.5 16C20.8 14.6 21 12 21 12C21 12 20.8 9.4 20.5 8Z" fill="#FF0000"/>
      <path d="M10 15L15.2 12L10 9V15Z" fill="white"/>
    </svg>
  ),
  LinkedIn: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#0A66C2"/>
      <path d="M7 9H9.5V17H7V9ZM8.25 8C7.56 8 7 7.44 7 6.75C7 6.06 7.56 5.5 8.25 5.5C8.94 5.5 9.5 6.06 9.5 6.75C9.5 7.44 8.94 8 8.25 8ZM17 17H14.5V13C14.5 12.17 13.83 11.5 13 11.5C12.17 11.5 11.5 12.17 11.5 13V17H9V9H11.5V10.1C12 9.4 12.9 9 13.9 9C15.6 9 17 10.4 17 12.1V17Z" fill="white"/>
    </svg>
  ),
  Facebook: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#1877F2"/>
      <path d="M16 8H13.5C13.2 8 13 8.2 13 8.5V10.5H16L15.6 13H13V20H10.5V13H8.5V10.5H10.5V8.5C10.5 7 11.5 6 13 6H16V8Z" fill="white"/>
    </svg>
  ),
};

// ── App brand logo — mosaic of 6 social platform icons ────────────────────────
function BrandLogo({ size = 36 }) {
  const platforms = ["Instagram", "TikTok", "X / Twitter", "YouTube", "LinkedIn", "Facebook"];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      gridTemplateRows: "1fr 1fr", gap: 1.5,
      overflow: "hidden", flexShrink: 0,
      background: C.side,
    }}>
      {platforms.map((p, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          background: C.sideHover,
        }}>
          {(() => { const Icon = PLATFORM_ICONS[p]; return <Icon size={size * 0.28} />; })()}
        </div>
      ))}
    </div>
  );
}

const PLATFORMS = [
  "Instagram", "TikTok", "X / Twitter", "YouTube", "LinkedIn", "Facebook"
];

const SOCIAL_PROVIDERS = [
  { id: "google",   label: "Google",      letter: "G", color: "#EA4335", bg: "#FEF2F2" },
  { id: "twitter",  label: "X / Twitter", letter: "𝕏", color: "#0F172A", bg: "#F1F5F9" },
  { id: "facebook", label: "Facebook",    letter: "f", color: "#1877F2", bg: "#EFF6FF" },
];

const WALLETS = [
  { id: "metamask",      label: "MetaMask",       emoji: "🦊" },
  { id: "walletconnect", label: "WalletConnect",   emoji: "🔗" },
  { id: "coinbase",      label: "Coinbase Wallet", emoji: "🔵" },
];

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Spinner({ size = 16, dark = false }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${dark ? C.border : "rgba(255,255,255,0.3)"}`,
      borderTopColor: dark ? C.mint : "#fff",
      animation: "spin 0.7s linear infinite",
      display: "inline-block", flexShrink: 0,
    }} />
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const { isSignedIn, user } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (isSignedIn && user && !syncing) {
      setSyncing(true);
      handleClerkUser(user);
    }
  }, [isSignedIn, user]);

  async function handleClerkUser(clerkUser) {
    try {
      const provider = clerkUser.externalAccounts?.[0]?.provider || "email";
      const userId   = `clerk_${clerkUser.id}`;
      const name     = clerkUser.fullName || clerkUser.firstName || clerkUser.emailAddresses?.[0]?.emailAddress || "User";
      const email    = clerkUser.primaryEmailAddress?.emailAddress || "";
      const res  = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, provider, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("sm_token", data.token);
      localStorage.setItem("sm_user",  JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
      setSyncing(false);
    }
  }

  if (syncing) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${C.side} 0%, #0D1E3D 100%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <BrandLogo size={56} />
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, marginTop: 8 }}>Setting up your wallet...</div>
        <div style={{ color: C.sideSubtext, fontSize: 13 }}>Creating your Circle USDC wallet</div>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${C.side} 0%, #0D1E3D 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "2rem 1rem", fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          <BrandLogo size={64} />
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.5px" }}>
              SocialMint Agent
            </div>
            <div style={{ fontSize: 13, color: C.sideSubtext, marginTop: 4 }}>
              AI-powered monetization intelligence
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: C.redBg, color: C.red, borderRadius: 8, padding: "8px 16px", fontSize: 13, marginBottom: 16, width: "100%" }}>
            ⚠ {error}
          </div>
        )}

        <SignIn
          appearance={{
            elements: {
              rootBox: { width: "100%" },
              card: {
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                backdropFilter: "blur(20px)",
              },
              headerTitle: { color: "#ffffff" },
              headerSubtitle: { color: C.sideSubtext },
              socialButtonsBlockButton: {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
              },
              formFieldLabel: { color: C.sideSubtext },
              formFieldInput: {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
              },
              footerActionText: { color: C.sideSubtext },
              footerActionLink: { color: C.mint },
            },
          }}
        />

        <div style={{ fontSize: 11, color: C.sideMuted, marginTop: "1.5rem", textAlign: "center", lineHeight: 1.6 }}>
          Powered by Circle Agent Stack · USDC on Base
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick, badge }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "9px 12px", borderRadius: 8,
        border: "none", cursor: "pointer", fontFamily: "inherit",
        background: active ? "rgba(0,200,150,0.12)" : hov ? C.sideHover : "transparent",
        color: active ? C.mint : C.sideSubtext,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: "all 0.12s", textAlign: "left",
        borderLeft: active ? `2px solid ${C.mint}` : "2px solid transparent",
      }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
          background: C.mint, color: "#fff",
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, accent }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 140,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent || C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 3, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkMuted }}>{sub}</div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [page, setPage]           = useState("analyze");
  const [balance, setBalance]     = useState(user.balance || 0);
  const [platform, setPlatform]   = useState("Instagram");
  const [goals, setGoals]         = useState(new Set(["products"]));
  const [niche, setNiche]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [resultTab, setResultTab] = useState("products");
  const [error, setError]         = useState("");
  const [txHistory, setTxHistory] = useState([]);
  const [totalAnalyses, setTotalAnalyses] = useState(user.totalAnalyses || 0);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile]   = useState(window.innerWidth < 768);
  const [freeRunsUsed, setFreeRunsUsed] = useState(user.freeRunsUsed || 0);
  const FREE_LIMIT = 3;

  const DEMO_PROMPTS = [
    // 🇳🇬 Nigeria / Africa
    { id:1, category:"🇳🇬 Nigeria & Africa", platform:"Instagram", goals:["products","content"], color:"#E91E8C", colorBg:"#FDE8F4",
      title:"Fitness page for Nigerian moms", icon:"💪",
      niche:"I run a fitness Instagram page for busy Nigerian moms aged 25–45. I post 15-minute home workout videos and healthy Nigerian meal prep tips. I have 8,000 followers and get great engagement on Reels. Based in Lagos." },
    { id:2, category:"🇳🇬 Nigeria & Africa", platform:"TikTok", goals:["content","marketing"], color:"#010101", colorBg:"#F0F0F0",
      title:"Lagos street food vendor", icon:"🍔",
      niche:"I sell suya, puff puff and jollof rice from my food cart in Lagos Island. I just started a TikTok account showing how I cook and the crowd reactions. I have 1,200 followers after just 2 weeks and my videos keep going viral." },
    { id:3, category:"🇳🇬 Nigeria & Africa", platform:"Instagram", goals:["products","marketing"], color:"#E91E8C", colorBg:"#FDE8F4",
      title:"Ankara fashion boutique", icon:"👗",
      niche:"I own a small Ankara and Aso-oke fashion boutique in Abuja. I post outfit photos and styling videos on Instagram. My customers are mainly working-class Nigerian women aged 28–45. I have 5,500 followers and want to sell more online." },
    { id:4, category:"🇳🇬 Nigeria & Africa", platform:"TikTok", goals:["content","products"], color:"#010101", colorBg:"#F0F0F0",
      title:"Nigerian comedy skit creator", icon:"😂",
      niche:"I make Nigerian comedy skits on TikTok poking fun at office life, Lagos traffic, and Nigerian parents. I have 45,000 followers and my videos regularly hit 200k+ views. I want to know how to make real money from this." },

    // 💼 Business Owners
    { id:5, category:"💼 Business Owners", platform:"Facebook", goals:["marketing","products"], color:"#1877F2", colorBg:"#EBF3FE",
      title:"Hair salon owner in Abuja", icon:"💇",
      niche:"I run a hair and beauty salon in Abuja called GlowUp Studio. I post before/after photos on Facebook and have 3,200 page likes. My clients are professional women. I want more bookings and to sell hair products online." },
    { id:6, category:"💼 Business Owners", platform:"LinkedIn", goals:["marketing","content"], color:"#0A66C2", colorBg:"#E8F3FB",
      title:"Freelance graphic designer", icon:"🎨",
      niche:"I am a freelance graphic designer and brand identity consultant based in Lagos. I have 2,800 LinkedIn connections and post design tips and case studies. My target clients are Nigerian startups and SMEs needing brand identity work." },
    { id:7, category:"💼 Business Owners", platform:"Instagram", goals:["products","content"], color:"#E91E8C", colorBg:"#FDE8F4",
      title:"Handmade skincare brand", icon:"🧴",
      niche:"I make and sell natural African black soap, shea butter and skincare products from home in Port Harcourt. I have an Instagram page with 6,000 followers. Most of my customers are Nigerian women who want chemical-free skincare." },
    { id:8, category:"💼 Business Owners", platform:"X / Twitter", goals:["marketing","content"], color:"#000000", colorBg:"#F0F0F0",
      title:"Dropshipping business", icon:"📦",
      niche:"I run a dropshipping business selling electronics accessories, phone cases and smart gadgets targeted at Nigerian youth. I use X/Twitter to promote and have 4,100 followers. I want more traffic to my website and more sales." },

    // 🎨 Creators
    { id:9, category:"🎨 Creators", platform:"YouTube", goals:["products","content"], color:"#FF0000", colorBg:"#FFEBEB",
      title:"Nigerian food vlogger", icon:"🍳",
      niche:"I run a YouTube channel teaching people how to cook authentic Nigerian dishes like egusi soup, jollof rice and pepper soup. I have 22,000 subscribers. My audience is Nigerians in diaspora and food lovers globally who want to cook African food." },
    { id:10, category:"🎨 Creators", platform:"TikTok", goals:["content","marketing"], color:"#010101", colorBg:"#F0F0F0",
      title:"Gen Z personal finance creator", icon:"💰",
      niche:"I make TikTok videos about personal finance, saving money and investing for Nigerian Gen Z aged 18–26. I have 31,000 followers and my content about saving on a low income gets the most views. I want to monetize my knowledge." },
    { id:11, category:"🎨 Creators", platform:"YouTube", goals:["products","marketing"], color:"#FF0000", colorBg:"#FFEBEB",
      title:"African travel vlogger", icon:"✈️",
      niche:"I vlog about travelling across Africa on a budget — I have visited 18 African countries and document everything on YouTube. I have 14,000 subscribers and my audience is young African professionals who want to explore the continent." },
    { id:12, category:"🎨 Creators", platform:"LinkedIn", goals:["products","content"], color:"#0A66C2", colorBg:"#E8F3FB",
      title:"Tech career coach", icon:"💻",
      niche:"I help young Nigerians break into tech without a CS degree. I post career advice, roadmaps and success stories on LinkedIn. I have 8,500 followers and my audience is recent graduates and career switchers wanting to get into software or data." },
  ];

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Fetch saved analyses history from backend
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [viewingAnalysis, setViewingAnalysis] = useState(null);
  const [viewTab, setViewTab] = useState("products");

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        const res = await fetch(`${API}/api/analyses`, {
          headers: { "Authorization": `Bearer ${token()}` },
        });
        const data = await res.json();
        if (data.analyses) setSavedAnalyses(data.analyses);
      } catch {}
    }
    fetchAnalyses();
  }, [txHistory]); // refetch when new transaction added

  function toggleGoal(g) {
    setGoals(prev => {
      const next = new Set(prev);
      if (next.has(g) && next.size === 1) return next;
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  const token = () => localStorage.getItem("sm_token");

  async function runAnalysis() {
    if (!niche.trim()) { setError("Describe your niche or audience first."); return; }
    if (balance < COST) { setError("Not enough USDC. Please top up your wallet."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res  = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token()}` },
        body: JSON.stringify({ platform, niche, goals: Array.from(goals) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setBalance(b => parseFloat((b - COST).toFixed(2)));
      setTotalAnalyses(n => n + 1);
      setTxHistory(h => [{ id: data.txId, label: platform + " analysis", time: nowTime(), amount: COST }, ...h]);
      setResult({ ...data, goals: Array.from(goals) });
      setResultTab(Array.from(goals)[0]);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const canAnalyze = !loading && niche.trim() && balance >= COST;

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const sidebar = (
    <div style={{
      width: 220, flexShrink: 0, background: C.side,
      display: "flex", flexDirection: "column", height: "100vh",
      position: isMobile ? "fixed" : "sticky", top: 0, left: 0, zIndex: 50,
      transform: isMobile && !mobileNav ? "translateX(-100%)" : "translateX(0)",
      transition: "transform 0.25s ease",
      borderRight: `1px solid ${C.sideBorder}`,
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 16px", borderBottom: `1px solid ${C.sideBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandLogo size={38} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.sideText, letterSpacing: "-0.3px" }}>SocialMint</div>
            <div style={{ fontSize: 10, color: C.sideMuted, marginTop: 1 }}>AI monetization intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.sideMuted, padding: "4px 12px 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Workspace</div>
        <NavItem icon="⊞" label="Dashboard"   active={page==="dashboard"} onClick={() => { setPage("dashboard"); setMobileNav(false); }} />
        <NavItem icon="✦" label="New Analysis" active={page==="analyze"}   onClick={() => { setPage("analyze");   setMobileNav(false); }} badge="0.50 USDC" />
        <NavItem icon="◈" label="Prompts"      active={page==="prompts"}   onClick={() => { setPage("prompts");   setMobileNav(false); }} badge="Free" />
        <NavItem icon="⏱" label="History"      active={page==="history"}   onClick={() => { setPage("history");   setMobileNav(false); }} />
        <NavItem icon="◎" label="Wallet"        active={page==="wallet"}    onClick={() => { setPage("wallet");    setMobileNav(false); }} />
        <div style={{ height: 1, background: C.sideBorder, margin: "10px 4px" }} />
        <NavItem icon="⚙" label="Settings"     active={page==="settings"}  onClick={() => { setPage("settings");  setMobileNav(false); }} />
      </div>

      {/* Bottom */}
      <div style={{ padding: "10px 8px", borderTop: `1px solid ${C.sideBorder}` }}>
        <div style={{
          background: "rgba(0,200,150,0.08)", border: `1px solid ${C.mintBorder}`,
          borderRadius: 10, padding: "9px 12px", marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.mint }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.mint }}>Base Testnet</span>
          </div>
          <div style={{ fontSize: 10, color: C.sideMuted }}>Circle Agent Stack live</div>
        </div>
        <button onClick={onLogout} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 8, border: "none",
          background: "transparent", cursor: "pointer", fontFamily: "inherit",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.mint}, #0EA5E9)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>{user.name?.[0] || "U"}</div>
          <span style={{ flex: 1, textAlign: "left", color: C.sideSubtext, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name}
          </span>
          <span style={{ fontSize: 12, color: C.sideMuted }}>→</span>
        </button>
      </div>
    </div>
  );

  // ── Topbar ────────────────────────────────────────────────────────────────────
  const topbar = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 24px", background: C.surface,
      borderBottom: `1px solid ${C.border}`, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <button onClick={() => setMobileNav(v => !v)} style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>☰</button>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
          {page === "analyze" ? "New Analysis" : page === "dashboard" ? "Dashboard" : page === "prompts" ? "Demo Prompts" : page === "history" ? "History" : page === "wallet" ? "Wallet" : "Settings"}
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        background: C.surfaceAlt, borderRadius: 20,
        padding: "6px 12px", border: `1px solid ${C.border}`,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.mint }} />
        <span style={{ fontSize: 12, fontFamily: "monospace", color: C.inkSub }}>
          {user.circleWalletAddress
            ? user.circleWalletAddress.slice(0, 6) + "..." + user.circleWalletAddress.slice(-4)
            : "0x1234...5678"}
        </span>
      </div>
    </div>
  );

  // ── Dashboard page ────────────────────────────────────────────────────────────
  const dashboardPage = (
    <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <MetricCard label="USDC Balance"   value={`${balance.toFixed(2)}`}                    sub="Available to spend"    icon="◎" accent={C.mintBg} />
        <MetricCard label="Analyses Run"   value={totalAnalyses}                               sub="All time"              icon="✦" accent={C.greenBg} />
        <MetricCard label="Total Spent"    value={`${(totalAnalyses * 0.50).toFixed(2)} USDC`} sub="Charged via Circle"    icon="⚡" accent={C.blueBg} />
        <MetricCard label="Cost Per Call"  value="0.50 USDC"                                   sub="Fixed, always"         icon="↗" accent={C.purpleBg} />
      </div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Recent analyses</div>
            <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>Circle USDC ledger · Base network</div>
          </div>
          <button onClick={() => setPage("analyze")} style={{
            padding: "8px 16px", background: C.mint, color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>+ New Analysis</button>
        </div>
        {txHistory.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: C.inkMuted, fontSize: 14 }}>
            No analyses yet.<br /><span style={{ fontSize: 12 }}>Run your first analysis to start the ledger.</span>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.surfaceAlt }}>
              {["Analysis", "Platform", "Amount", "Status", "Time"].map(h => (
                <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.inkMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {txHistory.map((tx, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 500 }}>⚡ {tx.label}</td>
                  <td style={{ padding: "12px 18px", color: C.inkSub }}>{tx.label.split(" ")[0]}</td>
                  <td style={{ padding: "12px 18px", color: C.ink, fontWeight: 600 }}>−{tx.amount.toFixed(2)} USDC</td>
                  <td style={{ padding: "12px 18px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: C.greenBg, color: C.greenText }}>Confirmed</span></td>
                  <td style={{ padding: "12px 18px", color: C.inkMuted, fontFamily: "monospace", fontSize: 12 }}>{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Analyze page ──────────────────────────────────────────────────────────────
  const analyzePage = (
    <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>
      {/* Form panel */}
      <div style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        borderRight: isMobile ? "none" : `1px solid ${C.border}`,
        borderBottom: isMobile ? `1px solid ${C.border}` : "none",
        padding: "20px 20px", overflowY: "auto", background: C.surface,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18 }}>Configure analysis</div>

        {/* Platform */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.inkSub, display: "block", marginBottom: 10 }}>Platform</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {PLATFORMS.map(p => {
              const active = platform === p;
              return (
                <button key={p} onClick={() => setPlatform(p)} style={{
                  padding: "6px 11px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
                  border: active ? `1.5px solid ${C.mint}` : `1px solid ${C.border}`,
                  background: active ? C.mintBg : C.surfaceAlt,
                  color: active ? C.mintText : C.inkSub,
                  fontWeight: active ? 600 : 400, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, transition: "all 0.12s",
                }}>
                  {(() => { const Icon = PLATFORM_ICONS[p]; return <Icon size={13} />; })()}{p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Niche */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.inkSub, display: "block", marginBottom: 8 }}>
            Your niche / audience / handle
          </label>
          <textarea value={niche} onChange={e => setNiche(e.target.value)}
            placeholder="e.g. I run a fitness page for busy moms in Nigeria, 25–45 year olds. 8k followers, strong Reels engagement, workout tips and meal prep content..."
            style={{
              width: "100%", minHeight: 110, padding: "10px 12px",
              border: `1px solid ${C.border}`, borderRadius: 10,
              fontSize: 13, lineHeight: 1.65, fontFamily: "inherit",
              resize: "vertical", color: C.ink, background: C.surfaceAlt, outline: "none",
            }} />
        </div>

        {/* Goals */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.inkSub, display: "block", marginBottom: 10 }}>Discover (pick multiple)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "products",  label: "📦 Products to sell",    desc: "Physical, digital, or services" },
              { id: "content",   label: "🎬 Content ideas",        desc: "Videos, posts, hooks that earn" },
              { id: "marketing", label: "📣 Marketing channels",   desc: "Where to push harder" },
            ].map(g => {
              const active = goals.has(g.id);
              return (
                <button key={g.id} onClick={() => toggleGoal(g.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10, fontFamily: "inherit",
                  border: active ? `1.5px solid ${C.mint}` : `1px solid ${C.border}`,
                  background: active ? C.mintBg : C.surfaceAlt,
                  cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: active ? `2px solid ${C.mint}` : `2px solid ${C.borderStrong}`,
                    background: active ? C.mint : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active ? C.mintText : C.ink }}>{g.label}</div>
                    <div style={{ fontSize: 11, color: C.inkMuted }}>{g.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ background: C.redBg, color: C.red, borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>
        )}

        <div style={{
          background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px",
          marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center",
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 12, color: C.inkSub }}>Wallet balance</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: balance >= COST ? C.mint : C.red }}>
            {balance.toFixed(2)} USDC
          </div>
        </div>

        <button onClick={runAnalysis} disabled={!canAnalyze} style={{
          width: "100%", padding: "13px",
          background: canAnalyze ? `linear-gradient(135deg, ${C.mint}, #0EA5E9)` : C.surfaceAlt,
          color: canAnalyze ? "#fff" : C.inkMuted,
          border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: canAnalyze ? "pointer" : "not-allowed", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: canAnalyze ? "0 4px 20px rgba(0,200,150,0.3)" : "none",
          transition: "all 0.15s",
        }}>
          {loading ? <><Spinner />&nbsp;Analyzing...</> : `⚡ Pay 0.50 USDC & Analyze`}
        </button>
      </div>

      {/* Results panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24, background: C.canvas }}>
        {!result && !loading && (
          <div style={{
            height: "100%", minHeight: 300, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            border: `2px dashed ${C.border}`, borderRadius: 16, padding: 32,
            color: C.inkMuted, textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>✦</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.inkSub, marginBottom: 8 }}>Your analysis will appear here</div>
            <div style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.7, color: C.inkMuted }}>
              Fill in the form, choose what you want to discover, and click Analyze. Results include specific product ideas, content hooks, and marketing strategies.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16 }}>
            <Spinner size={32} dark />
            <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSub }}>Analyzing your social presence...</div>
            <div style={{ fontSize: 12, color: C.inkMuted }}>0.50 USDC charged · Claude is thinking</div>
          </div>
        )}

        {result && (
          <div style={{ maxWidth: 700, animation: "fadeIn 0.3s ease" }}>
            {/* Snapshot */}
            <div style={{
              background: C.surface, borderRadius: 14, padding: "20px 24px", marginBottom: 20,
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${C.mint}`,
              boxShadow: "0 2px 12px rgba(0,200,150,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.mint }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {result.platform} · Opportunity Snapshot
                </div>
              </div>
              <div style={{ fontSize: 16, color: C.ink, lineHeight: 1.8, fontWeight: 400 }}>{result.summary}</div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {result.goals.map(g => {
                const labels = { products: "📦 Products", content: "🎬 Content", marketing: "📣 Marketing" };
                const active  = resultTab === g;
                return (
                  <button key={g} onClick={() => setResultTab(g)} style={{
                    padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "inherit",
                    border: active ? `1.5px solid ${C.mint}` : `1px solid ${C.border}`,
                    background: active ? C.mint : C.surface,
                    color: active ? "#fff" : C.inkSub,
                    fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s",
                  }}>{labels[g]}</button>
                );
              })}
            </div>

            {/* Products */}
            {resultTab === "products" && result.products?.map((p, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "18px 20px", marginBottom: 10,
                display: "flex", gap: 16, alignItems: "flex-start",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: C.mintBg, color: C.mintText,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{p.title}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "3px 10px",
                      borderRadius: 20, background: C.greenBg, color: C.greenText,
                    }}>{p.price_range}</span>
                  </div>
                  <div style={{ fontSize: 14, color: C.inkSub, lineHeight: 1.75 }}>{p.why}</div>
                </div>
              </div>
            ))}

            {/* Content */}
            {resultTab === "content" && result.content?.map((c, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "18px 20px", marginBottom: 10,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: C.purpleBg, color: C.purpleText,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{c.idea}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px",
                    borderRadius: 20, background: C.purpleBg, color: C.purpleText,
                  }}>{c.format}</span>
                </div>
                <div style={{
                  background: C.surfaceAlt, borderRadius: 8, padding: "12px 16px",
                  borderLeft: `3px solid ${C.purple}`,
                  fontSize: 14, color: C.inkSub, lineHeight: 1.75, fontStyle: "italic",
                }}>"{c.hook}"</div>
              </div>
            ))}

            {/* Marketing */}
            {resultTab === "marketing" && result.marketing?.map((m, i) => (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: "18px 20px", marginBottom: 10,
                display: "flex", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: C.blueBg, color: C.blueText,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{m.channel}</div>
                  <div style={{ fontSize: 14, color: C.inkSub, lineHeight: 1.75, marginBottom: 8 }}>{m.tactic}</div>
                  <div style={{
                    fontSize: 12, color: C.inkMuted, padding: "4px 12px",
                    background: C.surfaceAlt, borderRadius: 20, display: "inline-block",
                  }}>📊 {m.expected_reach}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Run prompt (free for first 3, paid after) ────────────────────────────────
  async function runPromptAnalysis(prompt) {
    const isFree = freeRunsUsed < FREE_LIMIT;

    // If paid, check balance first
    if (!isFree && balance < COST) {
      setPage("analyze");
      setPlatform(prompt.platform);
      setGoals(new Set(prompt.goals));
      setNiche(prompt.niche);
      setError("Not enough USDC. Please top up your wallet to run this analysis.");
      return;
    }

    // Switch to analyze page and auto-fill form
    setPage("analyze");
    setPlatform(prompt.platform);
    setGoals(new Set(prompt.goals));
    setNiche(prompt.niche);
    setError(""); setLoading(true); setResult(null);

    // Track free run — server handles the real enforcement
    if (isFree) {
      setFreeRunsUsed(n => n + 1);
      // No localStorage — tracked in MongoDB now
    } else {
      // Deduct balance optimistically for paid run
      setBalance(b => parseFloat((b - COST).toFixed(2)));
    }

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token()}` },
        body: JSON.stringify({
          platform: prompt.platform,
          niche: prompt.niche,
          goals: prompt.goals,
          isFreeDemo: isFree,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      if (!isFree) {
        setTotalAnalyses(n => n + 1);
        setTxHistory(h => [{ id: data.txId, label: prompt.platform + " analysis", time: nowTime(), amount: COST }, ...h]);
      }
      setResult({ ...data, goals: prompt.goals });
      setResultTab(prompt.goals[0]);
    } catch (e) {
      setError(e.message || "Analysis failed — please try again.");
      // Refund balance if paid run failed
      if (!isFree) setBalance(b => parseFloat((b + COST).toFixed(2)));
    }
    setLoading(false);
  }

  // ── Prompts page ──────────────────────────────────────────────────────────────
  const runsLeft = FREE_LIMIT - freeRunsUsed;
  const categories = [...new Set(DEMO_PROMPTS.map(p => p.category))];

  const promptsPage = (
    <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.side} 0%, #0D2040 100%)`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.5px" }}>
            Ready-made prompts ✦
          </div>
          <div style={{ fontSize: 14, color: C.sideSubtext, lineHeight: 1.65, maxWidth: 480 }}>
            Too lazy to type? Just click any prompt — we auto-fill everything and run the analysis instantly.
            First 3 are free, after that 0.50 USDC each.
          </div>
        </div>
        <div style={{
          background: runsLeft > 0 ? "rgba(0,200,150,0.15)" : "rgba(59,130,246,0.15)",
          border: `1px solid ${runsLeft > 0 ? C.mintBorder : "#3B82F640"}`,
          borderRadius: 12, padding: "14px 20px", textAlign: "center", flexShrink: 0,
        }}>
          {runsLeft > 0 ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.mint }}>{runsLeft}</div>
              <div style={{ fontSize: 12, color: C.sideSubtext, fontWeight: 500 }}>free {runsLeft === 1 ? "run" : "runs"} left</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.blue }}>∞</div>
              <div style={{ fontSize: 12, color: C.sideSubtext, fontWeight: 500 }}>0.50 USDC / run</div>
            </>
          )}
        </div>
      </div>

      {/* Info banner */}
      {runsLeft > 0 ? (
        <div style={{
          background: C.mintBg, border: `1px solid ${C.mintBorder}`,
          borderRadius: 10, padding: "11px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.mintText,
        }}>
          <span>✦</span>
          <span>You have <strong>{runsLeft} free {runsLeft === 1 ? "run" : "runs"}</strong> left — click any card to see a real AI analysis. No USDC needed.</span>
        </div>
      ) : (
        <div style={{
          background: C.blueBg, border: `1px solid ${C.blue}30`,
          borderRadius: 10, padding: "11px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ fontSize: 13, color: C.inkSub }}>
            <strong style={{ color: C.blueText }}>Prompts still work</strong> — each now costs 0.50 USDC from your wallet.
            {balance < COST && <> Low balance — <button onClick={() => setPage("wallet")} style={{ fontSize: 13, fontWeight: 600, color: C.mint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>top up →</button></>}
          </div>
        </div>
      )}

      {/* Prompt cards */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSub, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            {cat}<div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
            {DEMO_PROMPTS.filter(p => p.category === cat).map(prompt => {
              const isFree = freeRunsUsed < FREE_LIMIT;
              const cantAfford = !isFree && balance < COST;
              return (
                <div key={prompt.id}
                  onClick={() => !cantAfford && runPromptAnalysis(prompt)}
                  onMouseEnter={e => {
                    if (!cantAfford) {
                      e.currentTarget.style.borderColor = isFree ? C.mint : C.blue;
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = `0 6px 20px ${isFree ? "rgba(0,200,150,0.15)" : "rgba(59,130,246,0.15)"}`;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                  }}
                  style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 14, padding: "16px 18px",
                    cursor: cantAfford ? "not-allowed" : "pointer",
                    opacity: cantAfford ? 0.5 : 1,
                    transition: "all 0.18s ease",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: prompt.colorBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, flexShrink: 0,
                      }}>{prompt.icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{prompt.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                          {(() => { const Icon = PLATFORM_ICONS[prompt.platform]; return <Icon size={11} />; })()}
                          <span style={{ fontSize: 11, color: C.inkMuted }}>{prompt.platform}</span>
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, flexShrink: 0,
                      background: isFree ? C.mintBg : C.blueBg,
                      color: isFree ? C.mintText : C.blueText,
                    }}>{isFree ? "FREE" : "0.50 USDC"}</span>
                  </div>

                  {/* Niche preview */}
                  <div style={{
                    fontSize: 12, color: C.inkMuted, lineHeight: 1.6, marginBottom: 12,
                    display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>{prompt.niche}</div>

                  {/* Goal tags */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 13 }}>
                    {prompt.goals.map(g => (
                      <span key={g} style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 20, background: C.surfaceAlt,
                        color: C.inkSub, border: `1px solid ${C.border}`,
                      }}>
                        {{ products: "📦 Products", content: "🎬 Content", marketing: "📣 Marketing" }[g]}
                      </span>
                    ))}
                  </div>

                  {/* Button */}
                  <button style={{
                    width: "100%", padding: "9px", border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: cantAfford ? "not-allowed" : "pointer",
                    fontFamily: "inherit", transition: "opacity 0.15s",
                    background: cantAfford
                      ? C.surfaceAlt
                      : isFree
                        ? `linear-gradient(135deg, ${C.mint}, #0EA5E9)`
                        : `linear-gradient(135deg, ${C.blue}, #6366F1)`,
                    color: cantAfford ? C.inkMuted : "#fff",
                    boxShadow: cantAfford ? "none"
                      : isFree ? "0 2px 10px rgba(0,200,150,0.25)"
                      : "0 2px 10px rgba(59,130,246,0.25)",
                  }}>
                    {cantAfford ? "⚠ Insufficient balance" : isFree ? "▶ Run free" : "⚡ Run — 0.50 USDC"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 12, color: C.inkMuted }}>
        First 3 free · Then 0.50 USDC each · Powered by Circle Agent Stack
      </div>
    </div>
  );
  const historyPage = (
    <div style={{ padding: 24, flex: 1, overflowY: "auto", position: "relative" }}>

      {/* Analysis View Modal */}
      {viewingAnalysis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }} onClick={() => setViewingAnalysis(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: 18,
              width: "100%", maxWidth: 680, maxHeight: "85vh",
              overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "sticky", top: 0, background: C.surface, zIndex: 1,
              borderRadius: "18px 18px 0 0",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {(() => { const Icon = PLATFORM_ICONS[viewingAnalysis.platform]; return <Icon size={16} />; })()}
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{viewingAnalysis.platform} Analysis</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                    background: viewingAnalysis.isFreeDemo ? C.mintBg : C.blueBg,
                    color: viewingAnalysis.isFreeDemo ? C.mintText : C.blueText,
                  }}>{viewingAnalysis.isFreeDemo ? "Free demo" : "0.50 USDC"}</span>
                </div>
                <div style={{ fontSize: 12, color: C.inkMuted }}>
                  {new Date(viewingAnalysis.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setPlatform(viewingAnalysis.platform);
                    setGoals(new Set(viewingAnalysis.goals));
                    setNiche(viewingAnalysis.niche);
                    setViewingAnalysis(null);
                    setPage("analyze");
                  }}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: C.mint, color: "#fff", border: "none", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >↗ Run again</button>
                <button
                  onClick={() => setViewingAnalysis(null)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.surfaceAlt, cursor: "pointer", fontSize: 18, color: C.inkSub,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >×</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Niche */}
              <div style={{
                background: C.surfaceAlt, borderRadius: 10, padding: "12px 16px",
                marginBottom: 16, fontSize: 13, color: C.inkSub, lineHeight: 1.65,
                borderLeft: `3px solid ${C.mint}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mint, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your niche</div>
                {viewingAnalysis.niche}
              </div>

              {/* Snapshot */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderTop: `3px solid ${C.mint}`, borderRadius: 12,
                padding: "16px 20px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mint, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  ✦ Opportunity Snapshot
                </div>
                <div style={{ fontSize: 15, color: C.ink, lineHeight: 1.75 }}>{viewingAnalysis.summary}</div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {viewingAnalysis.goals.map(g => {
                  const labels = { products: "📦 Products", content: "🎬 Content", marketing: "📣 Marketing" };
                  const active = viewTab === g;
                  return (
                    <button key={g} onClick={() => setViewTab(g)} style={{
                      padding: "7px 16px", borderRadius: 20, fontSize: 13, fontFamily: "inherit",
                      border: active ? `1.5px solid ${C.mint}` : `1px solid ${C.border}`,
                      background: active ? C.mint : C.surface,
                      color: active ? "#fff" : C.inkSub,
                      fontWeight: active ? 600 : 400, cursor: "pointer",
                    }}>{labels[g]}</button>
                  );
                })}
              </div>

              {/* Products */}
              {viewTab === "products" && viewingAnalysis.products?.map((p, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "14px 16px",
                  background: C.surfaceAlt, borderRadius: 12, marginBottom: 8,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: C.mintBg, color: C.mintText,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{p.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: C.greenBg, color: C.greenText }}>{p.price_range}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.inkSub, lineHeight: 1.65 }}>{p.why}</div>
                  </div>
                </div>
              ))}

              {/* Content */}
              {viewTab === "content" && viewingAnalysis.content?.map((c, i) => (
                <div key={i} style={{ padding: "14px 16px", background: C.surfaceAlt, borderRadius: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: C.purpleBg, color: C.purpleText,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.idea}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: C.purpleBg, color: C.purpleText }}>{c.format}</span>
                  </div>
                  <div style={{
                    background: C.surface, borderLeft: `3px solid ${C.purple}`,
                    padding: "8px 12px", borderRadius: "0 8px 8px 0",
                    fontSize: 13, color: C.inkSub, fontStyle: "italic", lineHeight: 1.65,
                  }}>"{c.hook}"</div>
                </div>
              ))}

              {/* Marketing */}
              {viewTab === "marketing" && viewingAnalysis.marketing?.map((m, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "14px 16px",
                  background: C.surfaceAlt, borderRadius: 12, marginBottom: 8,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: C.blueBg, color: C.blueText,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{m.channel}</div>
                    <div style={{ fontSize: 13, color: C.inkSub, lineHeight: 1.65, marginBottom: 6 }}>{m.tactic}</div>
                    <div style={{ fontSize: 12, color: C.inkMuted, padding: "3px 10px", background: C.surface, borderRadius: 20, display: "inline-block" }}>
                      📊 {m.expected_reach}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Analysis history</div>
            <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>All analyses · click View to read again · Run again to reuse</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.inkMuted }}>
            {savedAnalyses.length} total
          </div>
        </div>

        {savedAnalyses.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: C.inkMuted, fontSize: 14 }}>
            No analyses yet.<br />
            <span style={{ fontSize: 12 }}>Run your first analysis and it will appear here.</span>
          </div>
        ) : (
          <div>
            {savedAnalyses.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "14px 20px",
                borderBottom: i < savedAnalyses.length - 1 ? `1px solid ${C.border}` : "none",
                flexWrap: "wrap",
              }}>
                {/* Platform icon + info */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, background: C.surfaceAlt,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {(() => { const Icon = PLATFORM_ICONS[a.platform]; return <Icon size={18} />; })()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{a.platform} analysis</div>
                    <div style={{
                      fontSize: 12, color: C.inkMuted, marginTop: 2,
                      maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{a.niche?.slice(0, 60)}...</div>
                  </div>
                </div>

                {/* Goals */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {a.goals?.map(g => (
                    <span key={g} style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                      background: C.surfaceAlt, color: C.inkSub, border: `1px solid ${C.border}`,
                    }}>{{ products: "📦", content: "🎬", marketing: "📣" }[g]}</span>
                  ))}
                </div>

                {/* Charge */}
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                    background: a.isFreeDemo ? C.mintBg : C.blueBg,
                    color: a.isFreeDemo ? C.mintText : C.blueText,
                  }}>{a.isFreeDemo ? "Free" : "−0.50 USDC"}</div>
                </div>

                {/* Date */}
                <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: "monospace", textAlign: "right", minWidth: 80 }}>
                  {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { setViewingAnalysis(a); setViewTab(a.goals?.[0] || "products"); }}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.mint}`, background: C.mintBg,
                      color: C.mintText, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >View →</button>
                  <button
                    onClick={() => {
                      setPlatform(a.platform);
                      setGoals(new Set(a.goals));
                      setNiche(a.niche);
                      setPage("analyze");
                    }}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.border}`, background: C.surfaceAlt,
                      color: C.inkSub, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >↗ Run again</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Wallet page ───────────────────────────────────────────────────────────────
  const walletPage = (
    <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MetricCard label="USDC Balance"  value={`${balance.toFixed(2)} USDC`}                    sub="Available to spend"  icon="◎" accent={C.mintBg} />
        <MetricCard label="Total Charged" value={`${(totalAnalyses * 0.50).toFixed(2)} USDC`}     sub="Lifetime total"      icon="⚡" accent={C.blueBg} />
      </div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 16 }}>Wallet details</div>
        {[
          ["Wallet ID",    user.circleWalletId || "—"],
          ["Address",      user.circleWalletAddress || "—"],
          ["Network",      "Base (USDC)"],
          ["Type",         "Circle Programmable Wallet"],
          ["Cost / call",  "0.50 USDC"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.inkMuted }}>{k}</span>
            <span style={{ fontSize: 13, color: C.ink, fontFamily: "monospace", wordBreak: "break-all" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'DM Sans', system-ui, sans-serif", background: C.canvas }}>
      {isMobile && mobileNav && (
        <div onClick={() => setMobileNav(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      )}
      {sidebar}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {topbar}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {page === "dashboard" && <div style={{ flex: 1, overflowY: "auto" }}>{dashboardPage}</div>}
          {page === "analyze"   && analyzePage}
          {page === "prompts"   && promptsPage}
          {page === "history"   && historyPage}
          {page === "wallet"    && walletPage}
          {page === "settings"  && <div style={{ padding: 24, color: C.inkMuted, fontSize: 14 }}>Settings coming soon.</div>}
        </div>
      </div>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { border-color: ${C.mint} !important; outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderStrong}; border-radius: 99px; }
      `}</style>
    </div>
  );
}

export default function App() {
  const { signOut } = useClerk();
  const saved = localStorage.getItem("sm_user");
  const [user, setUser] = useState(saved ? JSON.parse(saved) : null);

  function handleLogin(u) {
    localStorage.setItem("sm_user", JSON.stringify(u));
    setUser(u);
  }

  async function handleLogout() {
    await signOut();
    localStorage.removeItem("sm_token");
    localStorage.removeItem("sm_user");
    setUser(null);
  }

  return user ? <Dashboard user={user} onLogout={handleLogout} /> : <LoginScreen onLogin={handleLogin} />;
}