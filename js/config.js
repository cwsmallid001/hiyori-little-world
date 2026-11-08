/* ==========================================================
   SITE SETTINGS - the easiest place to edit things.
   Everything here is a PLACEHOLDER until Hiyori approves it.
   ========================================================== */
window.SITE = {
  brand: "Hiyori's Little World",
  brandJp: "ひよりの小さな世界",
  personName: "Hiyori 小蝦",
  personJp: "ひより小蝦",
  tagline: "A Little World of Cosplay, Love & Memories.",
  contactEmail: "hello@example.com",           // placeholder, replace with the real email
  announcements: [
    "✦ New Collection Available! ✦",
    "✦ Limited Edition Merchandise ✦",
    "✦ Special Pre-order Now Open ✦"
  ],
  // Social links: replace "#" with the approved links.
  socials: [
    { name: "Instagram", url: "#" },
    { name: "TikTok",    url: "#" },
    { name: "Facebook",  url: "#" },
    { name: "YouTube",   url: "#" }
  ],
  // Patreon page. Replace "#" with the official Patreon link when ready.
  patreonUrl: "#",
  // Photos: leave "" to show a pastel placeholder. To use a real photo,
  // put the file in assets/images/... and write its path, e.g. "assets/images/hero/hiyori.jpg"
  images: { hero: "", about: "" },

  // Demo shipping rates (RM). Change freely.
  shipping: {
    my_standard: { label: "Malaysia Standard Shipping", fee: 8,  freeOver: 150, days: "3-5 working days" },
    my_express:  { label: "Malaysia Express Shipping",  fee: 15, freeOver: 0,   days: "1-2 working days" },
    intl:        { label: "International Shipping",     fee: 45, freeOver: 0,   days: "7-14 working days" }
  },
  // Demo discount codes (percent). Real codes must be checked on a server later.
  discountCodes: { "DEMO10": 10 },

  // Queue system (demo). mode: "preorder" or "event".
  queue: {
    mode: "preorder",
    baselinePreorder: 36,   // pretend this many pre-order customers are already in line (demo)
    baselineEvent: 0,       // pretend this many event customers are already in line (demo)
    eventName: "Fan Meet Event (placeholder)"
  }
};
