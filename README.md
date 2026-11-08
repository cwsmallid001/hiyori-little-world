# Hiyori's Little World (ひよりの小さな世界)
**A Little World of Cosplay, Love & Memories.**

A cute pastel Japanese-kawaii merchandise website for a Malaysian cosplayer.
This is a **working front-end demo**: browse, cart, checkout, order queue and digital delivery all work, but **no real money, stock or orders are involved**.

> The store name and personal details are **placeholders** until Hiyori approves them.
> All products are **fictional demo items**. All photos are **placeholders**.

---

## 1. See the website on your computer

**Easiest:** double-click `index.html`. It opens in your browser.
(Everything works that way. If something looks odd, use the second way.)

**Second way (optional):** if you have Python installed, open a terminal in this folder and run `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## 2. What is in the folder

```
hiyori-little-world/
├── index.html            Home page
├── shop.html             All products (search, filter, sort)
├── product.html          Product details (one page for every product)
├── collections.html      Collections list + collection pages
├── about.html            About Hiyori
├── contact.html          Contact form (demo)
├── faq.html              FAQ
├── queue.html            Order queue (new)
├── cart.html             Shopping cart
├── checkout.html         Demo checkout
├── order-success.html    "Thank You for Your Order!"
├── policies.html         Draft policies (shipping, returns, privacy, terms)
├── css/                  style.css (colours/fonts), components.css, responsive.css
├── js/
│   ├── config.js         ★ Easy settings: name, socials, shipping, queue
│   ├── products.js       ★ All products and categories
│   ├── collections.js    ★ All collections
│   ├── cartdrawer.js     Floating cart button + cart drawer
│   ├── queue.js          Queue system
│   ├── cart.js           Cart
│   ├── checkout.js       Checkout + success page
│   ├── main.js           Header, footer, home, about, FAQ, policies
│   └── utils.js          Small helpers
├── assets/               images, logo, icons
├── docs/UPGRADE-GUIDE.md How to turn the demo into a real store
└── README.md
```
★ = the files you will edit most.

## What's new (version 2)
- **Floating cart button** (bottom-right on every page except Cart and Checkout): shows the item count, opens a drawer where customers change quantities, remove items, see totals and go straight to checkout. The cart is saved in the browser, so it survives page changes and refreshing.
- **Cosplay Gallery removed** (page, menu link, homepage preview). Collection pages keep their own photo grids.
- **Support Us on Patreon** section on the About page. Set the link in `js/config.js` (`patreonUrl`). Until then the button shows a "coming soon" note.
- The Admin Dashboard, members, loyalty points, events and iPad POS (Supabase) are **planned, not built yet**: see `docs/ADMIN-PLAN.md`, `docs/SUPABASE-SETUP-GUIDE.md` and `supabase/schema.PROPOSED.sql`.

## 3. Replace placeholders with real content

### Hero photo and profile photo
1. Put the authorized photos in `assets/images/hero/` and `assets/images/about/`.
2. Open `js/config.js` and change:
   `images: { hero: "assets/images/hero/hiyori.jpg", about: "assets/images/about/profile.jpg" }`

### Product photos
In `js/products.js`, find the product and add images:
`images: ["assets/images/products/pb-001-a.jpg", "assets/images/products/pb-001-b.jpg"]`
Leave `images: []` to keep the pastel placeholder.

### Collection photos
In `js/collections.js`, give a collection a `photos` list, e.g.
`photos: [{ title: "Behind the scenes", src: "assets/images/collections/sakura-1.jpg" }]`
Leave it out to show pastel placeholders. Photos open in a viewer on the collection page.

### Collection covers
In `js/collections.js`, set `cover: "assets/images/collections/sakura.jpg"`.

### Social links and email
In `js/config.js`, replace each `"#"` with the approved link and update `contactEmail`.

### Add a product
Copy any `P("...")` line in `js/products.js`, give it a **new unique ID**, then change name, price, category and details.
- `status`: `"regular"`, `"preorder"`, `"limited"`, `"soldout"`
- `preorder: PO(openDay, closeDay, shipDay)` are days from today. `shipConfirmed: true` changes the label from "estimated" to "confirmed".
- `limited: LT(total, remaining)` for limited editions.

### Add a collection
Copy an entry in `js/collections.js` with a new id (e.g. `col-05`), then set `collectionId: "col-05"` on the products that belong to it.

### Shipping rates and discount codes
`js/config.js` → `shipping` and `discountCodes` (demo code: `DEMO10` = 10% off).

### Colours and fonts
Top of `css/style.css` (`:root`).

## 4. The order queue system

Every order that contains a **physical** item receives a ticket.

- **Pre-order customers go first.** Tickets are `P-0037`, `P-0038`… in the order they ordered (first order = first in line).
- **Event customers follow.** Orders placed while the store is in *event mode* get `E-0001`, `E-0002`… and always line up **after the last pre-order customer**.
- Digital-only orders do not need a ticket.
- Customers see their ticket on the success page and can look it up on **Queue** using their order number or email.
- On the Queue page, the **Demo controls** let you switch between *Pre-order period* and *Event day*, serve the next customer, and reset the demo.

**Important:** in this demo the queue is saved in *one browser only*. For a real shared queue, see `docs/UPGRADE-GUIDE.md` (section: Real queue).

## 5. Publish on GitHub Pages (step by step)

1. Make a free account at **github.com**.
2. Click **+** (top right) → **New repository**. Name it `hiyori-little-world`. Choose **Public**. Click **Create repository**.
3. On the new repository page click **uploading an existing file**.
4. Unzip this project. Open the folder, **select everything inside it** (all the `.html` files and the `css`, `js`, `assets`, `docs` folders), and drag it into the browser page.
   (Drag the *contents*, so `index.html` ends up at the top level of the repository.)
5. Scroll down and click **Commit changes**.
6. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
7. Wait 1 to 3 minutes. Refresh the Pages screen. Your link will look like `https://YOUR-USERNAME.github.io/hiyori-little-world/`.

Every link in this project is relative, so it works inside that sub-folder address.

To update later: open a file on GitHub → pencil icon → edit → **Commit changes**. Or upload new photos with **Add file → Upload files** into the right folder.

## 6. What the demo does NOT do (on purpose)
- It does **not** take real payments and never asks for card details.
- Orders, stock and the queue are saved in the visitor's own browser (`localStorage`). They are **not** real and are not shared between people.
- Digital downloads are **simulated**. No private files exist in this project.
- There is **no admin login**. A secure one needs a backend (see the upgrade guide).
- All policies are **drafts** and must be written or approved by the store owner (and ideally checked by a legal adviser).

## 7. Testing summary
Tested in a real headless browser (Chromium): all 13 pages load without errors, search, category/price filters and sorting, variation selectors, add/remove/quantity, stock caps, cart saved after refresh, checkout validation, shipping and discount maths, demo order numbers, digital-only checkout, queue tickets (pre-order and event), and phone-width layouts (360 px and 390 px) with no sideways scrolling. Please also test on your own phone after publishing.

## 8. Reset demo data
Open **Queue → Reset all demo data**, or clear the site data in your browser settings.
