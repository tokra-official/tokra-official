/* eslint-disable no-console */
/**
 * Tokra Database Setup Script
 * ---------------------------
 * Creates and seeds all Tokra tables using the Supabase JS client.
 *
 * Usage:
 *   node scripts/setup-db.js
 *
 * Notes:
 * - Reads credentials from ./.env.local
 * - Table creation is attempted via the `exec_sql` RPC (if you have created it)
 *   or the Supabase Management API (if SUPABASE_ACCESS_TOKEN is set).
 * - If neither is available, the script prints manual SQL-Editor instructions,
 *   then continues with seeding once the tables exist.
 * - Seeding is idempotent (upserts on unique keys), safe to re-run anytime.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// 1. Load environment variables from .env.local (no external dependency)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("  [x] .env.local not found at project root.");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // optional
const PROJECT_REF = SUPABASE_URL ? SUPABASE_URL.split("//")[1].split(".")[0] : null;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("  [x] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// 2. SQL statements
// ---------------------------------------------------------------------------
const TABLES = ["categories", "posts", "breaking_alerts", "profiles"];

const SCHEMA_SQL = `
-- ============================== CATEGORIES ==============================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ================================ POSTS =================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  category_id uuid references public.categories(id) on delete set null,
  market_type text not null default 'general' check (market_type in ('crypto','gold','general')),
  sentiment text not null default 'neutral' check (sentiment in ('bullish','bearish','neutral')),
  is_highlighted boolean not null default false,
  featured_image text,
  views integer not null default 0,
  created_at timestamptz not null default now()
);

-- =========================== BREAKING ALERTS ============================
create table if not exists public.breaking_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  badge_type text not null default 'BREAKING' check (badge_type in ('URGENT','BULLISH','BEARISH','BREAKING')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================== PROFILES ===============================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  role text not null default 'reader' check (role in ('admin','reader')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============================== INDEXES =================================
create index if not exists idx_posts_category_id on public.posts(category_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_posts_market_type on public.posts(market_type);
create index if not exists idx_posts_sentiment on public.posts(sentiment);
create index if not exists idx_posts_highlighted on public.posts(is_highlighted) where is_highlighted = true;
create index if not exists idx_breaking_alerts_active on public.breaking_alerts(is_active, created_at desc);
`;

// ---------------------------------------------------------------------------
// 3. Table creation helpers
// ---------------------------------------------------------------------------
async function tableExists(name) {
  const { error } = await supabase.from(name).select("id").limit(1);
  if (!error) return true;
  // PGRST205 = relation does not exist; 42P01 = undefined_table
  const code = String(error.code || "");
  const msg = String(error.message || "");
  if (code === "PGRST205" || code === "42P01" || msg.includes("does not exist")) {
    return false;
  }
  // Any other error (e.g. RLS blocking) means the table exists
  return true;
}

async function execSqlViaRpc(sql) {
  const { error } = await supabase.rpc("exec_sql", { query: sql });
  return !error;
}

async function execSqlViaManagementApi(sql) {
  if (!MANAGEMENT_TOKEN || !PROJECT_REF) return false;
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MANAGEMENT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureTables() {
  const missing = [];
  for (const t of TABLES) {
    if (!(await tableExists(t))) missing.push(t);
  }
  if (missing.length === 0) {
    console.log("  [ok] All tables already exist.");
    return true;
  }

  console.log(`  [..] Missing tables: ${missing.join(", ")}. Attempting creation...`);

  if (await execSqlViaRpc(SCHEMA_SQL)) {
    console.log("  [ok] Schema created via exec_sql RPC.");
    return true;
  }
  if (await execSqlViaManagementApi(SCHEMA_SQL)) {
    console.log("  [ok] Schema created via Supabase Management API.");
    return true;
  }

  console.log("");
  console.log("  Could not run DDL automatically (no exec_sql RPC and no SUPABASE_ACCESS_TOKEN).");
  console.log("  Run the schema manually, then re-run this script:");
  console.log("    1. Open Supabase Dashboard -> SQL Editor");
  console.log("    2. Paste the contents of supabase/schema.sql");
  console.log("    3. Click 'Run'");
  console.log("    4. Re-run: node scripts/setup-db.js");
  console.log("");
  return false;
}

// ---------------------------------------------------------------------------
// 4. Seed data
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { name: "Crypto Spot", slug: "crypto-spot" },
  { name: "Crypto Futures", slug: "crypto-futures" },
  { name: "Gold Spot", slug: "gold-spot" },
  { name: "Gold Futures", slug: "gold-futures" },
  { name: "SMC Analysis", slug: "smc-analysis" },
  { name: "Market News", slug: "market-news" },
];

const SAMPLE_ALERTS = [
  {
    message: "BTC breaks above $100K — institutional inflows accelerating",
    link_url: "/news/btc-100k-breakout",
    badge_type: "BULLISH",
    is_active: true,
  },
  {
    message: "XAUUSD prints new all-time high as yields compress",
    link_url: "/news/xauusd-ath",
    badge_type: "BULLISH",
    is_active: true,
  },
  {
    message: "Breaking: Fed holds rates steady — volatility spike expected",
    link_url: "/news/fed-rate-decision",
    badge_type: "URGENT",
    is_active: true,
  },
];

async function seedCategories() {
  const { data, error } = await supabase
    .from("categories")
    .upsert(CATEGORIES, { onConflict: "slug" })
    .select();
  if (error) {
    console.error("  [x] Failed to seed categories:", error.message);
    return null;
  }
  console.log(`  [ok] Seeded ${data.length} categories.`);
  return data;
}

async function seedBreakingAlerts() {
  const { data: existing, error: checkErr } = await supabase
    .from("breaking_alerts")
    .select("id")
    .limit(1);
  if (checkErr) {
    console.error("  [x] Failed to read breaking_alerts:", checkErr.message);
    return;
  }
  if (existing && existing.length > 0) {
    console.log("  [ok] breaking_alerts already has data — skipped sample seed.");
    return;
  }
  const { error } = await supabase.from("breaking_alerts").insert(SAMPLE_ALERTS);
  if (error) {
    console.error("  [x] Failed to seed breaking_alerts:", error.message);
    return;
  }
  console.log(`  [ok] Seeded ${SAMPLE_ALERTS.length} sample breaking alerts.`);
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------
(async function main() {
  console.log("");
  console.log("  ================================================");
  console.log("   Tokra Database Setup");
  console.log("  ================================================");
  console.log(`  Project: ${SUPABASE_URL}`);
  console.log(`  Anon key configured: ${ANON_KEY ? "yes" : "no"}`);
  console.log("");

  const tablesReady = await ensureTables();
  if (!tablesReady) {
    console.error("  [x] Setup stopped — create the tables first, then re-run.");
    process.exit(1);
  }

  console.log("");
  console.log("  Seeding data...");
  const categories = await seedCategories();
  await seedBreakingAlerts();

  if (!categories) {
    console.error("  [x] Setup incomplete.");
    process.exit(1);
  }

  console.log("");
  console.log("  [done] Tokra database is ready.");
  console.log("  Next: create an admin user in Supabase Auth, then insert a");
  console.log("  matching row into public.profiles with role = 'admin'.");
  console.log("");
})();
