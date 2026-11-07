# Future Upgrade Guide: from demo to real store

This guide is in plain English. You do not need to do any of it now. It explains the road ahead.

## The big rule
A website that only lives in the visitor's browser (like this demo) can never be trusted with **money, stock or orders**, because visitors can change what is in their own browser. A real store needs a **secure backend** (a server you control) that keeps the truth.

**Never put secret keys (payment secret keys, database admin keys) in JavaScript files.** Anyone can read them.

## Recommended path

| Step | What | Notes |
|---|---|---|
| 1 | **Database + login** (e.g. Supabase) | Stores products, stock, orders, customers. Has a free plan; check current limits and pricing on their site. Needs an account. |
| 2 | **Real payments** | Use a payment provider's hosted checkout. They handle card data, so you never touch it. Options include **Stripe** and Malaysian providers (for example Billplz, ToyyibPay, SecurePay, iPay88). Availability, business requirements, supported methods (FPX online banking, e-wallets, cards) and **fees differ by provider**, so compare them and ask each one. Most require a registered business or verified identity. |
| 3 | **Backend functions** | Small server programs (e.g. Supabase Edge Functions) that create payments and receive the provider's "payment confirmed" message (webhook). **Only that confirmed message may mark an order as paid.** |
| 4 | **Admin dashboard** | See below. |
| 5 | **Shipping integration** | Courier APIs or a shipping aggregator, for live rates and tracking. |
| 6 | **Legal pages** | Real shipping, returns, privacy (Malaysia PDPA) and terms, reviewed by a professional. |

Services that need **separate accounts, set-up or fees:** the database host, the payment provider, a custom domain name, email sending (order confirmations), and courier accounts. GitHub Pages itself is free for public repositories.

## How the current files map to the real system
- `js/products.js` data → a `products` table (same fields: id, name, description, category, price, images, variations, stock, type, status, collection_id, featured, is_new).
- `hlw_orders` in localStorage → an `orders` table + `order_items` table. Fields already match: order id, customer, items, variations, quantity, shipping, payment method, total, date, status.
- `checkout.js → placeOrder()` is the **one function to replace**. In the real version it sends the cart to your backend, which re-checks prices and stock from the database, creates the order, and returns a payment link.
- **Never trust prices sent from the browser.** The server must recalculate totals.

## Real stock and pre-orders
Keep stock in the database. When an order is paid, reduce stock in one safe database operation (a transaction) so two people cannot buy the last item. Pre-order open/close dates and quantity limits are checked on the server too.

## Real queue
The demo queue lives in one browser. To make it real:
1. Create a `queue_tickets` table: `id`, `order_id`, `type` (`preorder` or `event`), `created_at`, `status`.
2. Issue ticket numbers **on the server, only after payment is confirmed**, using a database counter so two people never get the same number.
3. Ordering rule (already designed in `js/queue.js`): all pre-order tickets by time first, then event tickets by time. This is just a sort: `ORDER BY type_rank, created_at`.
4. Show "people ahead of you" with a live query (Supabase Realtime can update screens automatically).
5. Staff press **Serve next** in the admin dashboard, which updates the ticket status.

## Digital downloads (secure)
- Store the files in a **private** storage bucket, never in a public website folder.
- After payment is verified, the server creates a **signed, expiring link** (e.g. valid 24 hours) with a **download limit** (e.g. 5 downloads).
- Show past orders and links in the customer's account (order history).

## Admin dashboard (future)
Planned functions: add, edit and delete products; upload images; manage categories; manage stock; manage pre-orders and limited editions; view orders; update order status; run the queue; view sales reports.
How to build it safely:
- A separate page that requires **login** (only the store owner's account has the `admin` role).
- Every admin action goes through the backend, which checks the role. Hiding a button in the page is **not** security.
- Product images are uploaded to storage; the database saves the image address.

## Other future features
Customer accounts and order history, discount codes (validated on the server, with limits and expiry), email notifications, sales analytics, and automated tests.

## A sensible order of work
1. Get Hiyori's approval for the name, photos, products and policies.
2. Replace placeholders with real content (still the demo; useful for showing her).
3. Choose the payment provider and register.
4. Build backend + database, replace `placeOrder()`.
5. Add admin dashboard, real queue, secure digital delivery.
6. Test with real small payments before launch.
