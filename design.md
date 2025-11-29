# design.md – Tally MVP UI/UX Design

## 1. Design Principles

- **Desktop-first:** Primary users are accountants using laptops/desktop monitors.
- **Clarity over cleverness:** Data-dense views, minimal visual noise, clear hierarchy.
- **Trust & professionalism:** Conservative, “finance-grade” look and feel.
- **Fast paths to value:** User must go from upload → issues → report in as few clicks as possible.

We use **Ant Design (antd)** as the primary component library.

## 2. Layout & Navigation

- Global layout: `Layout` with `Sider` (left nav), `Header`, `Content`.
- `Sider` menu items:
  - Dashboard
  - Clients
  - Batches (optional)
  - Reports (optional)
  - Settings
- `Header`:
  - Organisation name
  - User avatar menu (profile, logout)
- Use `Breadcrumb` in `Content` to show context (e.g. `Clients / ACME Ltd / April 2025`).

## 3. Screens

### 3.1 Login

- Components: `Card`, `Form`, `Input`, `Input.Password`, `Button`, `Alert`.
- Layout: Centered `Card` with logo and tagline.
- Minimal friction: email + password, “Forgot password” link.

### 3.2 Dashboard (Practice Overview)

- Components: `PageHeader`, `Row`/`Col`, `Card`, `Table`, `Tag`, `Badge`, `Button`.
- Top row: KPI cards:
  - Total Clients
  - Employees processed (recent period)
  - Open Critical Issues
- Below: `Table` of clients:
  - Columns: Name, Country, Payroll System, Last Batch Date, Issues (critical/warning/info), Actions (`Upload`, `View`).
- Actions should be 1-click to upload or review.

### 3.3 Client Detail

- Components: `PageHeader`, `Descriptions`, `Tabs`, `Table`, `Button`.
- `PageHeader`:
  - Client name
  - Country tag
  - Primary action: “Upload batch”
- `Descriptions`: key info (pay schedule, payroll system).
- `Tabs`:
  - Overview (latest batch summary, count of issues).
  - Batches (table of past batches with date, period, employee count, issues, status).

### 3.4 Upload Batch

- Components: `Modal` **or** dedicated page, `Form`, `Select`, `Upload.Dragger`, `Progress`, `Result`.
- Fields:
  - Period label (string or month/year).
  - Optional notes.
- Flow:
  - User drags & drops PDFs/ZIP into `Upload.Dragger`.
  - Show per-file or aggregate `Progress`.
  - On success, show `Result` with “Go to batch review” CTA.

### 3.5 Batch Review

- Components: `PageHeader`, `Row`/`Col`, `Card`, `Alert`, `Table`, `Tag`, `Badge`, `Button`, `Segmented` or table filters.
- Summary cards:
  - Employees processed
  - Critical issues count
  - Warnings count
- Table of employees:
  - Employee name
  - Employee ref
  - Issues summary (e.g. “2 Critical, 1 Warning” via `Tag`s)
  - Net pay change (%)
  - Action: “View details” (navigates to employee view or opens `Drawer`).

### 3.6 Employee Payslip Comparison

- Components: `Drawer` or page, `Tabs`, `Descriptions`, `Statistic`, `Table`, `List`, `Tag`, `Button`, `Comment`.
- Layout:
  - Header: Employee name, client, period, severity badge.
  - Two-column summary:
    - Current period metrics.
    - Previous period metrics + change (use `Statistic` with up/down indication).
  - Table of field-level differences:
    - Field, previous value, current value, % change, severity tag.
  - List of issues:
    - Each issue: severity `Tag`, short description, “Mark as resolved”, “Add note”.
- Resolved issues appear visually muted.

### 3.7 Report Export

- Components: `Modal` or page, `Form`, `Checkbox`, `Button`, `Result`.
- Options:
  - Include resolved issues?
  - Include info-level issues?
- Actions:
  - Download CSV
  - Download PDF (or open PDF-styled HTML for printing).

### 3.8 Settings & User Management

- Components: `Tabs`, `Table`, `Form`, `Select`, `Switch`, `Modal`.
- Users tab:
  - Table of users with email, role, status.
  - “Invite user” button → `Modal` with email + role.
- (Future) Integrations tab (V2+).

## 4. Visual Style

- Typography: clean sans-serif (e.g. Inter).
- Colour palette:
  - Primary: deep blue/navy for headers and buttons.
  - Background: light grey (`#f5f5f5`) for app background, white cards.
  - Status colours:
    - Critical: red (`#ff4d4f`)
    - Warning: orange (`#fa8c16`)
    - Info/OK: blue/green (`#52c41a` / `#1890ff`)
- Spacing: base 8px grid; consistent `padding`/`margin` using Ant Design `Row`/`Col`.

## 5. UX Considerations

- Always show **context**: client name, period, and user’s current location.
- Minimise friction:
  - Upload flow should not require many fields.
  - Default filters show “Critical & Warning” issues first.
- Provide clear empty states using `Empty` (no batches, no issues).
- Use `Spin` and `Skeleton` to handle loading gracefully.

## 6. Non-Goals (Design MVP)

- No mobile-specific layouts.
- No theme switching (dark mode).
- No visual customisation per client beyond logo (future).
