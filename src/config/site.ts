export const siteConfig = {
  name: "Tokra",
  tagline: "Live Crypto & Gold Intelligence",
  description:
    "Tokra is a real-time Crypto & Gold Market Intelligence Platform delivering live spot & futures data, SMC analysis, breaking alerts, and expert market news.",
  url: "https://tokra-web.vercel.app",
  keywords: [
    "crypto",
    "gold",
    "market intelligence",
    "bitcoin",
    "xauusd",
    "spot price",
    "futures",
    "SMC analysis",
    "trading",
  ],
  categories: [
    { name: "Crypto Spot", slug: "crypto-spot", marketType: "crypto" },
    { name: "Crypto Futures", slug: "crypto-futures", marketType: "crypto" },
    { name: "Gold Spot", slug: "gold-spot", marketType: "gold" },
    { name: "Gold Futures", slug: "gold-futures", marketType: "gold" },
    { name: "SMC Analysis", slug: "smc-analysis", marketType: "general" },
    { name: "Market News", slug: "market-news", marketType: "general" },
  ],
  social: {
    twitter: "https://twitter.com/tokraofficial",
    youtube: "https://youtube.com/@tokraofficial",
    telegram: "https://t.me/tokraofficial",
    instagram: "https://instagram.com/tokraofficial",
  },
} as const;

export type SiteConfig = typeof siteConfig;
export type CategorySlug = (typeof siteConfig.categories)[number]["slug"];
