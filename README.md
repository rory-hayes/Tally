# Tally – Automated Payroll Verification & Reconciliation Platform

Tally is a B2B SaaS platform for accounting firms and payroll bureaus in Ireland and the UK.  
It automates the verification of payroll outputs through OCR extraction, anomaly detection, and reconciliation against previous periods and external payroll artefacts.

Tally does **not** compute payroll—it audits it.

---

## 1. Problem

Accountants and payroll bureaus manually verify:

- Payslips  
- Payroll system reports  
- GL postings  
- Bank payment files  
- Revenue/HMRC submissions  

This is slow, error-prone, unbillable, and risky.  
Payroll errors cause compliance issues, tax exposure, and unhappy employees.

---

## 2. Solution

Tally provides a **single automated verification layer** that:

1. Reads payslips via OCR (AWS Textract)  
2. Normalises data across payroll systems  
3. Compares each employee to their prior periods  
4. Applies jurisdiction-specific rules (IE/UK)  
5. Reconciles with accounting, payment files, and statutory submissions  
6. Generates actionable issues  
7. Produces audit-ready reports  

Accounting firms gain:

- 70–90% time savings  
- Lower compliance risk  
- Higher audit quality  
- A scalable workflow they can standardise across clients  

---

## 3. Core Features (MVP)

### A. Upload & Processing
- Multi-tenant org + clients  
- Batch upload (PDFs/ZIP)  
- Supabase Storage + Edge Functions  
- Cron-driven OCR pipeline  
- Employee identity resolution  
- Payslip extraction + normalisation  

### B. Rules Engine (MVP Set)
- Large gross/net changes  
- Tax spikes without gross movement  
- USC/NI anomalies  
- YTD regressions  
- Pension threshold breaches  
- PRSI/NI category changes  

### C. Review UI
- Batch-level summaries  
- Employee-level comparisons  
- Diff visualisation  
- Issue resolution  
- CSV/PDF exports  

---

## 4. Extended Rules Engine (IE/UK)

### Ireland (Revenue)
- PAYE recalculation  
- USC recalculation  
- PRSI class verification  
- Illness Benefit handling  
- LPT deduction checks  
- BIK/PSA consistency  
- Year-end & cumulative basis handling  

### UK (HMRC)
- PAYE tax code-based calculation  
- NIC recalculation across categories  
- Student loans / PG loans  
- Auto-enrolment contributions  
- National Minimum Wage compliance  
- RTI submission reconciliation  

---

## 5. Additional Reconciliation Sources

- Payroll Register (Gross-to-Net)  
- General Ledger (GL) postings  
- Bank payment files (SEPA/BACS)  
- ROS (Ireland) and RTI (UK) submission summaries  

These allow Tally to evolve into a **full payroll audit and reconciliation platform**.

---

## 6. Architecture Summary

### Frontend
- Next.js + React  
- Ant Design  
- Vercel deployment  

### Backend
- Supabase Postgres (multi-tenant schema)  
- Supabase Auth (user identities)  
- Supabase Storage (payslips)  
- Edge Functions (processing, ingestion, rules engine integration)  
- Cron scheduling  

### OCR
- AWS Textract via secure Edge Function calls  

### Pure Logic Modules
- Normalisation  
- Diff engine  
- Rule engine (registry + config + jurisdiction packs)  

---

## 7. Workflow (End-to-End)

1. Create organisation → add clients  
2. Upload payslips for a payroll period  
3. Supabase stores files → batch created  
4. Processing jobs seeded  
5. Cron pipeline runs:
   - OCR → normalise → insert payslips  
   - Load previous payslip → calculate diff  
   - Run rules engine → generate issues  
6. User reviews issues  
7. User resolves, adds notes, or corrects in payroll system  
8. Reports exported  
9. Advanced users upload register, GL, bank, or RTI/ROS files  
10. Reconciliation rules applied  
11. Tally provides full audit and compliance picture  

---

## 8. Rule Engine Architecture

- Rule Registry (data-driven definitions)  
- Country/year-aware rule loading  
- RuleConfig merging (country defaults → org defaults → client overrides)  
- Pure evaluation (`evaluate(context)`)  
- IssueCandidate outputs with structured evidence  
- Golden test dataset ensures behaviour stability  

---

## 9. Roadmaps

### MVP Roadmap
Documented in `roadmap.html`.

### Rules Engine Roadmap
Documented in `tally_rules_engine_roadmap.html`.

These roadmap files define the exact Cursor prompts, Definition of Done, and test expectations for each engineering milestone.

---

## 10. Future Expansion

- Multi-country support (EU + US)  
- API for payroll providers ("Tally Inside")  
- Employee portal for personal payroll insights  
- Predictive anomaly detection (ML layer)  
- Firm-level dashboards and benchmarking  

---

## 11. Development Expectations

- TDD as standard  
- Pure logic modules must be deterministic and fully tested  
- No business rules hard-coded into UI  
- Multi-tenancy enforced at all layers  
- Secrets only in Edge Functions  
- Changes must update docs where relevant (`agent.md`, `architecture.md`, `design.md`, roadmaps)

---

# Summary

You now have:

### ✔ agent.md — rules for Cursor & AI assistants  
### ✔ architecture.md — technical system blueprint (MVP + extended)  
### ✔ design.md — UI/UX coverage including future rule settings  
### ✔ readme.md — full product description and master narrative  

If you want, I can also generate:

- `client_rule_config.sql` schema  
- A full ERD diagram  
- A visual flowchart of the processing pipeline  
- A single consolidated “developer onboarding doc”  

Just tell me.
