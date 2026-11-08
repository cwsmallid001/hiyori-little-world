# Supabase setup guide for beginners

Do these steps **in order**. Do **not** run any SQL yet: I will give you the final, tested SQL after you approve the plan. Supabase screens change over time, so a label may differ a little. If something does not match, tell me what you see.

**Never send me:** your database password, the `service_role` / "secret" key, or any login password.

## Part A. Before you start
1. Choose an email you control (your business email is best). Turn on two-step login for it.
2. Install a password manager (or write passwords on paper kept safe). You will create 2 important passwords: the **database password** and your **owner login password**.

## Part B. Create your Supabase project
1. Go to **supabase.com** and click **Start your project**. Sign up with your email (or GitHub).
2. Click **New project**. If asked, create an **Organization** (name it "Hiyori's Little World", type Personal).
3. Fill in the form:
   - **Name:** `hiyori-little-world`
   - **Database password:** click **Generate a password**, then **copy and save it** in your password manager. You cannot see it again later (you can reset it).
   - **Region:** choose **Southeast Asia (Singapore)**. It is closest to Malaysia.
   - **Plan:** the Free plan is fine to start and test. Read the limits shown. Free projects can pause when unused, and backups are limited.
4. Click **Create new project** and wait 1 to 3 minutes until the dashboard appears.

## Part C. Safety settings
1. Left menu → **Authentication** → **Sign In / Providers** (or **Providers**) → **Email**.
2. Turn **off** "Allow new users to sign up" (it may be under **Authentication → Sign In / Up**). This stops strangers creating accounts. We turn customer login on later.
3. Keep **Confirm email** switched **on**.
4. **Authentication → URL Configuration:** set **Site URL** to your website address, for example `https://YOUR-USERNAME.github.io/hiyori-little-world/`. Add the same address (and later `/admin/` and `/pos/` pages) under **Redirect URLs**.
5. Optional but recommended: **Authentication → Multi-Factor** (MFA): make sure it is enabled. After the dashboard exists, you will turn it on for your own login with an authenticator app.

## Part D. Create your Owner login
1. **Authentication → Users → Add user → Create new user.**
2. Enter your email and a **strong, unique password** (save it). Tick **Auto Confirm User**.
3. Click **Create user**. You will see your user in the list. Later I give you one short SQL line that marks this user as the **Owner**.

## Part E. Check your plan and billing
1. Bottom-left (or **Organization → Billing**): note which plan you are on.
2. Free plan: fine for testing. Before taking real orders, decide whether to upgrade (backups and no pausing). Check Supabase's **current** pricing page.
3. If you upgrade later, look at the **spend cap** setting so a bill cannot surprise you.

## Part F. Find the two public details to send me
1. **Project Settings** (gear icon) → **API** (or **API Keys**).
2. Copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
3. Copy the **anon public** key. Newer screens may call it the **publishable** key.
4. Send me those two. They are designed to be public, and the database rules protect your data.
5. **Do not send** the `service_role` key (newer screens call it **secret** key). Treat it like a bank PIN.

## Part G. What happens next (I do this; you review)
1. I send the final SQL. You paste it in **SQL Editor → New query → Run**, first on a **test project** (create a second, free "test" project the same way), then on the real one.
2. I give you the one-line SQL to make your user the **Owner**.
3. I add the Project URL and anon key to `js/supabase-config.js`.
4. We test: owner login, a test product, a test order, a role with limited access.

## Part H. Backups and habits
- Free plan: no automatic daily backups. Use **Table Editor → Export as CSV** for products, orders and members regularly (weekly, and before big changes).
- Never share the Owner login. Give each helper their own account and role.
- Use a long unique password and an authenticator app for MFA.

## Part I. iPad POS preparation (later phase)
1. Update iPadOS. Use Safari.
2. Open the POS address on the iPad, tap **Share → Add to Home Screen**, open it from the new icon.
3. Open it **with Wi-Fi** before the event so products and members download. A green "Ready for offline" message will show.
4. After the event, open it with internet to sync. Check "Pending 0".
5. Set a strong iPad passcode and Auto-Lock.

## Troubleshooting
- **Cannot log in later:** check the user is confirmed in Authentication → Users.
- **Confirmation or reset emails missing:** Supabase's built-in email is rate-limited. A proper email service can be added.
- **"Project paused":** on the free plan, open the dashboard and click **Restore**.

## Quick checklist
- [ ] Supabase account created
- [ ] Project created (Singapore), database password saved
- [ ] Public sign-ups OFF, email confirmation ON
- [ ] Site URL set
- [ ] Owner user created
- [ ] Project URL and anon/publishable key copied
- [ ] Original points rules and member list gathered (for the migration)
