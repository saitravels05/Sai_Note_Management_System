# Sai Tours & Travels — Secure Document Management Guide

**Document Reference:** `docs/document-management-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Front-Desk Staff, Fleet Managers, and Accountants  

---

## 1. Overview & Security Architecture

The platform includes a dedicated **Secure Document Vault** designed for travel operations. It allows your team to attach, categorize, version, and preview operational files such as vehicle permits, driver licenses, tour agreements, and fuel receipts.

- **Private Cloud Storage:** Files are never stored in a publicly accessible web folder.
- **Unguessable Cryptographic Keys:** Files are saved using UUID-based storage keys. Filenames like `../../secret` are sanitized to prevent directory traversal attacks.
- **Short-Lived Signed URLs:** Download and preview links expire automatically after a short window (15 minutes).
- **Tenant Isolation:** Users from another business cannot view, guess, or download your documents.

---

## 2. Document Categories & Supported Formats

| Category | Typical Use Cases | Permitted File Types | Max File Size |
|---|---|---|---|
| **Invoice / Bill** | Vendor diesel bills, coach hire invoices, hotel receipts | PDF, PNG, JPG, WEBP | 10 MB |
| **Payment Proof** | Bank transfer screenshots, UPI payment receipts, cheques | PNG, JPG, PDF | 10 MB |
| **Agreement / Contract** | School tour packages, corporate bus lease agreements | PDF, DOCX | 10 MB |
| **Vehicle / Permit Doc** | RTO permits, fitness certificates, insurance policies | PDF, PNG, JPG | 10 MB |
| **Customer / Identity** | Passenger identity proofs, passport copies for international packages | PDF, JPG, PNG | 10 MB |
| **Spreadsheet / Notes** | Passenger rooming lists, itinerary Excel sheets | XLSX, CSV | 10 MB |

---

## 3. How to Upload & Link Documents

1. Navigate to **Documents** in the sidebar.
2. Click **Upload Document**.
3. Select your file or drag and drop it into the upload box.
4. Fill in the metadata:
   - **Document Name:** e.g. `Bus KA-01-F-1234 RTO Permit 2026-2027`
   - **Category:** Choose appropriate category.
   - **Entity Association:** Link to a specific `Customer`, `Supplier`, or `Transaction Reference`.
   - **Sensitivity Flag:** Check *Mark as Sensitive* if the document contains confidential employee or customer identification.
5. Click **Upload & Save**.

---

## 4. Document Versioning & Updates

When a vehicle fitness certificate or insurance policy renews:
1. Open the existing document in `/documents/[id]`.
2. Click **Upload New Version**.
3. Select the updated PDF.
4. The system increments the version to `Version 2` and sets it as the active version.
5. All previous versions (`Version 1`) remain accessible in the version history for compliance audits.

---

## 5. Previewing & Downloading Safely

- **In-Browser Preview:** Clicking **Preview** opens an in-browser sandbox viewer for PDFs and images. It never downloads the file permanently to your public downloads folder.
- **Authorized Download:** Clicking **Download** requests an ephemeral, signed download link verified against your user permissions.
- **Sensitive Documents:** Documents marked as *Sensitive* require the `documents.view_sensitive` permission to view or download.

---

## 6. Retention, Archiving & Deletion

- **Archiving:** If a tour concludes or a vehicle is sold, click **Archive Document**. The document is hidden from daily operational lists but remains permanently preserved for tax audits.
- **Deletion:** Only `OWNER` accounts can permanently delete a document, provided it is not linked to a locked month-end closing pack.
