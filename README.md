# AI-Powered Notes, Data & Month-End Accounting Management System
## Brand: Sai Tours & Travels Operations & Business Ledger

A production-grade, card-first web application designed for storing daily business records, operational notes, customer bookings, ticket receipts, vendor expenses, receivables, and payables with decimal-safe accounting precision and month-end audit locks.

---

## 1. Project Purpose & Core Concept

Small and medium enterprises often suffer from **spreadsheet fatigue**: accidental cell deletions, broken formulas, and disconnected customer notes. 

This application replaces traditional spreadsheet data entry with a modern **card + form + timeline** interface:
- **15-Second Entry**: Record customer bookings, flight tickets, PNRs, hotel vouchers, and expenses without rows or columns.
- **Decimal-Safe Financial Engine**: Powered by `Decimal.js` and PostgreSQL numeric types to completely eliminate floating-point rounding errors.
- **Month-End Safeguard**: Pre-closing validation wizard, automated period locks against back-dated edits, and professional export to Excel (.xlsx), PDF, and CSV.
- **Zero-Hallucination AI**: Natural language assistant translates user queries into database filters; financial figures are strictly calculated by PostgreSQL.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4 + Radix UI Primitives + Lucide Icons
- **Branding**: Sai Tours & Travels warm orange (`#f97316`, `#ea580c`), deep slate surfaces, dark/light theme
- **Database & ORM**: PostgreSQL 15+ & Prisma ORM
- **Financial Math**: `Decimal.js` (Indian Rupee `₹` formatting, Lakhs/Crores grouping)
- **Date Handling**: `date-fns` (standard `DD-MM-YYYY`, timezone `Asia/Kolkata`)
- **Validation**: Server-side `Zod` schemas & centralized environment validation
- **Testing**: Node 24 native test runner with `tsx`

---

## 3. Prerequisites

- **Node.js**: `v20.0.0` or higher (Tested on `v24.19.0`)
- **npm**: `v10.0.0` or higher
- **PostgreSQL**: PostgreSQL 15 or higher (Local instance, Docker, or managed cloud like Supabase/Neon/RDS)

---

## 4. Installation & Setup

1. **Clone and Navigate**:
   ```bash
   cd "e:/Softwares/Sai Notes App"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the provided `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to specify your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/sai_accounting_db?schema=public"
   ```

4. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

---

## 5. Development & Production Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles optimized production bundle and pre-renders routes |
| `npm start` | Starts production HTTP server |
| `npm run lint` | Runs ESLint analysis (guaranteed 0 errors/warnings) |
| `npm run typecheck` | Executes TypeScript type-checker (`tsc --noEmit`) |
| `npm test` | Runs automated unit tests for Money, Date, and Formatting utilities |
| `npm run db:generate` | Generates typed Prisma Client from `prisma/schema.prisma` |
| `npm run db:migrate:dev` | Runs development database migrations |
| `npm run db:migrate:deploy` | Applies pending migrations in production |
| `npm run db:status` | Checks database migration sync status |
| `npm run db:validate` | Validates Prisma schema syntax |

---

## 6. Project Directory Architecture

```
sai-notes-app/
├── assets/
│   └── logo.jpg                   # Preserved original brand logo
├── prisma/
│   └── schema.prisma              # PostgreSQL database schema & models
├── public/
│   └── brand/logo.jpg             # High-res favicon and UI logo
├── src/
│   ├── app/                       # 25 App Router routes & API endpoints
│   │   ├── (dashboard) routes     # Dashboard, records, income, expenses, etc.
│   │   ├── api/health/route.ts    # Secure health check endpoint
│   │   ├── error.tsx              # Centralized client error boundary
│   │   ├── not-found.tsx          # 404 page
│   │   └── loading.tsx            # Global loading fallback
│   ├── components/
│   │   ├── layout/                # Sidebar, Header, AppShell
│   │   └── ui/                    # Button, Input, CurrencyInput, Card, Badge, EmptyState, etc.
│   ├── config/
│   │   └── env.ts                 # Centralized Zod environment validation
│   ├── lib/
│   │   ├── money.ts               # Enterprise Decimal.js Money class
│   │   ├── date.ts                # Asia/Kolkata business date utilities
│   │   ├── formatters.ts          # INR currency & Indian number grouping
│   │   ├── logger.ts              # Structured server logger with secret redaction
│   │   ├── errors.ts              # AppError hierarchy & client-safe error formatter
│   │   └── db.ts                  # Prisma Client singleton & connection pool
│   └── types/
│       └── index.ts               # Shared domain interfaces & enums
├── tests/
│   ├── money.test.ts              # 5 decimal precision & currency tests
│   └── date.test.ts               # 3 date formatting & parsing tests
├── .env.example                   # Secure environment template
├── next.config.ts                 # Next.js configuration with security headers
├── tailwind.config.ts             # Tailwind CSS tokens
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## 7. Security & Accounting Principles

1. **No Float Arithmetic**: All accounting figures are computed through `Money` (`Decimal.js`) and stored as `DECIMAL(15,2)` in PostgreSQL.
2. **Zero Fake Data**: The application starts in a verified, clean production state without sample mock records.
3. **Information Disclosure Prevention**: Error boundaries and the `/api/health` endpoint sanitize all sensitive metadata, stack traces, and database credentials before returning responses.
4. **Security Headers**: Configured in `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`).
5. **Secret Redaction in Logs**: Server logger automatically filters passwords, authorization tokens, and API keys.

---

## 8. Verification Results

- **Automated Tests**: 8/8 tests passed (`npm test`)
- **TypeScript**: 0 errors (`npm run typecheck`)
- **ESLint**: 0 errors / 0 warnings (`npm run lint`)
- **Production Build**: 25/25 routes pre-rendered successfully (`npm run build`)

---

## 9. Next Step: Proceeding to Phase 2

Once confirmed with `"Phase 1 Completed, Next"`, we will begin:
**PHASE 2 — Production Database Schema, Accounting Data Model, Security & Row-Level Access**
