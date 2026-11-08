# SimpleLoyalty → Hiyori's Little World: migration and validation plan

**Status: PLAN ONLY.** No import has been run. No live data exists or was touched.
SimpleLoyalty is used **only as an export source**. After a verified migration and a short safety period, normal operations never depend on it.

**Privacy rule:** exports contain customer data. Keep them on your own computer or a private drive. **Never upload them to GitHub** (the repository is public). The project's `.gitignore` blocks the usual names, but please also do not drag them into the repository by hand. Staging happens inside your private Supabase database.

## 1. What was received and what is still needed
Received (both checked, see `MIGRATION-PREVIEW-REPORT.md`):
- `members_8_10.csv`: **158 members** with phone, name, email, birthday, Member ID, current points, total spend, visits, first/last visit, marketing opt-in/out.
- `collections_point_2026-02-27_to_2026-11-08.csv`: **507 earn transactions**.

The two files **agree perfectly**: 158 of 158 balances equal their earned totals (89,692 points), no orphan IDs, and no redemptions appear.

| Still needed | Why |
|---|---|
| Points **rules**: confirm the earning rule and rounding; the **redemption rule** (points to discount value, minimum, maximum); expiry (confirm none) | To switch on earning and redemption without guessing |
| Your decisions on the review items (report section 4) | Duplicate pair, "Customer" profiles, very high balances |
| Your written approval of the report | Nothing is imported before this |
| Confirmation that no points were collected after 11 Oct 2026, or a fresh export | So the final delta export is correct |

## 2. How each field maps
| SimpleLoyalty (collection log) | New system |
|---|---|
| Collection Id | `points_ledger.legacy_ref` and idempotency key `sl:collection:<id>` (unique, so re-import cannot double-add) |
| Member Id | `members.legacy_id` (kept as text; never altered) |
| Collection Time and Date | `points_ledger.occurred_at` (original moment, converted to Malaysia time for reports) |
| Points Awarded | ledger entry type `earn`, points = value |
| Spending | stored in `meta` for audit and for checking points against the rule |
| Status, Points Eligibility, Points Type, Multiplier, Outlet, Transaction Number, Stamps, Stamp Card No. | kept in `meta` (nothing is thrown away) |
| Phone Number | `members.phone` and normalised `phone_norm` (international digits, +60 and +65). **The identity key.** |
| Name | `full_name`; the generic name "Customer" sets `name_is_placeholder = true` |
| Email, Email Status | `email` (blank stays blank; nothing invented) |
| Birthday | `birthday` (112 members have one) |
| Opted In/Out Marketing | `marketing_opt_in` (157 in, 1 out; the opt-out is respected) |
| First Visit | `registered_at` |
| Current Points | used to **verify** the rebuilt ledger (and would create an opening-balance entry only if they ever differed) |
| Total Spend, Lifetime Visits, Membership Tier, Last Visit | `legacy_meta` and cross-checks |
| Instagram Handle, Digital Loyalty Card | empty in the export, not migrated |
| Redemptions | none exist in the data; if you later find some, they become `redeem` entries with key `sl:redemption:<id>` |

**Member IDs (decided: keep both):** the original SimpleLoyalty ID is kept as `legacy_id`, shown on the profile and searchable at the POS and dashboard. Each member also gets a new Hiyori ID (`HLW-000123`) and a QR code. Lookup works by either ID, by QR, or by **phone number**.

**Phone number is the identity key.** SimpleLoyalty identified customers by phone, and 46 members have only a phone with the generic name "Customer". They are migrated as their own profiles (flagged "name not registered"), never merged with each other. When a customer later logs in with a phone number, they are linked to the profile with the **same phone number** (your decision: no code; first claim wins), and their points and history appear. Phone numbers are stored in international format so Malaysian (+60) and Singapore (+65) numbers both work.

## 3. Process (nothing is live until you approve)
1. **Collect** all exports. Keep the originals untouched and write down each file's SHA-256 fingerprint (the preview report shows it).
2. **Stage:** load the files into private staging tables in a **test** Supabase project. Staging changes no members, orders, or points.
3. **Preview (dry run):** the system produces a report and a list of records needing review:
   - total members; members with no email, no phone, or neither
   - duplicates: same email, same phone (after cleaning formats like +60 / 0 / spaces), same name with different contact, same ID twice
   - incomplete or invalid records (bad email, impossible dates, negative points)
   - points: total earned, total redeemed, total balances, and the **gap** between history and the SimpleLoyalty balance, per member
   - historical transactions: count, date range, totals by month
   - outliers (very large awards or balances), IDs of unusual length
   - rule check: does each award equal spending × the confirmed rule?
4. **You review.** Each flagged item is accepted, corrected, merged or excluded, and your decision is recorded.
5. **You approve the report in writing** (the Owner presses Approve on that exact report version; any change creates a new report).
6. **Rehearsal:** run the commit on the *test* project and run all checks in section 4.
7. **Back up** the live project (export the tables), then **commit** to the live project in **one database transaction**: if any check fails, everything rolls back and nothing changes.
8. **Verify together:** spot-check about 10 members against SimpleLoyalty screens (including your biggest balances).

## 4. Validation checks
**Before import (file level):** row counts equal the file; every Collection Id unique; required fields present; numbers and dates parse; every Member Id in the collections log exists in the member list (orphans are listed); no row dated in the future.
**Dry run (data level):** duplicate-member rules above; points equal spending × multiplier; balances reconcile (history total vs SimpleLoyalty balance); no unexpected negatives.
**After import (system level), all must pass:**
- ledger rows equal the source rows (for the current file: 507 earn rows)
- total points equal the source (currently 89,692 earned) and match per member
- every member's ledger sum equals the SimpleLoyalty balance, or the difference is exactly one opening-balance entry that you approved
- `legacy_id` present and unique for every migrated member
- running the import again adds **0** rows (proves duplicate protection)
- no member balance changed except through a ledger entry (the database enforces this)
**Never:** invent missing history, guess rules, overwrite an existing balance, or delete a SimpleLoyalty record.

## 5. Duplicates
- During **migration**: members are matched on cleaned email and cleaned phone. One clear match = same person (no duplicate created). Conflicting matches, or the same person with different contact details, are listed for you to merge or keep separate. Nothing is auto-merged when it is ambiguous.
- During **registration** (website or iPad): the same checks run on the server. The iPad catches obvious duplicates offline from its cache; the server makes the final decision at sync (see ADMIN-PLAN section 9).
- A merge moves all history to one profile, marks the other as merged with a pointer, and is logged.

## 6. Going independent (cut-over)
1. Finish migration and verification on the test project, then the live project.
2. Choose a **cut-over date**. From that moment, award and redeem points **only** in the new system. Never in both.
3. Before cut-over, export again from SimpleLoyalty (**delta export**). Import it: the unique keys mean only the new records are added.
4. Keep SimpleLoyalty read-only for a safety period (suggested 30 days) and keep the private exports archived.
5. Customers keep their IDs and balances; tell them how to show the new QR (or keep using the old ID).
6. When you are satisfied, stop using SimpleLoyalty. Nothing in the new system calls it.

## 7. If something is wrong after commit
The ledger is append-only, so history is never edited or deleted. Fixes are **compensating entries** that reference the migration run, and every migrated row carries its run number, so a whole run can be reversed cleanly. That is why the rehearsal and the verification checks come first.

## 8. Decisions recorded (8 Nov 2026)
- **Merge:** Member IDs 8207453 and 8411680 become **one profile with both phone numbers and both SimpleLoyalty IDs** (both searchable). Their 498 + 745 earn histories are kept as separate dated ledger entries on the merged profile (total 1,243 points). Result: **157 members**, still 507 ledger rows and 89,692 points.
- **Kept separate:** 1410567 and 3789991.
- **Confirmed genuine:** 8023101 (13,740) and 8023143 (13,274).
- **Rules:** 1 point per RM1; shipping and discounts do not count; no expiry; redemption off.
- **Read-only period:** SimpleLoyalty stays read-only for 30 days after cut-over.
- **Still to confirm before the full preview is final:** rounding, digital products, my reading of "discounts do not count", and your written approval.
