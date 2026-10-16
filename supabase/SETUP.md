# Supabase Setup — Step by Step

This guide connects the app to a free Supabase backend. Do this once.

## 1. Create a Supabase account & project
1. Go to **https://supabase.com** and sign up (free).
2. Click **New project**.
3. Pick a name (e.g. `studio-manager`), set a strong **database password** (save it somewhere), and choose the region closest to you (e.g. **Mumbai**).
4. Wait ~1–2 minutes for the project to be ready.

## 2. Create the database tables
1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Open the file [`schema.sql`](./schema.sql) from this project, copy **all** of it, and paste it into the editor.
4. Click **Run**. You should see "Success". This creates all tables and security rules.

## 3. Get your API keys
1. In the left sidebar, open **Project Settings** (the gear icon) → **API**.
2. Copy these two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

> The **anon** key is safe to use in the app. Never share the **service_role** key.

## 4. Add the keys to the app
1. In the project folder, make a copy of `.env.example` and rename the copy to **`.env`**.
2. Paste your values:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Save the file.

## 5. Create the owner login
Option A — from the app:
1. Run `npm run dev` and open the app.
2. On the login screen, click **Sign up**, enter your email and a password.

Option B — from Supabase:
1. Go to **Authentication → Users → Add user** and create the account.

> **Tip:** To skip email confirmation while testing, go to
> **Authentication → Providers → Email** and turn **"Confirm email"** off.

## 6. Run the app
```
npm install
npm run dev
```
Sign in, open **Business Profile**, fill in your studio name and **UPI ID**, and start creating invoices.

---

### Notes
- Each user account only sees its own data (enforced by Row Level Security).
- Free projects pause after ~7 days of no activity; one click in the dashboard resumes them.
