# Sai Tours & Travels — Known Limitations & Architectural Boundaries

**Document Reference:** `docs/known-limitations.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Release:** V1.0 Production Release (`v1.0.0`)  

---

## 1. Purpose of This Register

To ensure total transparency between the technical engineering team and business stakeholders, this document registers all known architectural boundaries, intentional design tradeoffs, and features that are deliberately not present in **V1.0**.

---

## 2. Documented V1.0 Limitations

| Feature Domain | Current V1.0 State | Workaround / Operational Process | Planned Future Phase |
|---|---|---|---|
| **Optical Character Recognition (OCR)** | **Not Included in V1.0.** The system does not automatically scan photos of fuel slips or handwritten invoices into structured database rows. | Staff enter invoice details manually via **Quick Entry** or bulk upload via the **Excel Import Engine**. Attached PDF/images are stored for visual audit. | Evaluated for V1.1 Roadmap |
| **Direct WhatsApp Automation** | **Not Included in V1.0.** System does not send automated WhatsApp messages or booking confirmations directly to passenger phones. | Staff view phone numbers on customer profiles and dispatch messages manually via WhatsApp Web / phone. CRM logs communication notes. | Evaluated for V1.1 Roadmap |
| **Live Bank Feed Scraping** | **Not Included in V1.0.** System does not directly connect to Indian bank net-banking APIs (e.g. SBI, HDFC, ICICI) to scrape live balances. | Accountants download bank statements from net banking and import via the **Excel / CSV Import Engine** or record manual deposits. | Evaluated for V1.2 Roadmap |
| **Government GST Portal Filing** | **Not Included in V1.0.** System does not submit GSTR-1 or GSTR-3B filings directly to the GSTN portal via API. | System generates compliant **Monthly Accounting Reports (Excel & PDF)** containing exact taxable and exempt totals for manual entry into GST offline utilities. | Evaluated for V1.2 Roadmap |
| **Multi-Instance Rate Limiting** | **Single-Instance In-Memory.** Current rate limiter maintains counters in Node.js memory. | Perfectly suited for single-server, containerized, or sticky-session deployments. Multi-pod clusters require adding a Redis backend adapter. | V1.1 Infrastructure |
| **Object Storage Driver** | **Configurable Local or S3.** Defaults to local `./uploads` directory if cloud S3 environment variables are not supplied. | Local filesystem storage is fully functional for single-node hosting. S3-compatible bucket configuration required for cloud deployments. | Phase 17 Config |

---

## 3. Features Confirmed Fully Functional in V1.0

The following features were thoroughly verified and are **NOT** limitations:
- ✅ Double-entry accrual accounting engine (Income, Expense, Receivables, Payables).
- ✅ Multi-invoice payment allocations and overpayment credit tracking.
- ✅ Two-phase Excel/CSV import engine with pre-flight duplicate detection.
- ✅ Multi-page PDF generation with Tamil Unicode (`சாய் டிராவல்ஸ்`) and Rupee (`₹`) symbols.
- ✅ Month-end closing, period locking, immutable snapshots, and As-Closed vs Current reporting.
- ✅ AI Accounting Assistant with prompt injection defenses and permission guardrails.
- ✅ Customer & Supplier CRM with follow-up tracking and promise-to-pay pipelines.
- ✅ Audit Control Center with centralized secret redaction and SHA-256 hash chaining.
- ✅ Administrative backup architecture with Created vs Verified distinction and sandbox test restores.
- ✅ Server-enforced Maintenance and Read-Only disaster modes.
