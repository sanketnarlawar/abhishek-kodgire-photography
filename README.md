# Studio Manager — Photography Studio Management

A free web application for photographers to create invoices and quotations, manage clients,
track payments and expenses, and get paid via UPI — built with React, Vite, Tailwind CSS,
and Supabase.

## Features
- 🔐 Secure owner login
- 🧾 Invoices for photography events (Wedding, Birthday, Baby Shower, etc.)
- 📦 Reusable **service packages** (add a whole bundle in one click)
- 👥 Client database
- 💰 **UPI QR code** + **Pay Now** link on every invoice
- 📄 **PDF export** and WhatsApp **sharing**
- 💳 Payment tracking (partial payments, balance, status)
- 📝 Quotations with one-click **convert to invoice**
- 📉 Expense tracking
- 📊 Dashboard: monthly income, pending payments, profit
- 🌙 Dark mode

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) + Tailwind CSS |
| Backend / DB / Auth | Supabase (PostgreSQL) |
| PDF | `@react-pdf/renderer` |
| QR code | `qrcode` |
| Charts | `recharts` |

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Connect Supabase
Follow the step-by-step guide in [`supabase/SETUP.md`](./supabase/SETUP.md):
- create a free Supabase project,
- run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor,
- copy `.env.example` to `.env` and paste your Project URL + anon key.

### 3. Run the app
```bash
npm run dev
```
Open the URL shown (default `http://localhost:5173`), sign up, then fill in your
**Business Profile** (studio name, logo, UPI ID).

### 4. Build for production
```bash
npm run build
npm run preview
```

## Deployment (free)
- Push this project to GitHub.
- Import it into **Vercel** or **Netlify**.
- Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the
  hosting dashboard.
- Deploy.

## Project Structure
```
src/
  components/     Reusable UI (Layout, Modal, LineItemsEditor, InvoicePDF, UpiQr, icons)
  contexts/       Theme (dark mode) and Auth providers
  lib/            Supabase client + formatting/helpers
  pages/          Dashboard, Invoices, Quotations, Clients, Packages, Expenses, Settings
supabase/
  schema.sql      Database tables + Row Level Security
  SETUP.md        Supabase setup walkthrough
docs/
  Project-Proposal.md   Proposal/requirements document
```

## Notes
- All data is private per user via Supabase Row Level Security.
- The studio is not GST-registered, so invoices intentionally omit GST/tax fields.
