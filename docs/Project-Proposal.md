# Photography Studio Management — Project Proposal

**Prepared for:** _[Photographer / Studio Name]_
**Prepared by:** _[Your Name]_
**Date:** 11 October 2026
**Version:** 1.0 (Draft for Approval)

---

## 1. Purpose of This Document

This document describes the proposed web application that will replace the current paid
invoicing tool (Vyaapar). It explains **what the application will do**, **how it will work**,
**what technology will be used**, and **what is included vs. not included** in the first version.

> **Action required:** Please review this document and provide approval or requested changes
> in **Section 12 — Sign-Off** before development begins.

---

## 2. Background & Problem Statement

The studio currently uses **Vyaapar**, a paid application, to generate invoices and manage
billing. The goal is to build a **custom, free-to-run web application** tailored specifically
to a photography business, removing the recurring subscription cost while adding
photography-specific features.

---

## 3. Objectives

- Eliminate the recurring cost of the current paid software.
- Create and manage **invoices** and **quotations** for photography events.
- Maintain a reusable **client database**.
- Enable **UPI payments** via dynamic QR code and "Pay Now" link.
- Provide **PDF export** and easy **sharing** with clients.
- Track **invoice history** and **payment status**.
- Provide a clean, modern interface with **dark mode**.

---

## 4. Target Users

| User | Role |
|------|------|
| Studio Owner (Photographer) | Primary user — creates invoices/quotes, manages clients, views reports |
| Clients | Receive invoices/quotes, view and pay via UPI (no login required) |

---

## 5. Scope of Work

### 5.1 Core Features (Version 1)

#### Invoicing
- Create invoices for photography events.
- Select **event type** (Wedding, Birthday, Baby Shower, Pre-Wedding, Maternity, Corporate, etc.).
- Add **multiple services** with description, quantity, and pricing.
- Enter **client details** and **event date**.
- **Automatic calculation** of subtotal, discount, and grand total.
- Auto-generated **sequential invoice numbers** (e.g., `INV-2026-001`).
- **Preview before generation**.
- Professional, branded **invoice layout** (studio logo, name, contact).

#### Payments
- **Dynamic UPI QR code** generated per invoice (amount + studio UPI ID).
- **"Pay Now"** button using UPI deep link for direct payment from mobile.
- **Payment status** tracking: Unpaid, Partially Paid, Paid, Overdue.
- Record **advance / partial payments** and track remaining balance.

#### Quotations
- Build and send **quotations** with the same layout and services.
- **Convert an approved quotation into an invoice** in one click.

#### Clients
- Save and reuse **client details** (name, phone, email, address).
- View a client's invoice/quotation history.

#### Documents & Sharing
- **Export as PDF**.
- **Share** invoice/quote via WhatsApp, email, or a shareable link.
- **Invoice & quotation history** with search and filters.

#### Business Profile
- Studio **branding**: logo, studio name, address, contact, UPI ID.
- Customizable **terms & conditions** and **cancellation policy** text on documents.

#### Reports & Dashboard
- **Dashboard** showing **monthly income** and **pending payments** at a glance.
- Summary cards: total invoiced, total received, outstanding balance.
- Filter reports by date range, client, or event type.

#### Expenses & Profit
- **Expense tracking** (equipment, travel, editing, assistants, etc.) with categories.
- **Profit reports** = income minus expenses over a chosen period.

#### Service Packages
- Create reusable **service packages** (e.g., Wedding = pre-wedding + ceremony + album).
- Add a package to an invoice/quotation in one click, with all included services pre-filled.
- Edit package contents and pricing per invoice if needed.

#### Experience
- **Dark mode** support.
- Responsive design (works on mobile, tablet, desktop).
- Secure **login** for the studio owner.

### 5.2 Nice-to-Have Features (Future Versions)

These are **not** part of Version 1 but are recommended for later:

- **Deliverables tracking** (photos/album delivery status).
- Automated **payment reminders** (email/WhatsApp).
- **Multi-currency** support (for international clients).
- Data **backup/export** to Excel.

---

## 6. Out of Scope (Version 1)

To keep the first version focused and deliverable, the following are **excluded**:

- Online card/net-banking payment gateway (only UPI QR/deep link is included).
- Mobile app (the web app is mobile-responsive instead).
- Multi-user / staff accounts with separate permissions.
- Accounting software integration (Tally, Zoho Books, etc.).
- GST billing / GST return filing (studio is not GST-registered).

_These can be added in later phases if required._

---

## 7. Proposed Technology

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | **React (Vite)** + **Tailwind CSS** | Modern, fast, responsive UI with dark mode |
| Backend / Database | **Supabase** (PostgreSQL + Auth + Storage) | Free tier, secure login, cloud database, file storage |
| PDF Generation | `@react-pdf/renderer` | Professional PDF invoices |
| UPI QR Code | `qrcode` library | Generate QR locally, no paid API |
| Hosting | **Vercel / Netlify** (app) + **Supabase** (data) | Free hosting |

### Cost Summary
- **Software/libraries:** Free (open-source).
- **Supabase:** Free tier (sufficient for a single studio).
- **Hosting:** Free tier.
- **Only possible future cost:** Supabase paid plan (~$25/month) *only if* the business
  grows significantly and needs guaranteed uptime or more storage.
- **Domain name (optional):** ~₹800–1,000/year if a custom web address (e.g., studioname.com) is desired.

---

## 8. High-Level Data Structure

| Entity | Key Information Stored |
|--------|------------------------|
| **Business Profile** | Studio name, logo, address, contact, UPI ID, terms |
| **Client** | Name, phone, email, address |
| **Invoice** | Number, client, event type, event date, status, totals, discount, notes |
| **Quotation** | Number, client, event type, services, validity, status |
| **Line Item** | Service description, quantity, rate, amount |
| **Payment** | Amount, date, mode (UPI/cash/bank), linked invoice |
| **Service Package** | Package name, event type, included services, default price |
| **Expense** | Date, category, description, amount, optional linked event/invoice |

---

## 9. Sample User Flow

1. Owner logs in to the application.
2. Selects **Create Invoice** → picks event type (e.g., Wedding).
3. Chooses an existing client or adds a new one.
4. Adds services (e.g., Photography, Videography, Album) with prices.
5. App auto-calculates subtotal, discount, and grand total.
6. Owner **previews** the invoice.
7. App generates a **UPI QR code** and **Pay Now** link.
8. Owner **downloads the PDF** or **shares** it with the client via WhatsApp.
9. Client pays via UPI; owner marks the invoice **Paid** (or records a partial payment).
10. Invoice is stored in **history** for future reference.

---

## 10. Wireframes (Layout Preview)

These are rough text-based layouts to show structure and placement, **not** the final visual
design. Colours, fonts, and spacing will be polished during development.

### 10.1 Dashboard

```
+---------------------------------------------------------------+
|  [Logo] Studio Name            Dashboard  Invoices  Clients  (D)|
+---------------------------------------------------------------+
|                                                               |
|  +----------------+  +----------------+  +----------------+    |
|  | This Month     |  | Received       |  | Pending        |    |
|  |  Rs. 1,20,000  |  |  Rs. 90,000    |  |  Rs. 30,000    |    |
|  +----------------+  +----------------+  +----------------+    |
|                                                               |
|  +----------------+  +----------------+                       |
|  | Expenses       |  | Profit         |                       |
|  |  Rs. 25,000    |  |  Rs. 65,000    |                       |
|  +----------------+  +----------------+                       |
|                                                               |
|  Monthly Income  [ ||  |||  ||||  |||  ||||| ]  (bar chart)    |
|                                                               |
|  Recent Invoices                                              |
|  INV-2026-012  Sharma Wedding   Rs.45,000   [ Paid ]          |
|  INV-2026-011  Patel Birthday   Rs.12,000   [ Pending ]       |
+---------------------------------------------------------------+
```
_(D) = Dark-mode toggle._

### 10.2 Create / Edit Invoice

```
+---------------------------------------------------------------+
|  Create Invoice                             [ Preview ] [Save]|
+---------------------------------------------------------------+
|  Client:  [ Select client  v ] [ + New ]                      |
|  Event:   [ Wedding        v ]   Event Date: [ 2026-12-05 ]   |
|  Invoice No: INV-2026-013 (auto)                              |
|                                                               |
|  Add Package: [ Wedding Full  v ] [ Add ]                     |
|  ---------------------------------------------------------    |
|  Service              Qty    Rate        Amount    [x]        |
|  Pre-wedding shoot     1     15,000      15,000    [x]        |
|  Ceremony coverage     1     25,000      25,000    [x]        |
|  Album (30 pages)      1     10,000      10,000    [x]        |
|  [ + Add service ]                                            |
|  ---------------------------------------------------------    |
|                                   Subtotal :  50,000         |
|                                   Discount : [  2,000 ]      |
|                                   TOTAL    :  48,000         |
|                                                               |
|  Notes / Terms: [ .................................... ]      |
+---------------------------------------------------------------+
```

### 10.3 Invoice Preview (with UPI Payment)

```
+---------------------------------------------------------------+
|  [Logo]  STUDIO NAME                         INVOICE          |
|  Address, Phone, Email                  No: INV-2026-013      |
|                                         Date: 2026-10-11      |
+---------------------------------------------------------------+
|  Bill To: Mr. Sharma, Phone, Address                          |
|  Event: Wedding          Event Date: 2026-12-05               |
+---------------------------------------------------------------+
|  Service              Qty    Rate        Amount               |
|  Pre-wedding shoot     1     15,000      15,000               |
|  Ceremony coverage     1     25,000      25,000               |
|  Album (30 pages)      1     10,000      10,000               |
|                              Subtotal :  50,000               |
|                              Discount :   2,000               |
|                              TOTAL    :  48,000               |
+---------------------------------------------------------------+
|   +-----------+                                               |
|   |  QR CODE  |   Scan to pay via UPI                         |
|   |  [#####]  |   [  Pay Now  ]                               |
|   +-----------+                                               |
|                                                               |
|  Terms & Conditions ...                                       |
|                                                               |
|  [ Download PDF ]   [ Share on WhatsApp ]   [ Mark Paid ]     |
+---------------------------------------------------------------+
```

### 10.4 Expenses

```
+---------------------------------------------------------------+
|  Expenses                                   [ + Add Expense ] |
+---------------------------------------------------------------+
|  Date         Category      Description        Amount         |
|  2026-10-02   Travel        Sharma venue       2,500          |
|  2026-10-04   Editing       Freelance editor   8,000          |
|  2026-10-05   Equipment     Lens rental        3,500          |
|  ---------------------------------------------------------    |
|  Total Expenses (Oct):  Rs. 14,000                            |
+---------------------------------------------------------------+
```

---

## 11. Delivery Phases (Milestones)

Development will be delivered in reviewable milestones rather than all at once:

| Phase | Deliverable |
|-------|-------------|
| **Phase 1** | Project setup, login, business profile, client management |
| **Phase 2** | Service packages + invoice creation with services and auto-calculation |
| **Phase 3** | Invoice preview, PDF export, UPI QR code & Pay Now |
| **Phase 4** | Quotations + convert-to-invoice |
| **Phase 5** | Invoice history, payment tracking, expense tracking |
| **Phase 6** | Dashboard & reports (income, pending payments, profit), dark mode polish |
| **Phase 7** | Testing, feedback, and deployment |

_(Specific timelines to be discussed and agreed separately.)_

---

## 12. Assumptions

- The studio has (or can create) a **UPI ID** for receiving payments.
- A **studio logo** and business details will be provided for branding.
- The studio is **not GST-registered**, so invoices will not include GST/tax breakdowns.
- The owner is the **only user** who needs to log in for Version 1.
- Internet connection is available when using the application.

---

## 13. Sign-Off

Please confirm your approval or note any changes below.

| Item | Response |
|------|----------|
| Do the listed features meet your needs? | ☐ Yes ☐ Needs changes |
| Are any important features missing? | _______________________ |
| Is the UPI-only payment approach acceptable for V1? | ☐ Yes ☐ No |
| Approval to begin development? | ☐ Approved ☐ Not yet |

**Approved by:** ____________________  **Date:** ____________

---

### Notes / Additional Requests
_(Space for the photographer to add anything else he needs.)_

```
________________________________________________________________

________________________________________________________________

________________________________________________________________
```
