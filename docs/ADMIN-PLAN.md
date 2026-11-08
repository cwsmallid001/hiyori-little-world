# Unified Retail System Plan (version 3: independent of SimpleLoyalty)
Online store + Admin Dashboard + Members + Loyalty points + Events + offline iPad POS, all on one Supabase database.

**Status: PLAN ONLY.** No SQL has been run, no Supabase project is connected, no backend code is in the website. Companion files: `supabase/schema.PROPOSED.sql` (database design, untested) and `docs/SUPABASE-SETUP-GUIDE.md` (step-by-step setup).

---
## 0. What changed since the plan you approved
| Area | Change |
|---|---|
| Roles | One **Owner** (you) plus roles for helpers: Manager, Order Staff, Content Editor, Cashier. Only the Owner manages admins. |
| Order statuses | Now 7: Pending Payment, Paid, Processing, Shipped, Completed, Cancelled, Refunded (replaces the earlier separate "payment status"). |
| Cost price | Stored in its **own private table**, because the product list is public and a cost column there would leak. |
| Activity log | New append-only log written by database triggers. |
| Payment | Manual Bank Transfer and DuitNow, details editable by the **Owner only**. |
| Members and points | One central member profile and an insert-only points ledger. |
| Events and POS | Events with their own stock; offline iPad POS with a safe sync queue. |
| **Phone identity** | For migrated members the **phone number** is the key (as in SimpleLoyalty). A customer who later logs in is linked to the profile with the same phone **(no extra code needed, as you decided)**. |
| **Independence** | The system owns **all** business data. SimpleLoyalty is used **only to export** members and points, then dropped after verified migration (`docs/SIMPLELOYALTY-MIGRATION.md`). |
| Refunds | Always allowed, even if points were spent. A negative balance is flagged on the member and raises a dashboard alert. |
| Event stock | Events now end in a **physical count**; unsold stock returns online only after reconciliation. |
| Member login | Database is ready for it now (claim codes, login link); the login screens come later. |
| Customer sign-up | **Kept OFF for now** (as approved). Customers register through a controlled function with no password. Website login for members is switched on in a later phase, after the access rules are tested. |

---
## 1. What I inspected (honest findings)
**Membership and points: nothing exists in the website code.** I searched for member, points, loyalty, reward, voucher and redeem: no matches. You then sent a SimpleLoyalty **points-collection export** (507 earn rows, 158 member IDs, 89,692 points, 14 Mar to 11 Oct 2026). It has IDs and points only: **no names, emails, phones, balances, redemptions or rules.** The only pattern visible is that every row awards points equal to spending with multiplier 1.0; I treat that as evidence for you to confirm, **not** as a rule, and I will not invent rates. Details and gaps: `docs/SIMPLELOYALTY-MIGRATION.md`.

What does exist, and how it maps:
| Existing | Becomes |
|---|---|
| Demo orders (browser storage): id, customer, items with variations, shipping, payment method, totals, status | `orders` + `order_items` (same fields, plus member link, SKU and cost snapshots) |
| 28 demo products and 4 collections in `js/*.js` | `products`, `categories`, `collections` (product IDs kept, e.g. PB-001) |
| Pre-orders (open/close dates, estimated ship date) and limited-edition counts | Kept on `products`; pre-orders stay as **online orders** |
| Queue (P-xxxx pre-order tickets, then E-xxxx event tickets) | Kept (`queue_state`, `orders.queue_*`); unchanged rules |
| Demo checkout, DuitNow/bank placeholders | `place_order()` and editable `payment_methods` |

**Pre-orders and physical POS sales are kept apart:** online pre-orders live in `orders`; completed iPad sales live in `pos_transactions`. Reports show them as separate channels.

---
## 2. Architecture
```
Customers ─► GitHub Pages website (same pink design) ─┐
Owner/staff ─► /admin/ dashboard (login + roles)      ├─► Supabase: Auth · Postgres (row-level security)
iPad ─► /pos/ installed web app (PWA)                 │            · Storage · Edge Functions
        └ service worker (app files cached)           │
        └ IndexedDB (catalogue, members cache, ───────┘   sync when internet returns
          pending sales "outbox")
```
One database serves the website, dashboard and POS. Pages are static files on GitHub Pages; Supabase holds the data and enforces the rules.

---
## 3. Roles and permissions
| Permission area | Owner | Manager | Order Staff | Content Editor | Cashier |
|---|:-:|:-:|:-:|:-:|:-:|
| View dashboard, analytics | ✔ | ✔ | basic | basic | |
| Products, stock, categories, collections | ✔ | ✔ | | | |
| **Cost price and profit** | ✔ | ✔ | | | |
| View orders, change status, tracking | ✔ | ✔ | ✔ | | |
| Refund orders | ✔ | ✔ | | | |
| View members | ✔ | ✔ | ✔ | | |
| Edit members, adjust or bonus points | ✔ | ✔ | | | |
| **Loyalty rules** | ✔ | | | | |
| Events, event stock, POS history, reconciliation | ✔ | ✔ | | | |
| Banners, announcements, About, socials, Patreon, notices | ✔ | ✔ | | ✔ | |
| Store info, shipping and return policies | ✔ | ✔ | | | |
| **Payment details (bank, DuitNow)** | ✔ | | | | |
| **Add/remove admins, change roles** | ✔ | | | | |
| **Activity log** | ✔ | | | | |
| Export data | ✔ | ✔ | | | |
| Use the iPad POS | ✔ | ✔ | | | ✔ |
These defaults are my suggestion. Tell me what to change. **Manual points adjustments above 10,000 points need the Owner's approval** (Managers can request them; nothing moves until you approve). The rules are enforced by the database, not by hidden buttons. There is exactly one Owner and the account cannot be removed or demoted. Adding an admin runs in an Edge Function (server-side) that first checks the caller is the Owner.

---
## 4. Orders and manual payment (Bank Transfer / DuitNow)
**Flow:** customer checks out → order is **Pending Payment** with the order ID as the payment reference → customer pays by bank transfer or DuitNow using the details shown → you check your bank → you set **Paid** → Processing → Shipped (with tracking number) → Completed.
**Allowed changes** (anything else is refused): Pending Payment → Paid or Cancelled; Paid → Processing, Completed (digital), Refunded, Cancelled; Processing → Shipped, Refunded, Cancelled; Shipped → Completed or Refunded; Completed → Refunded. Cancelled and Refunded are final. Every change records who, when and a note.
**Side effects (automatic):** Paid awards points. Cancelled returns stock and any redeemed points. Refunded returns stock, reverses earned points and returns redeemed points.
**Payment details** (bank, account name and number, DuitNow ID and QR image, instructions) are edited in the dashboard by the Owner only and every change is logged. Customers see them at checkout, like an invoice. Because changed account numbers are a fraud risk, only the Owner can edit them, and changes appear in the activity log.
**Not included yet:** automatic bank matching and customer receipt upload (a private upload bucket is reserved for later).

---
## 5. Products, cost, margin, stock
SKU, selling price, stock, low-stock level, Sold Out, Featured and Enabled switches are on `products`. **Cost price** is in `product_costs` (Owner and Manager only). Profit and margin = (price − cost) ÷ price, shown in a dashboard view. Each sale stores a **cost snapshot**, so past profit stays correct when costs change. Low-stock alerts list products at or below their threshold. Every stock change creates a `stock_movements` row (who, why, how many, balance after).

## 6. Sales analytics
Daily and monthly sales, total orders, total revenue, average order, best sellers (units, revenue, profit), online versus event split, and event summaries, all in **Malaysia time**. Revenue counts Paid, Processing, Shipped and Completed online orders and completed POS sales. Pending, Cancelled and Refunded are excluded. Charts are simple and drawn in the dashboard.

## 7. Activity log
Database triggers record who changed what, when, with old and new values: product price, name, SKU, listing switches, cost price; stock (via movements); order status (history table); store info, content, policies, payment details; admins and roles; loyalty rules; events; devices; member details. The log is append-only: nobody, including the Owner, can edit or delete entries.

## 8. Store settings and website content
Store name, logo, description, email, phone, **WhatsApp number**, address, hours, shipping rates, announcements, About text, social links, Patreon URL, notices, banners, and shipping, returns, privacy and terms policies are stored in the database. Saved changes appear on the public site automatically. Until a database is connected, the site keeps using today's built-in values, so nothing breaks.

---
## 9. Members
One profile per person: Member ID (HLW-000123), name, email, phone, source (online, event POS, admin, migrated), registration date, status, points balance, lifetime points, lifetime spending, order count, QR code. The profile shows **one timeline** of online orders and event POS purchases.
**Identification at the iPad:** scan QR, type Member ID, phone or email.
**Privacy:** a logged-in member can read only their own profile, orders and points (enforced by the database). Staff see members only with the right permission.
**Phone number is the identity key.** SimpleLoyalty tracks points by phone number, and 46 of the 158 migrated members are only a phone with the generic name "Customer". So: each member has one verified-or-unverified phone (international format, Malaysia +60 and Singapore +65 both supported); at the POS you can look a member up by phone, and the cashier can add their real name later. When a customer registers or logs in on the website with a phone that already exists, **no second account is created**: they are linked directly to the existing profile with its points and history.
**Your decision: no verification code.** Typing a phone number that matches SimpleLoyalty links the customer. To keep this reasonably safe: the **first person to claim a profile wins** and nobody else can then take it over; staff can unlink a wrong claim; attempts are rate-limited. Be aware that anyone who knows another customer's number could claim that profile first and see its points and purchase history. This matters little while points cannot be spent. A switch (`require_phone_verification`, off by default) lets you turn on SMS/WhatsApp codes later, and **I recommend turning it on before redemption goes live.** Limit: a number reassigned to a new owner could be claimed by that person.
**One member can have several phone numbers and several SimpleLoyalty IDs** (needed for the merge you approved); every number belongs to exactly one member.
**Duplicates:** email and phone must be unique among normal members. When an offline registration syncs:
1. Server matches by email and phone.
2. Exactly one match → the sale and points go to that existing member (no new account).
3. No match → new member, temporary local ID mapped to the official ID.
4. Email matches one member and phone another (ambiguous) → record is kept, flagged **Needs Review** for you, and nothing is lost. You can merge members; history moves to the kept profile and the merged one keeps a pointer.

---
## 10. Loyalty points ledger
**Principles:** the ledger is the source of truth and is insert-only; the balance is calculated from it by the database in the same step; nothing overwrites a balance; each entry has a unique key, so a retry can never credit twice.
**Entry types:** earn, redeem, bonus, refund, adjustment, expire, opening balance. Each has member, points (+/−), related order or POS ID, event, date, description, and the **rules version** used.
**Rules:** a versioned `loyalty_settings` table (earn rate, rounding, exclusions, redeem value, minimum, maximum share of a bill, expiry, bonus rules). **Every rule starts empty and unconfirmed. Points are not awarded until the Owner enters the original rules and confirms them.** Changing rules makes a new version; old sales keep their version.
**Expiry:** none. You confirmed points never expire, so the expiry feature stays off.
**Confirmed rules (8 Nov 2026):** 1 point per RM1 spent; **shipping and discounts do not count** (I read this as: points are based on the amount paid for goods, after discounts, excluding shipping; please confirm); points never expire; **redemption is OFF**, so points are only recorded for now. Still open: rounding of fractional spend (e.g. RM25.50) and whether digital products earn points. Points stay off until those two are answered.
**Refunds and cancellations:** earned points are reversed, redeemed points returned, each as a new ledger entry. **Refunds are always allowed.** If the earned points were already spent, the reversal makes the balance negative; the member is **flagged** and a dashboard alert is raised for the administrator. The balance is never silently changed or reset to zero, and you decide how to resolve it (for example a manual adjustment with a reason).
**Manual adjustments and bonuses:** Owner **and Manager** can do these (you confirmed). A reason category and a written reason are mandatory, for example **"Missed points (backfill)"** when a fan's purchase was not recorded; always a new ledger entry and an activity-log line, never an edit.
**Online:** points are earned when an order becomes **Paid** (not when placed). Redemption is deducted at checkout and returned if the order is cancelled. *Confirmed by you.*

---
## 11. Offline redemption: DEFERRED (not built now)
**Current decision:** you asked me not to worry about offline allowances for now. So at launch the iPad POS **earns points offline, but redeems points only when online**. If a member asks to redeem while the iPad is offline, the cashier sees "Please connect to the internet to redeem points" and the sale can continue without redemption. The design below is kept for a later phase and is **not** in the first build. **Redemption itself is switched off for now** (rewards are not ready): the website and POS only record and display points.
**Problem:** with no internet the iPad cannot see if a member already spent points elsewhere, so two places could spend the same points.
**Solution: a reserved allowance ("hold").**
1. Before the event, while online, you press **Prepare event**. The server reserves an offline allowance for each eligible member (an amount you set, capped by their balance) and records it as a **hold**. Held points **cannot** be spent online, so they cannot be spent twice.
2. The iPad downloads each member's allowance with the member list.
3. At the event a member may redeem **only up to their remaining allowance**. Each redemption gets a unique ID. If they want more, the cashier sees "Not enough offline allowance. Please connect to the internet."
4. When sync returns, the server records each redemption in the ledger (once only), reduces the hold, then **releases the unused part** back to the member. Holds also expire automatically after the event.
5. If device data were tampered with and a redemption exceeds the hold, the server accepts the allowed part, flags the rest as a dispute for you, and never double-spends.
**Limits you should know:** points a member *earns* offline are not spendable offline until they sync. Members registered offline start with 0 points. Allowances lock part of members' points for the event period. Turning this on is a setting; it is **off by default** until you set the allowance.
**Alternative (later):** one-time vouchers that a member generates on their phone while logged in.

---
## 12. Events and inventory
Events have name, date, location, status (Draft → Prepared → Live → **Ended** → **Closed**). For each event you choose products, **event stock allocation** and optional **event price**. Allocating moves units out of online stock into event stock (logged), so online and event sales cannot oversell each other. When selling stops, the event is **Ended**. You then count the physical stock; the system compares your count with what the records expect (allocated − sold). Differences are flagged. Only after you or a Manager approve the reconciliation do the counted units return to online stock and the event becomes **Closed**. Event sales and allocations stay in their own records (`event_products`, `pos_transactions`), separate from online orders.
**Reports:** revenue, transactions, best sellers, new members, points earned and redeemed, exportable as CSV.
**Reconciliation principle:** *a physical sale that already happened is always recorded.* If the iPad sold more than allocated (data error, or a second device in future), the sale is saved, the stock shows a **discrepancy flag** in the dashboard, and you decide how to correct it. The iPad itself blocks sales beyond its cached event stock. Negative online stock is blocked unless you switch on "allow negative stock".

---
## 13. Offline iPad POS
**Installed web app (PWA):** add to Home Screen from Safari. Service worker caches the app files. IndexedDB holds the catalogue, event stock and prices, rules version, member lookup cache, allowances and the **outbox** of unsent records. Transactions are **never** kept in localStorage.
**Screens:** product grid with images, search, categories, stock; cart with quantities; discount; member lookup, QR scan and new-member registration; points balance, earn preview and redeem; payment method (cash, DuitNow, bank transfer, e-wallet, other); receipt; today's transaction history; device status bar. Large touch targets.
**Payments:** the POS only *records* the payment method. It never handles card details and stores none. Take cards with your own terminal if you use one.
**Each sale:** unique ID created on the iPad (UUID), device ID, readable number (e.g. IPAD1-20261107-0007), time, items with price/cost snapshots, payment method, member (or temporary ID), points earned and redeemed, rules version, event, cashier. Saved to IndexedDB **before** the receipt shows.
**Points at the POS (current decision):** offline sales earn points using the last downloaded rules; redemption is switched off at launch (and later will need a connection). The cashier sees a member's balance and the points they will earn.
**Status bar:** Online · Offline · Pending Sync (count) · Syncing · Synced (last time) · Sync Failed (reason) · **Sync now** button.
**Sync algorithm:**
1. Triggers: network comes back, app reopened or brought to front, a timer while the app is open, and the manual button.
2. Send in order: new members → sales (with their points and redemptions) → heartbeat.
3. The server processes each record in its own database transaction with `ON CONFLICT DO NOTHING`, so sending twice is harmless.
4. The iPad marks a record **Synced only after the server confirms** it (accepted or already received). Rejected or failed records stay, show the exact error, and retry with increasing delay. **Nothing is ever deleted automatically.**
5. Server writes sales, items, ledger entries, stock movements, event sold counts, sync batch log and any issues.
**Safety nets:** one-tap **Export unsent sales to a file** as backup; request persistent storage; warning before any logout or reset if unsent records exist (logout is blocked while records are unsent unless the Owner overrides).
**Real iPad limits (please read):**
- Safari has **no true background sync**. Syncing happens while the POS app is open, so open it once after the event when you have internet.
- Install to Home Screen. Safari can clear website data of rarely used *sites*, but installed Home Screen apps are treated more safely. Still: open the app online before the event so the cache is full, and sync soon after.
- Camera QR scanning in an installed web app must be **tested on your iPad**. A Bluetooth/USB barcode scanner or typing the Member ID works as backup.
- Printing uses AirPrint or on-screen/shared receipts. Direct Bluetooth thermal printers are not possible from a web app.
- Refunds at an event are not offline; do them from the dashboard afterwards.

---
## 14. Security and data protection
- **Device registration:** the Owner creates a device in the dashboard; the iPad signs in with its own device account (not the Owner's). The Owner can **revoke** it any time; a revoked device is refused by the server and wipes its local data at next contact.
- **Cashier PIN:** each staff member has a PIN, stored only as a salted hash. Wrong-PIN lockout after several tries. Every sale records which cashier made it.
- **Minimal member data on the iPad:** Member ID, name, points, allowance, and *hashed* phone/email for lookup. Full email and phone are not cached. Cleared on logout/revoke.
- **Server rules:** the POS device can only call the sync functions and read what it needs. It cannot read orders, costs, admin data or the activity log.
- **Keys:** only the public Project URL and anon/publishable key are in the website. The service_role (secret) key is never in the website or GitHub; it lives only as a Supabase secret used by Edge Functions.
- **Audit:** admin, price, stock, order, payment-detail, device and rule changes are logged immutably.
**Honest limits of a shared iPad:** if someone has the iPad unlocked, or its passcode, and uses developer tools, local data (pending sales, cached names and points) can be viewed or altered. The PIN is a deterrent and accountability tool, not strong encryption. I will **not** encrypt the outbox with the PIN, because a forgotten PIN would lose unsent sales, which you ruled out. Instead: set a strong iPad passcode (iPadOS encrypts storage), turn on Auto-Lock, use Guided Access during events, keep the iPad in your hands, and sync promptly. The server re-checks everything, so tampering cannot create points or stock that the rules do not allow.

---
## 15. Migration from SimpleLoyalty (nothing is overwritten)
Full plan, field mapping, validation checks and cut-over: **`docs/SIMPLELOYALTY-MIGRATION.md`**. Preliminary findings on the file you sent: `MIGRATION-PREVIEW-PRELIMINARY.md` (private, not in the website ZIP).
**Summary:** raw exports go into private staging tables → a dry-run report lists members, duplicates, missing data, balances, history and review items → you approve the exact report → rehearsal on a test project → backup → one all-or-nothing commit. Historical earn records become ledger entries with their **original dates** and unique legacy keys, so re-importing can never double-add. Existing member IDs are kept as a searchable `legacy_id`. Any gap between history and SimpleLoyalty's balance becomes one clearly labelled opening-balance entry that you approve. After commit, ledger totals must match SimpleLoyalty per member and overall.
**Received:** the member list (158 source profiles; **157 members after the approved merge**) and the earn log (507 rows). They agree perfectly (all 158 balances equal earned totals; 89,692 points). Full dry-run report: `MIGRATION-PREVIEW-REPORT.md` (private). **Still needed:** the points rules (earn confirmation and the redemption rule), your decisions on the review items, and your written approval. Until then nothing is imported.

## 16. Dashboard pages
Login · Overview (totals, status counts, sales, recent orders, low stock, chart) · Analytics · Orders (search, filter, status, tracking) · Products (SKU, price, cost, margin, stock, switches, images) · Inventory and reconciliation · Members (search, profile, history, points, adjustments) · Loyalty settings (Owner) · Events and event reports · POS (devices, staff PINs, transactions, pending sync, issues) · Website content (banners, announcements, About, Patreon, socials, notices) · Store settings and policies · Payment details (Owner) · Admins and roles (Owner) · Activity log (Owner) · My account (change password, logout).

## 17. Costs (check current prices yourself)
Supabase has a free plan with limits (inactive free projects can pause); a paid plan is likely once real orders and POS data matter, partly for backups. Manual bank transfer and DuitNow need no gateway. Optional: domain name, an email-sending service (Supabase's built-in email is rate-limited). iPad, AirPrint printer or barcode scanner if you want them.

## 18. Decisions
**Settled:**
- Both IDs kept (SimpleLoyalty ID + new HLW ID); lookup by either, QR or phone.
- Points rules: **1 point per RM1**; shipping and discounts do not count; **points never expire**; **redemption OFF** for now (record only).
- Customers who register or log in with a phone number matching SimpleLoyalty are **linked directly**, no verification code (first claim wins).
- Offline POS earns points; redemption is off, so no offline allowance is needed now.
- Points are added only after payment (Paid).
- Owner and Managers can adjust points manually (including backfilling missed points); **adjustments above 10,000 points need Owner approval**.
- Refunds always allowed with a negative-balance flag and alert.
- Unsold event stock returns online only after a physical count.
- Migration review: members 8207453 and 8411680 are **merged into one profile keeping both phones**; 1410567 and 3789991 stay separate; 8023101 and 8023143 are genuine.
- Marketing consent: stored as a record only; no marketing features are built.
- SimpleLoyalty stays read-only for 30 days after cut-over.
**Still needed from you:**
1. **Rounding:** when spend has cents (e.g. RM25.50), round down (25), nearest (26) or up? And do **digital products** earn points?
2. Please confirm my reading of "discounts do not count": points are based on the amount actually paid for goods (after discounts), excluding shipping.
3. **Cut-over date** (the day new points are recorded only in the new system).
4. Your **written approval** of `MIGRATION-PREVIEW-REPORT.md` (now updated).

## 19. Build order after you approve
**Phase 1 – Admin core:** database on a *test* project, owner login, roles, settings and content, products with cost and SKU, orders and manual payment, activity log, analytics.
**Phase 2 – Public site connection:** site reads from Supabase with the built-in fallback; checkout through `place_order`; WhatsApp button and editable announcements.
**Phase 3 – Members and loyalty:** registration, ledger, rules (once supplied), staging and **migration preview**, your approval, rehearsal on a test project, then live import; member pages; alerts for negative balances.
**Phase 4 – Events and iPad POS:** events and allocation, PWA, IndexedDB outbox, sync, device registration and PINs, offline redemption, reconciliation.
**Phase 5 – Member login** on the website, hardening, full test pass (including airplane-mode tests on your iPad), owner guide.
Each phase ends with testing and a new ZIP; nothing goes live without your sign-off.

---
## 20. Data ownership and future website login
**Everything in one place:** products, orders, customers (members plus guest buyers' details on their orders), memberships, points, transactions, inventory, events, POS sales, staff permissions and reports all live in your Supabase database. Nothing depends on SimpleLoyalty after cut-over.
**Member login later, with no rebuild:** every member already has `auth_user_id` (empty for now), a verified-email link rule, and `member_claim_codes`. In the login phase a member can ((a) register or log in with their phone number, which links them to the profile with the **same number** (your decision; first claim wins), or (b) sign up with the same email (only 25 of 158 migrated members have one), or (c) use a claim code you issue. Phone verification can be switched on later. The access rules already limit a logged-in member to their own profile, orders and points. Public sign-ups stay off until that phase is tested.
**Guest buyers:** online customers who are not members are stored on their orders; checkout can offer to enrol them as members.
