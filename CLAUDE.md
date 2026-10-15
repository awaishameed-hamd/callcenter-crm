# CallCenter CRM — Project Context

## Project Overview
A Call Center CRM built with Laravel 12 (PHP) backend + React (Vite) frontend + MySQL database.
- Backend: `C:\Users\HP\callcenter-crm\` (Laravel 12, PHP, Sanctum token auth)
- Frontend: `C:\Users\HP\frontend\` (React + Vite + Tailwind CSS)
- Database: MySQL (local), running via MySQL97 service

## Running the Project Locally
```bash
# Terminal 1 — Laravel backend (port 8000)
cd C:\Users\HP\callcenter-crm
C:\php\php.exe artisan serve

# Terminal 2 — React frontend (port 5173)
cd C:\Users\HP\frontend
npm run dev
```

## Role Hierarchy
admin > director > manager > agent

## Authentication
- Laravel Sanctum token auth (Bearer token)
- Token stored in sessionStorage (tab-specific, not localStorage)
- No CSRF / statefulApi needed

## Customer Approval Pipeline (2-stage)
pending → approved (by manager) → final_approved (by director/admin)
pending → disapproved (by manager)
approved → final_disapproved (by director/admin)

## Role Permissions
- agent: submit sales only (own records only)
- manager: approve/reject pending sales, see all records
- director: final approve/reject manager-approved sales, see all records + company names + rates
- admin: same as director + user/client management

## Key Business Rules
- Only agents can submit sales (CustomerController@store has role check)
- customer_code format: C-0000001 (generated from auto-increment ID after insert)
- DID masking: agents/managers see DID code only, directors/admins see company name too
- Vertical → Campaign mapping: Medicare, Final Expense, ACA, Other
- Reason of Cancellation options: XFER, No LA, Ringing, Over Age, Out of State, Hangup, No medicare card

## Database Notes
- MySQL only — no file storage
- Scale: 100+ agents, 10k+ records/day, long-term
- Indexes on customers table for performance
- agent_id = who submitted the sale, manager_id = who approved it

## API Endpoints (all under /api, auth:sanctum middleware)
- POST /auth/login, POST /auth/logout, GET /auth/me
- GET/POST /customers, PUT /customers/{id}
- POST /customers/{id}/approve (manager/director/admin)
- POST /customers/{id}/reject (manager/director/admin)
- POST /customers/{id}/final-approve (director/admin)
- POST /customers/{id}/final-reject (director/admin)
- GET /clients/dropdown?campaign=X
- GET /reports, GET /reports/export
- GET /dashboard/stats?period=daily|weekly|monthly|overall

## Frontend Structure (C:\Users\HP\frontend\src\)
- pages/Login.jsx
- pages/Dashboard.jsx
- pages/agent/NewSale.jsx
- pages/agent/MySales.jsx
- pages/Approvals.jsx (manager + director + admin)
- pages/Reports.jsx
- components/Sidebar.jsx
- components/Layout.jsx
- components/Toast.jsx
- context/AuthContext.jsx (sessionStorage-based auth)
- api/axios.js (Bearer token interceptor)

## Backend Structure (C:\Users\HP\callcenter-crm\)
- app/Http/Controllers/AuthController.php
- app/Http/Controllers/CustomerController.php
- app/Http/Controllers/ClientController.php
- app/Http/Controllers/DashboardController.php
- app/Http/Controllers/ReportsController.php
- app/Http/Controllers/UserController.php
- routes/api.php

## Test Credentials
- admin / Admin@123
- D001 (Director) / Director@123
- M001 (Manager) / Manager@123
- A002 (Agent) / Test@1234

## What's Built So Far
- Full auth system with role-based routing
- Agent: New Sale form (vertical-first, DID filtered by vertical), My Sales list
- Manager: Approvals (pending queue), approve/reject with required Reason of Cancellation
- Director/Admin: Approvals (final approve/reject), Reports with filters + CSV export
- Dashboard with stats (total/approved/pending/rejected) + recent sales
- User management (admin/director)
- Client/DID management (admin/director)
- Reports with filters: date range, status, vertical, agent, DID, client

## What Still Needs to Be Built
- Dashboard charts (daily trend, approval rate, agent leaderboard)
- Better dashboard UI/design
- (add more here as features are requested)
