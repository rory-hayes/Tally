# design.md – Tally UI/UX Design (MVP + Future Rule Configuration)

## 1. Design Principles

- **Desktop-first:** Accountants work primarily on large monitors.
- **Data clarity:** Tables, diffs, and ledger-style layouts must be crisp and legible.
- **Professional trust:** Conservative styling with predictable UI patterns.
- **Efficiency:** Users should move quickly from upload → anomalies → resolution → export.

Using **Ant Design** as the UI framework ensures consistency, proven components, and accessibility.

---

## 2. Layout & Navigation

### Global Layout

- `Sider` (left): Dashboard, Clients, Settings, (future: Reports, Templates)
- `Header`: Organisation name, user avatar menu
- `Content`: Page body with breadcrumbs

### Breadcrumb Examples
- `Dashboard`
- `Clients / ACME Ltd`
- `Clients / ACME Ltd / April 2025`

---

## 3. Screens (MVP)

### 3.1 Login
Simple, secure login.

### 3.2 Dashboard
Shows high-level practice metrics.

### 3.3 Client Detail
Shows client metadata and historical payroll runs.

### 3.4 Upload Batch
Drag-and-drop; minimal friction.

### 3.5 Batch Review
- Summary cards
- Issues by severity
- Employee table with diffs

### 3.6 Employee Payslip Comparison
- Side-by-side previous/current
- Field-level diffs
- Issues list with resolve/note actions

### 3.7 Report Export
Export PDF/CSV.

### 3.8 Settings (Org-Level)
User management, future integrations.

---

## 4. Screens (Post-MVP Rule Engine)

### 3.9 Client Settings – Rules & Configuration

A dedicated tab on each client:

#### Sections:

**A. General**
- Country (IE/UK)
- Default tax year
- Pay frequency
- Payroll system

**B. Rule Packs**
- IE/UK core tax rules  
- Reconciliation packs (register / GL / bank / submissions)
- Contract compliance pack

**C. Thresholds & Sensitivity**
- Large net/gross change (%)
- Rounding tolerance
- Pension % threshold
- Noise suppression filters

**D. Data Source Toggles**
- Use register reconciliation?
- Use GL reconciliation?
- Use bank payments?
- Use ROS/RTI?

**E. Advanced**
- Rule whitelists/blacklists
- Severity overrides
- Reset-to-defaults button

#### UI Components
- `Tabs`, `Collapse`, `Form`, `Select`, `Switch`, `Slider`, `InputNumber`

#### UX Notes
- Highlight deviations from org defaults ("Custom" badge)
- Keep advanced options behind collapsibles
- Avoid overwhelming users

---

## 5. Visual Style

- Typography: Inter (or similar)
- Primary colour: deep navy
- Background: `#f5f5f5`
- Severity colours:
  - Critical → red (`#ff4d4f`)
  - Warning → orange (`#fa8c16`)
  - Info → blue (`#1890ff`)
- 8px spacing grid

---

## 6. UX Considerations

- Always show context: client name, pay period, employee name
- Keep empty/loading states friendly (AntD Empty, Skeleton, Spin)
- Default to “Critical/Warning” filter in review screens
- Provide high-quality diff visualisation

---

## 7. Non-Goals (for Now)

- Mobile UI  
- Client-level theme customization  
- Full payroll or HR workflow  
- Drag-and-drop rules editor (future)  

---

## 8. New Navigation & Screens (2025 QA fixes)

- **Sidebar** now includes a “Data sources” group with: Contracts & HR, Payroll register, GL payroll postings, Bank payments, Revenue/HMRC submissions, plus “Rules & Settings”.  
- Use consistent Ant Design patterns: `Card` + vertical `Form`, `Upload.Dragger`, `Select` for client/batch selection, progress/alerts for failures.

### 8.1 Data Source Upload Patterns
- Always require client (and batch where applicable).  
- Validate file type/size; show template CSV snippet inline.  
- Surface help text about OCR/CSV expectations and sandbox file paths.  
- Success toast only after Edge Function returns 200.

### 8.2 Settings / Rules Config
- Form-driven, grouped into thresholds, rule packs, severity overrides, enrichment.  
- Show severity model + golden dataset previews in collapsibles.  
- “Reset to defaults” removes client override row; “Save” upserts into `client_rule_config`.

### 8.3 Batch Review Improvements
- Status tag colours: completed (green), processing (blue), failed (red), pending (gold).  
- Buttons: Download CSV, View report (printable window), Retry failed, Delete batch.  
- Failed jobs alert includes remediation guidance; upload dragger shows accepted formats and size limits.
