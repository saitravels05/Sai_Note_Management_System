# Sai Tours & Travels — AI Accounting Assistant Guide

**Document Reference:** `docs/ai-assistant-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** All Users (Owners, Accountants, Front-Desk Staff)  

---

## 1. What the AI Assistant Is (and Is Not)

> [!IMPORTANT]
> **The Golden Trust Rule:**  
> **The AI Assistant INTERPRETS and EXPLAINS. The Accounting Engine CALCULATES.**  
> The AI never performs raw arithmetic on its own, never generates direct SQL, and never acts as an independent financial source of truth. All numbers returned by the AI are fetched directly from the verified Phase 5/10 accounting engine.

### What the AI CAN Do:
- Understand natural language questions in English and Tamil (`தமிழ்`).
- Extract timeframes, categories, customer names, and payment methods.
- Invoke authorized backend tools to query live accounting summaries, receivables, and payables.
- Explain month-over-month variances (e.g. why fuel expenses increased).
- Suggest relevant reports or filter combinations.

### What the AI CANNOT Do:
- **Cannot Execute Raw SQL:** The AI is strictly blocked from executing commands like `SELECT * FROM users`.
- **Cannot Bypass Permissions:** If a Staff user lacks `payables.view` permission, the AI refuses to disclose supplier balances.
- **Cannot Mutate Financial Records:** The AI is purely read-only; it cannot create bookings, post payments, or void transactions.
- **Cannot See Other Businesses:** The AI operates exclusively within the authenticated active `businessId`.

---

## 2. Example Questions You Can Ask

### In English:
- *"How much did we earn from tour bookings this month?"*
- *"Show total diesel and vehicle maintenance expenses for September."*
- *"Which customers owe more than ₹25,000?"*
- *"What is our current cash liquidity position?"*
- *"Compare this month's revenue with last month."*

### In Tamil (`தமிழ்`):
- *"இந்த மாத செலவு எவ்வளவு?"* (How much are this month's expenses?)
- *"இந்த மாதம் யார் பணம் தர வேண்டும்?"* (Who owes money this month?)
- *"டீசல் செலவு எவ்வளவு?"* (How much was spent on diesel?)
- *"வரவுக்கும் செலவுக்கும் உள்ள வித்தியாசம் என்ன?"* (What is the net profit/difference?)

---

## 3. Privacy & Data Minimization

When you ask the AI a question, your data is handled with strict enterprise privacy:
1. **Zero Password / Token Leakage:** User passwords, API keys, session tokens, and database connection strings are stripped from the AI payload before transmission.
2. **Context-Specific Queries:** The system does not send your entire database to the AI provider. It only sends relevant aggregated metrics needed to answer the specific prompt.
3. **No Model Training:** Enterprise API agreements prevent your proprietary travel bookings and accounting data from being used to train public foundation models.

---

## 4. How to Verify Financial Answers

Every response provided by the AI references the underlying authoritative report:
1. When the AI states: *"Total diesel expense for September is ₹42,500.00"*, you can verify this immediately by navigating to **Reports** → **Expenses by Category** and selecting `September 2026`.
2. The number on the report will match the AI's response down to the exact rupee and paisa.

---

## 5. Offline Fallback Behavior

If your internet connection to the AI provider is interrupted or the AI feature is disabled (`AI_ENABLED="false"`):
- The AI interface displays a friendly offline notification.
- **Your accounting system remains 100% operational.** All bookings, invoices, payments, PDF reports, and Excel exports function normally without interruption.
