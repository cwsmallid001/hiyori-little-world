-- ======================================================================
-- HIYORI'S LITTLE WORLD - PROPOSED UNIFIED DATABASE  (version 5: independent of SimpleLoyalty, phone identity, one member = many phones/legacy IDs)
-- Online store + Admin Dashboard + Members + Loyalty ledger + Events + iPad POS
--
-- STATUS: PROPOSAL FOR REVIEW.
--   * NOT RUN against any database.
--   * NOT SYNTAX-CHECKED (no PostgreSQL available where it was written).
--     Expect small fixes when it is first run on a throw-away test project.
--   * Contains NO secrets, NO real member data, NO invented points rules.
--   * Server functions (place_order, pos_sync, ...) are listed at the bottom
--     and will be written and tested AFTER you approve this design.
-- ======================================================================
create extension if not exists pgcrypto;

-- ======================================================================
-- 1. ADMIN ACCOUNTS, ROLES, PERMISSIONS
-- ======================================================================
create table admin_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null check (role in ('owner','manager','order_staff','content_editor','cashier')),
  active       boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
-- Exactly one Owner (you). Ownership transfer = a special owner-only function later.
create unique index admin_one_owner on admin_users (role) where role = 'owner';

create table role_permissions (
  role       text not null,
  permission text not null,
  primary key (role, permission)
);

create function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a join role_permissions rp on rp.role = a.role
    where a.user_id = auth.uid() and a.active and rp.permission = p);
$$;
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid() and active);
$$;

-- Permission matrix (editable later by the Owner). Owner gets EVERYTHING.
insert into role_permissions (role, permission)
select 'owner', unnest(array[
  'dashboard.view','analytics.view','products.read_all','products.write','stock.write','costs.read','costs.write',
  'categories.write','collections.write','orders.read','orders.update_status','orders.refund',
  'members.read','members.write','points.adjust','loyalty.rules','events.read','events.write',
  'pos.view','pos.manage','pos.use','inventory.reconcile','content.write','settings.write','policies.write',
  'payment.write','admins.manage','audit.read','export.data']);
insert into role_permissions (role, permission)
select 'manager', unnest(array[
  'dashboard.view','analytics.view','products.read_all','products.write','stock.write','costs.read','costs.write',
  'categories.write','collections.write','orders.read','orders.update_status','orders.refund',
  'members.read','members.write','points.adjust','events.read','events.write',
  'pos.view','pos.manage','inventory.reconcile','content.write','settings.write','policies.write','export.data']);
  -- manager can NOT: loyalty.rules, payment.write, admins.manage, audit.read
insert into role_permissions values
  ('order_staff','dashboard.view'),('order_staff','orders.read'),('order_staff','orders.update_status'),('order_staff','members.read'),
  ('content_editor','dashboard.view'),('content_editor','content.write'),
  ('cashier','pos.use');

-- ======================================================================
-- 2. STORE SETTINGS, CONTENT, POLICIES, PAYMENT DETAILS  (no code edits needed)
-- ======================================================================
create table store_settings (            -- one row: store information
  id int primary key default 1 check (id = 1),
  store_name text not null default 'Hiyori''s Little World',
  logo_url text, description text,
  contact_email text, contact_phone text, whatsapp_number text,
  address text, operating_hours text,
  currency text not null default 'MYR',
  timezone text not null default 'Asia/Kuala_Lumpur',
  shipping_rates jsonb not null default '{}',     -- fees + free-shipping threshold
  allow_negative_stock boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into store_settings (id) values (1);

create table site_content (               -- announcements, About text, Patreon, socials, notices
  key text primary key,
  value jsonb not null default 'null',
  updated_at timestamptz not null default now()
);
insert into site_content (key, value) values
  ('announcements','[]'),('about','""'),('patreon_url','""'),('socials','[]'),('notices','[]');

create table policies (                    -- shipping / returns / privacy / terms
  key text primary key check (key in ('shipping','returns','privacy','terms')),
  title text not null, body text not null default '',
  is_draft boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into policies (key, title) values
  ('shipping','Shipping Policy'),('returns','Return and Refund Policy'),('privacy','Privacy Policy'),('terms','Terms & Conditions');

create table payment_methods (             -- Manual Bank Transfer + DuitNow. OWNER-ONLY to edit.
  id text primary key check (id in ('bank_transfer','duitnow')),
  label text not null, active boolean not null default false,
  account_name text, bank_name text, account_number text,
  duitnow_id_type text check (duitnow_id_type in ('mobile','nric','business_reg','vpa')),
  duitnow_id text, qr_image_url text, instructions text,
  sort int not null default 0, updated_at timestamptz not null default now()
);
insert into payment_methods (id, label, sort) values ('bank_transfer','Bank Transfer',1),('duitnow','DuitNow',2);

create table banners (
  id bigint generated always as identity primary key,
  title text, subtitle text, image_url text, link_url text,
  sort int not null default 0, active boolean not null default true,
  starts_at timestamptz, ends_at timestamptz
);

-- ======================================================================
-- 3. CATALOGUE, COST PRICE, SKU, STOCK LEDGER
-- ======================================================================
create table categories ( id text primary key, name text not null, sort int not null default 0 );
create table collections (
  id text primary key, title text not null, title_jp text, description text,
  release_date date, cover_url text, photos jsonb not null default '[]',
  active boolean not null default true, sort int not null default 0
);
create table products (
  id            text primary key,                          -- existing IDs kept, e.g. PB-001
  sku           text unique,                               -- stock-keeping unit
  name          text not null check (char_length(name) between 1 and 120),
  description   text, spec text,
  category_id   text references categories(id),
  collection_id text references collections(id) on delete set null,
  price         numeric(10,2) not null check (price >= 0), -- SELLING price (public)
  type          text not null default 'physical' check (type in ('physical','digital')),
  stock         int  not null default 0 check (stock >= 0),-- ONLINE pool. Event stock is held separately.
  low_stock_at  int  not null default 10,
  sold_out      boolean not null default false,
  active        boolean not null default true,
  featured      boolean not null default false,
  is_new        boolean not null default false,
  bestseller    boolean not null default false,
  fan_favourite boolean not null default false,
  popularity    int not null default 50,
  images        jsonb not null default '[]',
  variations    jsonb not null default '[]',
  preorder      jsonb,                                     -- {opens,closes,ships,shipConfirmed}
  limited_total int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- COST PRICE lives in its OWN table so it can never leak through the public product list.
create table product_costs (
  product_id text primary key references products(id) on delete cascade,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  updated_at timestamptz not null default now()
);
create table stock_movements (             -- every stock change, forever (append-only)
  id bigint generated always as identity primary key,
  product_id text not null references products(id),
  delta int not null, stock_after int,
  reason text not null check (reason in ('online_sale','pos_sale','restock','manual_adjustment',
          'order_cancel_return','order_refund_return','event_allocation','event_return','correction')),
  reference text, event_id uuid, note text,
  actor_id uuid, actor_label text, created_at timestamptz not null default now()
);

-- ======================================================================
-- 4. EVENTS (physical selling events)  - separate from online pre-orders
-- ======================================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null, starts_on date not null, ends_on date, location text,
  status text not null default 'draft' check (status in ('draft','prepared','live','ended','closed')),
  -- ended  = selling finished, waiting for the physical stock count
  -- closed = stock counted and reconciled, unsold stock returned to the online store
  notes text, created_at timestamptz not null default now()
);
create table event_products (               -- event stock allocation + event-specific price
  event_id   uuid not null references events(id) on delete cascade,
  product_id text not null references products(id),
  allocated_qty int not null default 0 check (allocated_qty >= 0),  -- taken OUT of online stock
  event_price   numeric(10,2) check (event_price >= 0),              -- null = normal price
  sold_qty      int not null default 0,                              -- from synced POS sales
  expected_unsold int generated always as (allocated_qty - sold_qty) stored,   -- what the records say is left
  counted_unsold  int,                                               -- what you physically counted
  returned_qty    int not null default 0,                            -- actually returned to online stock (after approval)
  reconciled_at timestamptz, reconciled_by uuid,
  primary key (event_id, product_id)
);

-- ======================================================================
-- 5. MEMBERS (one central profile for online + event customers)
-- ======================================================================
create sequence member_no_seq start 1;
create table members (
  id            uuid primary key default gen_random_uuid(),
  member_no     text not null unique default ('HLW-' || lpad(nextval('member_no_seq')::text, 6, '0')),
  auth_user_id  uuid unique references auth.users(id) on delete set null,   -- set when member gets a website login
  full_name     text not null,
  email         text, email_norm text generated always as (lower(trim(email))) stored,
  phone         text,
  phone_norm    text,                                      -- international digits (e.g. 60123456789, 6591234567), set by server function. THE identity key for migrated members.
  phone_verified_at timestamptz,                           -- set only after the customer proves they own the number (one-time code)
  name_is_placeholder boolean not null default false,      -- true for SimpleLoyalty's generic "Customer" profiles
  birthday      date,
  marketing_opt_in boolean not null default false, marketing_changed_at timestamptz,
  legacy_meta   jsonb not null default '{}',               -- other SimpleLoyalty fields kept for reference (tier, visits, store...)
  status        text not null default 'active' check (status in ('active','suspended','needs_review','merged')),
  registration_source text not null check (registration_source in ('online','pos_event','admin','migrated')),
  registered_at timestamptz not null default now(),
  registered_event_id uuid references events(id),
  qr_token      text not null default encode(gen_random_bytes(16),'hex'),   -- secret part of the member QR
  merged_into   uuid references members(id),
  legacy_source text check (legacy_source in ('simpleloyalty')),          -- where a migrated member came from
  legacy_id     text unique,                              -- original SimpleLoyalty Member ID (kept forever, searchable)
  legacy_lifetime_points int not null default 0,          -- only used if the export has totals but no history
  legacy_lifetime_redeemed int not null default 0,
  -- Cached totals. Points ones are maintained by a trigger from the ledger; spending/orders by server functions.
  points_balance int not null default 0,
  lifetime_points_earned int not null default 0,
  lifetime_points_redeemed int not null default 0,
  negative_balance boolean not null default false,        -- flagged automatically when balance < 0
  lifetime_spending numeric(12,2) not null default 0,
  total_orders int not null default 0
);
-- No duplicate accounts: unique email and phone among normal members.
create unique index members_email_uq on members (email_norm) where email_norm is not null and status in ('active','suspended');
-- (phone uniqueness now lives in member_phones, because one member can have more than one number)
create table member_phones (                                -- ONE member can own several numbers; ONE number belongs to ONE member
  id bigint generated always as identity primary key,
  member_id uuid not null references members(id) on delete cascade,
  phone_norm text not null, phone_display text,
  is_primary boolean not null default false, verified_at timestamptz,
  active boolean not null default true,                    -- false only for a 'needs_review' duplicate awaiting a decision
  created_at timestamptz not null default now()
);
create unique index member_phones_uq on member_phones (phone_norm) where active;
create table member_legacy_ids (                            -- ONE member can carry several SimpleLoyalty IDs (e.g. after a merge)
  legacy_id text primary key, source text not null default 'simpleloyalty',
  member_id uuid not null references members(id) on delete cascade
);

create function my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where auth_user_id = auth.uid();
$$;

-- ======================================================================
-- 6. ORDERS (online store). Statuses as requested.
-- ======================================================================
create table orders (
  id              text primary key,                        -- also the bank-transfer payment reference
  created_at      timestamptz not null default now(),
  status          text not null default 'pending_payment'
                  check (status in ('pending_payment','paid','processing','shipped','completed','cancelled','refunded')),
  member_id       uuid references members(id),
  customer_name   text not null, customer_email text not null, customer_phone text not null,
  shipping_address jsonb, shipping_method text,
  payment_method  text references payment_methods(id),
  paid_at timestamptz, paid_by uuid, payment_note text,
  subtotal numeric(10,2) not null, discount numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  points_redeemed int not null default 0, points_redeem_value numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  points_earned int not null default 0, loyalty_version int,
  discount_code text, tracking_number text, admin_notes text,
  refunded_at timestamptz, refund_amount numeric(10,2),
  queue_type text check (queue_type in ('preorder','event')), queue_seq int,
  idempotency_key text unique                             -- stops double-submit of the same checkout
);
create table order_items (
  id bigint generated always as identity primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text references products(id) on delete set null,
  product_name text not null, sku text,                    -- snapshots
  options jsonb not null default '{}',
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null, unit_cost numeric(10,2),   -- cost snapshot => accurate profit later
  line_total numeric(10,2) not null
);
create table order_status_transitions (from_status text, to_status text, primary key (from_status, to_status));
insert into order_status_transitions values
  ('pending_payment','paid'),('pending_payment','cancelled'),
  ('paid','processing'),('paid','completed'),('paid','refunded'),('paid','cancelled'),
  ('processing','shipped'),('processing','refunded'),('processing','cancelled'),
  ('shipped','completed'),('shipped','refunded'),
  ('completed','refunded');                                  -- cancelled and refunded are final
create table order_status_history (
  id bigint generated always as identity primary key,
  order_id text not null references orders(id) on delete cascade,
  from_status text, to_status text not null, note text,
  changed_by uuid, changed_by_label text, changed_at timestamptz not null default now()
);
create table queue_state (
  id int primary key default 1 check (id = 1),
  mode text not null default 'preorder' check (mode in ('preorder','event')),
  served int not null default 0, baseline_preorder int not null default 0, baseline_event int not null default 0,
  event_id uuid references events(id), event_name text
);
insert into queue_state (id) values (1);

-- ======================================================================
-- 7. iPad POS: DEVICES, STAFF, TRANSACTIONS (never mixed with pre-orders)
-- ======================================================================
create table pos_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                       -- e.g. "Event iPad"
  auth_user_id uuid unique references auth.users(id),       -- the device's own login (revocable)
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  registered_at timestamptz not null default now(), registered_by uuid,
  last_seen_at timestamptz, last_sync_at timestamptz,
  pending_count int not null default 0, app_version text,
  wipe_requested boolean not null default false              -- device clears its local data at next contact
);
create table pos_staff (                                    -- cashier PINs (PBKDF2 hash only, never the PIN)
  id uuid primary key default gen_random_uuid(),
  name text not null, active boolean not null default true,
  pin_hash text not null, pin_salt text not null, pin_iterations int not null default 210000,
  created_at timestamptz not null default now()
);
create table pos_transactions (
  id uuid primary key,                                      -- generated ON THE IPAD => idempotency key
  txn_no text not null,                                     -- readable number, e.g. IPAD1-20261107-0007
  device_id uuid not null references pos_devices(id),
  staff_id uuid references pos_staff(id),
  event_id uuid references events(id),
  member_id uuid references members(id),
  member_temp_id text,                                      -- LOCAL-... id if member registered offline
  created_at_device timestamptz not null,                   -- when the sale happened (iPad clock)
  received_at timestamptz not null default now(),           -- when the server got it
  subtotal numeric(10,2) not null, discount numeric(10,2) not null default 0,
  points_redeemed int not null default 0, points_redeem_value numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_method text not null check (payment_method in ('cash','duitnow','bank_transfer','ewallet','other')),
  points_earned int not null default 0, loyalty_version int,
  status text not null default 'completed' check (status in ('completed','refunded','voided')),
  flags jsonb not null default '[]',                        -- e.g. stock discrepancy, clock skew
  unique (device_id, txn_no)
);
create table pos_transaction_items (
  id bigint generated always as identity primary key,
  txn_id uuid not null references pos_transactions(id) on delete cascade,
  product_id text references products(id) on delete set null,
  product_name text not null, sku text, options jsonb not null default '{}',
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null, unit_cost numeric(10,2), line_total numeric(10,2) not null
);
create table member_temp_map (                              -- offline registration => official member
  device_id uuid not null references pos_devices(id), temp_id text not null,
  member_id uuid not null references members(id), created_at timestamptz not null default now(),
  primary key (device_id, temp_id)
);
create table sync_batches (
  id bigint generated always as identity primary key,
  device_id uuid references pos_devices(id), received_at timestamptz not null default now(),
  txn_count int, accepted int, duplicates int, rejected int, flagged int, error text
);
create table sync_issues (                                  -- things the Owner must look at
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('stock_discrepancy','duplicate_member','points_conflict','redemption_over_hold','clock_skew','rejected_txn','other')),
  ref text, details jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_by uuid, resolved_at timestamptz, resolution_note text
);

create table admin_alerts (                                  -- shown on the dashboard (email notice can be added later)
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('negative_balance','stock_discrepancy','sync_failed','duplicate_member','low_stock','approval_needed','other')),
  ref text, message text not null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  resolved_by uuid, resolved_at timestamptz, resolution_note text
);

-- ======================================================================
-- 8. LOYALTY: VERSIONED RULES + IMMUTABLE POINTS LEDGER + RESERVED OFFLINE ALLOWANCE
-- ======================================================================
-- IMPORTANT: no points rules exist in the website code, and the SimpleLoyalty export contains
-- transactions but NOT the rules. So EVERY rule below starts EMPTY and rules_confirmed = false.
-- Nothing is invented. (The export SHOWS 1 point per RM1 spent with multiplier 1.0 in all 507 rows;
-- that is evidence for the Owner to confirm, not a rule the system assumes.)
-- Points are not awarded until the Owner enters the ORIGINAL rules and confirms them.
create table loyalty_settings (
  version int primary key,                                  -- a new row for every change; old rows are kept
  effective_from timestamptz not null default now(),
  rules_confirmed boolean not null default false,
  earn_points_per_rm numeric, earn_rounding text check (earn_rounding in ('floor','round','ceil')),
  earn_excludes_shipping boolean, earn_excludes_discounts boolean, earn_excludes_digital boolean,
  redeem_rm_per_point numeric, min_redeem_points int, max_redeem_percent_of_total int,
  expiry_months int,                                        -- null = points never expire
  bonus_rules jsonb not null default '[]',
  redemption_enabled boolean not null default false,        -- OFF at launch: points are only RECORDED, not spent
  require_phone_verification boolean not null default false,-- Owner chose: link by phone number alone. Switch ON before redemption goes live.
  adjustment_approval_threshold int not null default 10000, -- manual adjustments ABOVE this need the Owner's approval
  offline_redemption_enabled boolean not null default false,
  offline_allowance_points int,                             -- reserve per member for an event (Owner decides)
  notes text, created_by uuid, created_at timestamptz not null default now()
);
-- Version 1 = rules the Owner confirmed on 8 Nov 2026. rules_confirmed stays FALSE until the two open
-- questions are answered: (1) rounding for fractional spend, (2) whether digital products earn points.
insert into loyalty_settings (version, earn_points_per_rm, earn_excludes_shipping, earn_excludes_discounts,
                              expiry_months, redemption_enabled, notes)
values (1, 1, true, true, null, false,
        'Owner-confirmed 2026-11-08: 1 point per RM1 of spend; shipping and discounts do not count; points never expire; redemption OFF (record only).');

create table points_ledger (                                -- THE source of truth. Insert-only.
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,                     -- e.g. 'pos:<txn>:earn' => never credited twice
  member_id uuid not null references members(id),
  entry_type text not null check (entry_type in ('earn','redeem','bonus','refund','adjustment','expire','opening_balance')),
  points int not null check (points <> 0),                  -- + adds, - spends/removes
  order_id text references orders(id), pos_txn_id uuid references pos_transactions(id),
  event_id uuid references events(id), reverses_id uuid references points_ledger(id),
  source text not null check (source in ('online','pos','admin','migration','system')),
  description text not null, loyalty_version int, expires_at timestamptz,
  occurred_at timestamptz not null default now(),          -- when it REALLY happened (original date for migrated rows)
  legacy_ref text,                                         -- e.g. SimpleLoyalty Collection Id
  meta jsonb not null default '{}',                        -- e.g. {"migration_run": 1}
  created_at timestamptz not null default now(), created_by uuid, created_by_label text   -- when it was RECORDED
);
create index points_ledger_legacy on points_ledger (legacy_ref) where legacy_ref is not null;

create table points_adjustment_requests (                   -- manual adjustments above the threshold wait here for the Owner
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id), points int not null check (points <> 0),
  reason_code text not null check (reason_code in ('missed_points_backfill','correction','goodwill','other')),
  reason text not null check (char_length(reason) >= 5),
  requested_by uuid not null, requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid, decided_at timestamptz, decision_note text, ledger_id uuid references points_ledger(id)
);
create index points_ledger_member on points_ledger (member_id, created_at);

create table points_holds (                                 -- reserved allowance for OFFLINE redemption
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  device_id uuid references pos_devices(id), event_id uuid references events(id),
  reserved_points int not null check (reserved_points > 0),
  used_points int not null default 0 check (used_points >= 0),
  status text not null default 'active' check (status in ('active','settled','released','expired')),
  issued_at timestamptz not null default now(), expires_at timestamptz not null
);
-- available to spend ONLINE = points_balance - sum(reserved - used) of active holds
create function points_available(m uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select points_balance from members where id = m), 0)
       - coalesce((select sum(reserved_points - used_points) from points_holds
                   where member_id = m and status = 'active'), 0);
$$;

-- ---------- SimpleLoyalty MIGRATION STAGING ----------
-- Raw exports are loaded here FIRST. Nothing touches live members/points until the Owner approves a dry-run report.
-- All staging data is private: never in GitHub, never public.
create table migration_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(), created_by uuid,
  mode text not null check (mode in ('dry_run','commit')),
  source_files jsonb not null default '[]',                -- file names + SHA-256 fingerprints
  report jsonb not null default '{}',                      -- counts, totals, duplicates, issues
  status text not null default 'previewed' check (status in ('previewed','approved','committed','failed','reversed')),
  approved_by uuid, approved_at timestamptz, committed_at timestamptz
);
create table legacy_member_import (                        -- SimpleLoyalty MEMBER LIST (file received: 18 columns, 158 rows)
  legacy_id text primary key,                              -- 'Member ID'
  phone text not null, full_name text, email text, email_status text, birthday date,
  points_balance int, total_spend numeric(12,2), lifetime_visits int,
  first_visit timestamptz, last_visit timestamptz,
  marketing_opt_in boolean, membership_tier text, raw jsonb,
  import_status text not null default 'staged' check (import_status in ('staged','matched','imported','rejected','needs_review')),
  note text
);
create table legacy_collections_import (                   -- the file you already sent: points EARNED log
  collection_id text primary key,                          -- becomes the idempotency key 'sl:collection:<id>'
  member_legacy_id text not null, collected_at timestamptz not null,
  status text, points_eligibility text, points_awarded int not null, stamps_credited int,
  spending numeric(12,2), outlet text, transaction_number text, points_type text, multiplier numeric, stamp_card_no text,
  import_status text not null default 'staged' check (import_status in ('staged','imported','rejected','needs_review')),
  note text
);
create table legacy_redemptions_import (                   -- SimpleLoyalty REDEMPTION history (not yet received; columns TBD from the real file)
  redemption_id text primary key, member_legacy_id text not null, redeemed_at timestamptz,
  points int, reward text, raw jsonb,
  import_status text not null default 'staged' check (import_status in ('staged','imported','rejected','needs_review')), note text
);
create table migration_review_items (                      -- records a human must decide on
  id bigint generated always as identity primary key,
  run_id bigint references migration_runs(id), kind text not null, ref text, details jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','accepted','fixed','excluded')),
  decided_by uuid, decided_at timestamptz, decision_note text
);

-- Future website login: a member claims their profile (no rebuild needed later).
create table member_claim_codes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  code_hash text not null, expires_at timestamptz not null, used_at timestamptz,
  created_by uuid, created_at timestamptz not null default now()
);

-- ======================================================================
-- 9. ACTIVITY LOG (who changed what). Append-only. Written by DATABASE TRIGGERS,
--    so it cannot be skipped by a buggy or malicious dashboard page.
-- ======================================================================
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid, actor_label text,                          -- e.g. "Hiyori (owner)"
  action text not null,                                     -- INSERT / UPDATE / DELETE
  table_name text not null, row_id text,
  old_data jsonb, new_data jsonb
);
create function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); lbl text; rec jsonb;
begin
  select coalesce(display_name, email) || ' (' || role || ')' into lbl from admin_users where user_id = actor;
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_log (actor_id, actor_label, action, table_name, row_id, old_data, new_data)
  values (actor, coalesce(lbl, case when actor is null then 'system' else 'user ' || actor::text end),
          tg_op, tg_table_name, rec ->> tg_argv[0],
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

-- Product price / name / listing changes (stock is logged separately in stock_movements):
create trigger audit_products after insert or delete on products for each row execute function audit_row('id');
create trigger audit_products_upd after update on products for each row
  when (old.price is distinct from new.price or old.name is distinct from new.name or old.sku is distinct from new.sku
     or old.active is distinct from new.active or old.sold_out is distinct from new.sold_out
     or old.featured is distinct from new.featured or old.category_id is distinct from new.category_id)
  execute function audit_row('id');
create trigger audit_costs    after insert or update or delete on product_costs   for each row execute function audit_row('product_id');
create trigger audit_settings after update on store_settings   for each row execute function audit_row('id');
create trigger audit_content  after update on site_content     for each row execute function audit_row('key');
create trigger audit_policies after update on policies         for each row execute function audit_row('key');
create trigger audit_payment  after update on payment_methods  for each row execute function audit_row('id');
create trigger audit_admins   after insert or update or delete on admin_users for each row execute function audit_row('user_id');
create trigger audit_loyalty  after insert on loyalty_settings for each row execute function audit_row('version');
create trigger audit_events   after insert or update or delete on events for each row execute function audit_row('id');
create trigger audit_evprod   after insert or update or delete on event_products for each row execute function audit_row('product_id');
create trigger audit_migration after insert or update on migration_runs for each row execute function audit_row('id');
create trigger audit_phones after insert or update or delete on member_phones for each row execute function audit_row('id');
create trigger audit_devices  after insert or update or delete on pos_devices for each row execute function audit_row('id');
create trigger audit_roles    after insert or update or delete on role_permissions for each row execute function audit_row('role');
create trigger audit_members  after update on members for each row
  when (old.status is distinct from new.status or old.full_name is distinct from new.full_name
     or old.email is distinct from new.email or old.phone is distinct from new.phone or old.merged_into is distinct from new.merged_into)
  execute function audit_row('id');
-- Order status changes are written to order_status_history (and audit_log) by set_order_status().

-- Every stock change (any source) becomes a stock_movements row automatically:
create function log_stock_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); lbl text;
begin
  select coalesce(display_name, email) || ' (' || role || ')' into lbl from admin_users where user_id = actor;
  insert into stock_movements (product_id, delta, stock_after, reason, reference, actor_id, actor_label)
  values (new.id, new.stock - old.stock, new.stock,
          coalesce(nullif(current_setting('app.stock_reason', true), ''), 'manual_adjustment'),
          nullif(current_setting('app.stock_ref', true), ''), actor, coalesce(lbl, 'system'));
  return null;
end $$;
create trigger products_stock_log after update of stock on products for each row
  when (old.stock is distinct from new.stock) execute function log_stock_change();

-- Append-only guards: nobody (not even an admin) can edit or delete history.
create function forbid_change() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger ledger_immutable before update or delete on points_ledger   for each row execute function forbid_change();
create trigger audit_immutable  before update or delete on audit_log       for each row execute function forbid_change();
create trigger stockmv_immutable before update or delete on stock_movements for each row execute function forbid_change();
create trigger history_immutable before update or delete on order_status_history for each row execute function forbid_change();

-- Points balance is ALWAYS derived from the ledger in the same transaction.
-- A negative balance is allowed (e.g. refund after points were spent) but is FLAGGED and raises a dashboard alert.
create function apply_ledger_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare earned int := 0; redeemed int := 0; orig text; new_bal int;
begin
  if new.entry_type in ('earn','bonus') then earned := new.points;
  elsif new.entry_type = 'redeem' and new.points < 0 then redeemed := -new.points;
  elsif new.entry_type = 'refund' and new.reverses_id is not null then
    select entry_type into orig from points_ledger where id = new.reverses_id;
    if orig in ('earn','bonus') and new.points < 0 then earned := new.points;        -- earned points taken back
    elsif orig = 'redeem' and new.points > 0 then redeemed := -new.points;          -- redeemed points given back
    end if;
  end if;
  update members set points_balance = points_balance + new.points,
         lifetime_points_earned = lifetime_points_earned + earned,
         lifetime_points_redeemed = lifetime_points_redeemed + redeemed
   where id = new.member_id returning points_balance into new_bal;
  if new_bal < 0 then
    update members set negative_balance = true where id = new.member_id;
    insert into admin_alerts (kind, ref, message)
    select 'negative_balance', new.member_id::text, 'Member balance is negative (' || new_bal || ' points). Please review the ledger.'
    where not exists (select 1 from admin_alerts where kind = 'negative_balance' and ref = new.member_id::text and status = 'open');
  else
    update members set negative_balance = false where id = new.member_id and negative_balance;
  end if;
  return null;
end $$;
create trigger ledger_apply after insert on points_ledger for each row execute function apply_ledger_entry();

-- Last owner can never be removed or deactivated.
create function protect_owner() returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and (new.role <> 'owner' or not new.active))
  then raise exception 'The Owner account cannot be removed or demoted'; end if;
  return coalesce(new, old);
end $$;
create trigger admin_owner_guard before update or delete on admin_users for each row execute function protect_owner();

-- ======================================================================
-- 10. ANALYTICS VIEWS (security_invoker => they obey the same row-level security as the tables)
--     Reports use Malaysia time. Revenue counts Paid/Processing/Shipped/Completed online orders
--     and completed POS sales. Pending, Cancelled and Refunded are excluded.
-- ======================================================================
create view v_sales_lines with (security_invoker = on) as
  select 'online'::text as channel, o.id::text as ref,
         (o.created_at at time zone 'Asia/Kuala_Lumpur')::date as sale_date, o.total
    from orders o where o.status in ('paid','processing','shipped','completed')
  union all
  select 'pos', p.id::text, (p.created_at_device at time zone 'Asia/Kuala_Lumpur')::date, p.total
    from pos_transactions p where p.status = 'completed';
create view v_sales_daily with (security_invoker = on) as
  select sale_date, channel, count(*) as orders, sum(total) as revenue from v_sales_lines group by 1, 2;
create view v_sales_monthly with (security_invoker = on) as
  select date_trunc('month', sale_date)::date as month, channel, count(*) as orders, sum(total) as revenue
    from v_sales_lines group by 1, 2;
create view v_best_sellers with (security_invoker = on) as
  select x.product_id, x.product_name, sum(x.qty) as units, sum(x.line_total) as revenue,
         sum(x.line_total - coalesce(x.unit_cost, 0) * x.qty) as profit
  from (
    select i.product_id, i.product_name, i.qty, i.line_total, i.unit_cost
      from order_items i join orders o on o.id = i.order_id where o.status in ('paid','processing','shipped','completed')
    union all
    select i.product_id, i.product_name, i.qty, i.line_total, i.unit_cost
      from pos_transaction_items i join pos_transactions t on t.id = i.txn_id where t.status = 'completed') x
  group by 1, 2;
create view v_low_stock with (security_invoker = on) as
  select id, sku, name, stock, low_stock_at from products where active and type = 'physical' and stock <= low_stock_at;
create view v_product_margin with (security_invoker = on) as   -- empty for roles without costs.read
  select p.id, p.sku, p.name, p.price, c.cost_price, p.price - c.cost_price as profit_each,
         case when p.price > 0 then round((p.price - c.cost_price) / p.price * 100, 1) end as margin_pct
  from products p join product_costs c on c.product_id = p.id;
create view v_event_summary with (security_invoker = on) as
  select e.id as event_id, e.name, count(t.id) as transactions, coalesce(sum(t.total), 0) as revenue,
         coalesce(sum(t.points_earned), 0) as points_earned, coalesce(sum(t.points_redeemed), 0) as points_redeemed,
         (select count(*) from members m where m.registered_event_id = e.id) as new_members
  from events e left join pos_transactions t on t.event_id = e.id and t.status = 'completed' group by e.id, e.name;
create view v_member_history with (security_invoker = on) as   -- one timeline per member: online + event
  select member_id, 'online'::text as channel, id as ref, created_at as at, total, status, points_earned, points_redeemed, null::text as event_name
    from orders where member_id is not null
  union all
  select t.member_id, 'event', t.txn_no, t.created_at_device, t.total, t.status, t.points_earned, t.points_redeemed, e.name
    from pos_transactions t left join events e on e.id = t.event_id where t.member_id is not null;

-- ======================================================================
-- 11. SECURITY: ROW LEVEL SECURITY. Everything locked by default, then opened narrowly.
-- ======================================================================
alter table admin_users enable row level security;      alter table role_permissions enable row level security;
alter table store_settings enable row level security;   alter table site_content enable row level security;
alter table policies enable row level security;         alter table payment_methods enable row level security;
alter table banners enable row level security;          alter table categories enable row level security;
alter table collections enable row level security;      alter table products enable row level security;
alter table product_costs enable row level security;    alter table stock_movements enable row level security;
alter table events enable row level security;           alter table event_products enable row level security;
alter table members enable row level security;          alter table orders enable row level security;
alter table order_items enable row level security;      alter table order_status_history enable row level security;
alter table queue_state enable row level security;      alter table pos_devices enable row level security;
alter table pos_staff enable row level security;        alter table pos_transactions enable row level security;
alter table pos_transaction_items enable row level security; alter table member_temp_map enable row level security;
alter table sync_batches enable row level security;     alter table sync_issues enable row level security;
alter table loyalty_settings enable row level security; alter table points_ledger enable row level security;
alter table points_holds enable row level security;     alter table legacy_member_import enable row level security;  alter table legacy_collections_import enable row level security;
alter table legacy_redemptions_import enable row level security; alter table migration_runs enable row level security;
alter table migration_review_items enable row level security;    alter table member_claim_codes enable row level security;
alter table admin_alerts enable row level security;
alter table member_phones enable row level security;     alter table member_legacy_ids enable row level security;
alter table points_adjustment_requests enable row level security;
alter table audit_log enable row level security;
-- (Tables with no policy for a role = that role cannot touch them at all.)

-- PUBLIC visitors: read published shop content only.
create policy pub_settings    on store_settings  for select using (true);
create policy pub_content     on site_content    for select using (true);
create policy pub_policies    on policies        for select using (true);
create policy pub_payment     on payment_methods for select using (active);   -- shown at checkout, like an invoice
create policy pub_banners     on banners         for select using (active);
create policy pub_categories  on categories      for select using (true);
create policy pub_collections on collections     for select using (active);
create policy pub_products    on products        for select using (active);
-- Public has NO access to: product_costs, orders, members, ledger, events, POS, audit, admin tables.

-- STAFF (permission-checked on the server for every request):
create policy adm_settings    on store_settings  for all using (has_perm('settings.write'))   with check (has_perm('settings.write'));
create policy adm_content     on site_content    for all using (has_perm('content.write'))    with check (has_perm('content.write'));
create policy adm_policies    on policies        for all using (has_perm('policies.write'))   with check (has_perm('policies.write'));
create policy adm_payment_r   on payment_methods for select using (has_perm('payment.write'));
create policy adm_payment_w   on payment_methods for update using (has_perm('payment.write')) with check (has_perm('payment.write'));  -- OWNER ONLY
create policy adm_banners     on banners         for all using (has_perm('content.write'))    with check (has_perm('content.write'));
create policy adm_categories  on categories      for all using (has_perm('categories.write')) with check (has_perm('categories.write'));
create policy adm_collections on collections     for all using (has_perm('collections.write')) with check (has_perm('collections.write'));
create policy adm_products_r  on products        for select using (has_perm('products.read_all'));
create policy adm_products_w  on products        for all using (has_perm('products.write') or has_perm('stock.write')) with check (has_perm('products.write') or has_perm('stock.write'));
create policy adm_costs       on product_costs   for all using (has_perm('costs.read')) with check (has_perm('costs.write'));
create policy adm_stockmv     on stock_movements for select using (has_perm('stock.write') or has_perm('inventory.reconcile'));
create policy adm_events      on events          for select using (has_perm('events.read'));
create policy adm_events_w    on events          for all using (has_perm('events.write')) with check (has_perm('events.write'));
create policy adm_evprod      on event_products  for select using (has_perm('events.read'));
create policy adm_evprod_w    on event_products  for all using (has_perm('events.write')) with check (has_perm('events.write'));
create policy adm_members_r   on members         for select using (has_perm('members.read'));
create policy adm_members_w   on members         for update using (has_perm('members.write')) with check (has_perm('members.write'));  -- balances change only via ledger
create policy mem_self        on members         for select using (auth_user_id = auth.uid());              -- a member sees ONLY themselves
create policy adm_orders_r    on orders          for select using (has_perm('orders.read'));
create policy mem_orders      on orders          for select using (member_id = my_member_id());
create policy adm_items_r     on order_items     for select using (has_perm('orders.read'));
create policy mem_items       on order_items     for select using (exists (select 1 from orders o where o.id = order_id and o.member_id = my_member_id()));
create policy adm_history_r   on order_status_history for select using (has_perm('orders.read'));
create policy adm_queue       on queue_state     for all using (has_perm('orders.update_status')) with check (has_perm('orders.update_status'));
create policy adm_ledger_r    on points_ledger   for select using (has_perm('members.read'));
create policy mem_ledger      on points_ledger   for select using (member_id = my_member_id());
create policy adm_holds_r     on points_holds    for select using (has_perm('members.read'));
create policy adm_loyalty_r   on loyalty_settings for select using (has_perm('members.read'));
create policy adm_pos_dev     on pos_devices     for select using (has_perm('pos.view'));
create policy adm_pos_staff   on pos_staff       for select using (has_perm('pos.manage'));
create policy adm_pos_txn     on pos_transactions for select using (has_perm('pos.view'));
create policy adm_pos_items   on pos_transaction_items for select using (has_perm('pos.view'));
create policy adm_sync        on sync_batches    for select using (has_perm('pos.view'));
create policy adm_issues      on sync_issues     for select using (has_perm('inventory.reconcile'));
create policy adm_issues_w    on sync_issues     for update using (has_perm('inventory.reconcile')) with check (has_perm('inventory.reconcile'));
create policy adm_import      on legacy_member_import for select using (has_perm('loyalty.rules'));       -- OWNER ONLY
create policy adm_import_c    on legacy_collections_import for select using (has_perm('loyalty.rules'));
create policy adm_import_r    on legacy_redemptions_import for select using (has_perm('loyalty.rules'));
create policy adm_migruns     on migration_runs for select using (has_perm('loyalty.rules'));
create policy adm_migreview   on migration_review_items for select using (has_perm('loyalty.rules'));
create policy adm_phones_r    on member_phones    for select using (has_perm('members.read'));
create policy mem_phones      on member_phones    for select using (member_id = my_member_id());
create policy adm_legacyids_r on member_legacy_ids for select using (has_perm('members.read'));
create policy adm_adjreq_r    on points_adjustment_requests for select using (has_perm('points.adjust'));   -- created/decided only via adjust_points / decide_adjustment
create policy adm_alerts_r    on admin_alerts for select using (is_admin());
create policy adm_alerts_w    on admin_alerts for update using (has_perm('points.adjust') or has_perm('inventory.reconcile'))
                                               with check (has_perm('points.adjust') or has_perm('inventory.reconcile'));
-- member_claim_codes: NO policy => only server functions can touch it.
create policy adm_audit       on audit_log       for select using (has_perm('audit.read'));
create policy adm_users_r     on admin_users     for select using (has_perm('admins.manage') or user_id = auth.uid());
create policy adm_roles_r     on role_permissions for select using (is_admin());
-- NO insert/update/delete policies exist for: orders, order_items, points_ledger, points_holds, loyalty_settings,
-- pos_*, admin_users, role_permissions, audit_log, stock_movements. Those change ONLY through the
-- permission-checked server functions below (and admin invites through an Edge Function).

-- Visitors may send a contact message (insert only):
create table enquiries (
  id bigint generated always as identity primary key, created_at timestamptz not null default now(),
  name text not null, email text not null, subject text, message text not null, handled boolean not null default false
);
alter table enquiries enable row level security;
create policy pub_enquiry on enquiries for insert with check (char_length(message) between 5 and 2000 and char_length(name) between 1 and 100);
create policy adm_enquiry on enquiries for select using (has_perm('orders.read'));
create policy adm_enquiry_w on enquiries for update using (has_perm('orders.read')) with check (has_perm('orders.read'));

-- ======================================================================
-- 12. SERVER FUNCTIONS (SECURITY DEFINER). TO BE WRITTEN + TESTED AFTER APPROVAL.
-- ======================================================================
-- Customers / website
--   place_order(payload)            validates; reads REAL prices/stock; locks stock; applies shipping+discount;
--                                    optional points redemption (ledger 'redeem'); creates order as pending_payment;
--                                    queue ticket; returns order id, total, payment instructions. Idempotent.
--   register_member(payload)        online registration (no password needed yet); dedupes by email/phone
--   get_my_profile()                logged-in member: own profile, points, history only
--   lookup_queue(order_id, email) / queue_stats()    ticket position / counts only, no personal data
-- Orders / money (permission-checked)
--   set_order_status(order, new_status, note)   enforces order_status_transitions; writes history;
--        -> 'paid'      : records paid_at/by, awards points (ledger 'earn', key 'order:<id>:earn')
--        -> 'cancelled' : returns stock + returns any redeemed points ('refund')
--        -> 'refunded'  : returns stock, reverses earned points, returns redeemed points
--   set_tracking_number(order, text)
-- Members / points
--   adjust_points(member, points, reason_code, reason)   needs 'points.adjust' (Owner + Manager); reason mandatory.
--        reason_code: 'missed_points_backfill' (fan's purchase was not recorded) | 'correction' | 'goodwill' | 'other'
--        always a new ledger row + activity-log entry; points are never edited in place
--        if abs(points) > loyalty_settings.adjustment_approval_threshold (10000) and the caller is not the Owner:
--          a points_adjustment_requests row is created + an 'approval_needed' alert; NO points move until the Owner approves
--   decide_adjustment(request, approve boolean, note)   Owner only; approving writes the ledger entry
--   grant_bonus_points(member, points, reason)
--   merge_members(from, to)                     owner/manager; moves ledger/orders/POS history, moves phones + legacy IDs to the
--                                                 kept profile (BOTH numbers stay), marks the other 'merged' with a pointer
--   expire_points()                              scheduled; ONLY if expiry_months is set in confirmed rules
--   stage_simpleloyalty_files(...)               Owner-only; loads the CSVs into the staging tables; records file SHA-256
--   preview_simpleloyalty_migration()           DRY RUN: writes ONLY a report + review items. Changes no live data.
--   commit_simpleloyalty_migration(run_id)      Owner-only; refuses unless the run is 'approved'. One database transaction.
--        members: new row per legacy member (legacy_source/legacy_id kept), duplicates matched, never overwritten
--        ledger : one 'earn'/'redeem' row per historical record, key 'sl:collection:<id>', occurred_at = original date
--        balance: if SimpleLoyalty balance differs from the history total, ONE 'opening_balance' row for the difference
--        check  : per-member ledger sum MUST equal the SimpleLoyalty balance, else the whole transaction rolls back
--   claim_member(phone)                          later phase. A customer who registers/logs in with a phone number that
--                                                 matches a migrated member is linked to that profile (first claim wins; a
--                                                 second person cannot take it over; staff can unlink). Owner's decision: no
--                                                 code needed. If loyalty_settings.require_phone_verification is switched ON,
--                                                 a one-time code is required first.
--   create_claim_code(member) / claim_with_code(code)   optional staff-issued fallback
-- Events / inventory
--   allocate_event_stock(event, product, qty)   online stock -> event stock (movement 'event_allocation')
--   prepare_event(event)                         issues offline points holds, marks 'prepared'
--   end_event(event)                             selling finished; releases unused holds; status 'ended'
--   reconcile_event(event, counts jsonb)         records the PHYSICAL count; differences become flagged corrections;
--                                                 after Owner/Manager approval returns counted stock to the online store; status 'closed'
--   resolve_alert(alert, note)
-- iPad POS (callable ONLY by an active registered device login)
--   pos_bootstrap()                              catalogue, event stock/prices, rules version, member lookup cache, holds
--   pos_sync(batch jsonb)                        per record: new members first, then sales, then redemptions;
--        INSERT ... ON CONFLICT (id) DO NOTHING (idempotent); returns accepted / duplicate / rejected(+reason) / flagged
--   pos_heartbeat(pending_count, app_version)
-- Reports
--   export_event_report(event)                   CSV-ready rows (permission 'export.data')

-- ======================================================================
-- 13. STORAGE BUCKETS (created in the dashboard or via SQL after approval)
-- ======================================================================
--   product-images, site-assets : public READ, writes need products.write / content.write, images only, size-limited
--   digital-files               : PRIVATE, signed expiring links only
--   payment-proofs (optional)   : PRIVATE, customers upload bank-transfer receipts, staff read
