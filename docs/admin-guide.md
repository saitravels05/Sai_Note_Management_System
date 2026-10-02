# Sai Tours & Travels — Administrator & User Guide

**Document Reference:** `docs/admin-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels  
**Target Audience:** Business Owners, Office Administrators, and Front-Desk Staff  

---

## Welcome to Your New Accounting Platform!

This system helps **Sai Tours & Travels** track all travel bookings, customer payments, diesel/toll expenses, supplier bills, and month-end financial accounts in one place.

---

## 1. How to Log In

1. Open your web browser (Chrome, Edge, Safari, or Firefox) and go to your application address:
   `http://localhost:3000/login` (or your configured production domain).
2. The sign-in page will be pre-filled with the primary Owner credentials:
   - **Email / Username:** `saipassportmdu@gmail.com`
   - **Password:** `Saitours@2026`
3. Check **Remember me for 7 days** if you are using your private office computer.
4. Click **Sign In**. You will arrive on your main **Dashboard**.

---

## 2. Navigating Your Dashboard

Your Dashboard shows immediate answers at a glance:
- **Total Income:** Money earned from tour packages, vehicle hires, and bookings.
- **Total Expenses:** Money spent on vehicle fuel, driver batta, permits, and tolls.
- **Net Result (Profit):** Income minus Expenses.
- **Outstanding Receivables:** Money customers still owe you.
- **Outstanding Payables:** Money you owe to vendors (bus owners, hotels, mechanics).
- **Recent Activities:** Latest bookings and payments recorded.

---

## 3. Recording Daily Bookings & Expenses

### A. Recording Income or Customer Booking
1. Click **+ Add Record** in the top navigation or sidebar.
2. Select **Transaction Type:** Choose `Income` or `Receivable`.
3. Choose or type the **Customer Name** (e.g. `Meenakshi Amman Pilgrimage Group` or `சாய் டிராவல்ஸ்`).
4. Enter the **Total Amount** in Rupees (e.g. `50000.00`).
5. Select the **Payment Status:**
   - `PAID`: Customer paid in full right now.
   - `UNPAID`: Booking confirmed; customer will pay later (creates a Receivable).
   - `PARTIALLY PAID`: Customer paid an advance (e.g. ₹20,000 paid, ₹30,000 pending).
6. Click **Save & Post Record**.

### B. Recording Expenses (Fuel, Maintenance, Tolls)
1. Click **+ Add Record** and choose `Expense` or `Payable`.
2. Choose **Category:** (e.g. `Fuel / Diesel`, `Vehicle Maintenance`, `Driver Allowance`, `Taxes`).
3. Enter amount and select payment method (Cash, Bank Transfer, or UPI).
4. Click **Save & Post Record**.

---

## 4. Recording Customer Payments & Settlements

When a customer pays their pending balance:
1. Go to **Receivables** from the sidebar menu.
2. Find the customer's invoice and click **Record Payment**.
3. Enter the amount received (e.g. `₹30,000.00`) and the payment method (UPI, Bank, Cash).
4. Click **Save Payment**. The invoice status automatically updates to **PAID** and your cash balance updates.

---

## 5. Customer & Supplier Management (CRM)

1. Click **Customers** or **Suppliers** in the sidebar.
2. Click on any customer to see their complete **Ledger History** (all past trips, payments, and current balance).
3. Add **Follow-Up Notes** if you spoke to them about an upcoming balance payment.
4. Record customer **Promises to Pay** (e.g. *"Customer promised to transfer ₹15,000 on Friday"*).

---

## 6. Uploading & Managing Documents

Keep your vehicle registration copies, permit PDFs, and fuel receipts organized:
1. Click **Documents** in the sidebar.
2. Click **Upload Document**.
3. Drag and drop your file (PDF, JPG, PNG, or Excel, up to 10MB).
4. Tag it with the Customer, Supplier, or Booking Reference.
5. All documents are stored privately and securely.

---

## 7. Generating PDF Reports & Statements

Need to send a statement to a customer or review monthly profits?
1. Click **Reports** in the sidebar.
2. Choose your report type:
   - **Monthly Accounting Dossier:** Complete financial pack for the month.
   - **Customer Statement:** Itemized list of trips and payments to share with clients.
   - **Supplier Ledger Statement:** Verified payment record for bus/hotel vendors.
   - **Aging Schedule:** Shows who owes you money and for how many days.
3. Click **Download PDF** or **Export to Excel**. All reports properly format Tamil text and the Indian Rupee (`₹`) symbol.

---

## 8. Performing Month-End Closing

At the end of every calendar month:
1. Click **Month-End Closing** in the sidebar.
2. Select the month (e.g. `September 2026`).
3. The system checks your accounts and confirms that all entries balance.
4. Click **Close Financial Period**.
5. The system creates an immutable, tamper-evident snapshot of the month.
6. Once closed, nobody can accidentally change or backdate entries in that month.

---

## 9. Using the AI Assistant

Click the **AI Assistant** icon in the header or sidebar:
- Type questions in English or Tamil:
  - *"How much did we spend on diesel this month?"*
  - *"இந்த மாத செலவு எவ்வளவு?"*
  - *"Show customers who owe more than ₹20,000."*
- The AI answers using exact data from your verified accounting books. It never invents numbers.

---

## 10. Managing Users & Staff Permissions

If you are an **ADMIN** or **OWNER**:
1. Click **Settings** → **Users** in the sidebar.
2. Click **Invite User**.
3. Enter their email, name, and choose their role:
   - **ADMIN:** Can manage users, settings, and view all accounts.
   - **ACCOUNTANT:** Can enter bookings, record payments, and close months.
   - **STAFF:** Can enter daily bookings and notes (cannot delete records or close periods).
   - **VIEWER:** Can only view reports (cannot edit anything).
4. Click **Send Invitation**.

---

## 11. How to Log Out

Always log out when leaving your desk:
1. Click your profile avatar/name at the bottom of the sidebar.
2. Click **Log Out**.
3. Your secure session ends immediately.
