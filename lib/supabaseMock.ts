type TableName =
  | "profiles"
  | "clients"
  | "batches"
  | "payslips"
  | "issues"
  | "processing_jobs"
  | "contracts";

type Filter = (row: any) => boolean;

type OrderBy = { field: string; ascending: boolean; foreignTable?: string };

const randomId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const defaultData: Record<TableName, any[]> = {
  profiles: [
    { id: "user-1", organisation_id: "org-1", role: "admin", email: "test@practice.com" },
  ],
  clients: [
    {
      id: "client-1",
      organisation_id: "org-1",
      name: "ACME Ltd",
      country: "IE",
      payroll_system: "BrightPay",
    },
  ],
  batches: [
    {
      id: "batch-1",
      organisation_id: "org-1",
      client_id: "client-1",
      period_label: "2025-02",
      created_at: new Date("2025-02-28").toISOString(),
      status: "completed",
      error: null,
      total_files: 2,
      processed_files: 2,
    },
  ],
  payslips: [
    {
      id: "pay-1",
      organisation_id: "org-1",
      client_id: "client-1",
      batch_id: "batch-1",
      employee_id: "emp-1",
      pay_date: "2025-02-28",
      gross_pay: 3300,
      net_pay: 2205,
      paye: 660,
      usc_or_ni: 150,
      pension_employee: 180,
      pension_employer: 210,
      ytd_gross: 18300,
      ytd_net: 14205,
      ytd_tax: 3660,
      ytd_usc_or_ni: 850,
      prsi_or_ni_category: "A1",
    },
    {
      id: "pay-2",
      organisation_id: "org-1",
      client_id: "client-1",
      batch_id: "batch-1",
      employee_id: "emp-2",
      pay_date: "2025-02-28",
      gross_pay: 2800,
      net_pay: 1900,
      paye: 520,
      usc_or_ni: 120,
      pension_employee: 140,
      pension_employer: 160,
      ytd_gross: 16500,
      ytd_net: 12000,
      ytd_tax: 3000,
      ytd_usc_or_ni: 700,
      prsi_or_ni_category: "A1",
    },
  ],
  issues: [
    {
      id: "issue-1",
      organisation_id: "org-1",
      client_id: "client-1",
      batch_id: "batch-1",
      employee_id: "emp-1",
      payslip_id: "pay-1",
      rule_code: "NET_CHANGE_LARGE",
      severity: "warning",
      description: "Net pay change exceeds threshold",
      data: { percentChange: 10 },
      resolved: false,
      note: null,
      created_at: new Date("2025-03-01").toISOString(),
    },
  ],
  processing_jobs: [],
  contracts: [],
};

class MockQueryBuilder {
  private filters: Filter[] = [];
  private orderBy: OrderBy | null = null;
  private limitCount: number | null = null;
  private tempRows: any[] | null = null;
  private foreignLimit: { foreignTable: string; limit: number } | null = null;
  private selectColumns: string | null = null;

  constructor(
    private table: TableName,
    private data: Record<TableName, any[]>,
    private getUserId: () => string | null
  ) {}

  private applyFilters(rows: any[]) {
    return this.filters.reduce((current, filter) => current.filter(filter), rows);
  }

  private applyOrder(rows: any[]) {
    if (!this.orderBy) return rows;
    const { field, ascending } = this.orderBy;
    return [...rows].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      return ascending ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });
  }

  private applyLimit(rows: any[]) {
    if (this.limitCount === null) return rows;
    return rows.slice(0, this.limitCount);
  }

  private attachRelations(rows: any[]) {
    if (this.table === "clients" && this.selectColumns?.includes("batches")) {
      return rows.map((row) => {
        const batches = this.data.batches
          .filter((b) => b.client_id === row.id)
          .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
        const limited = this.foreignLimit ? batches.slice(0, this.foreignLimit.limit) : batches;
        return { ...row, batches: limited };
      });
    }
    return rows;
  }

  select(columns: string | undefined) {
    this.selectColumns = columns ?? null;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row?.[field] === value);
    return this;
  }

  order(field: string, options?: { ascending?: boolean; foreignTable?: string }) {
    this.orderBy = {
      field,
      ascending: options?.ascending !== false,
      foreignTable: options?.foreignTable,
    };
    return this;
  }

  limit(count: number, options?: { foreignTable?: string }) {
    if (options?.foreignTable) {
      this.foreignLimit = { foreignTable: options.foreignTable, limit: count };
      return this;
    }
    this.limitCount = count;
    return this;
  }

  async single() {
    const rows = this.tempRows ?? this.run();
    const first = rows[0];
    if (!first) {
      return { data: null, error: { message: "Row not found", code: "PGRST116" } };
    }
    return { data: first, error: null };
  }

  async maybeSingle() {
    const rows = this.tempRows ?? this.run();
    return { data: rows[0] ?? null, error: null };
  }

  async selectOnly() {
    this.tempRows = this.run();
    return this;
  }

  async then(resolve: (value: any) => void) {
    const rows = this.run();
    resolve({ data: rows, error: null });
  }

  async insert(payload: any) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted = rows.map((row) => (row.id ? row : { ...row, id: randomId(this.table) }));
    this.data[this.table].push(...inserted);
    this.tempRows = inserted;
    return this;
  }

  async update(values: Record<string, unknown>) {
    const rows = this.run();
    rows.forEach((row) => Object.assign(row, values));
    this.tempRows = rows;
    return this;
  }

  async delete() {
    const rows = this.run();
    const ids = new Set(rows.map((r) => r.id));
    this.data[this.table] = this.data[this.table].filter((row) => !ids.has(row.id));
    this.tempRows = [];
    return { data: null, error: null };
  }

  async selectReturn() {
    return { data: this.run(), error: null };
  }

  async insertReturn() {
    return { data: this.tempRows ?? [], error: null };
  }

  private run() {
    const baseRows = this.applyFilters(this.data[this.table]);
    const ordered = this.applyOrder(baseRows);
    const limited = this.applyLimit(ordered);
    return this.attachRelations(limited);
  }
}

export const createMockSupabaseClient = (seed?: Partial<Record<TableName, any[]>>) => {
  const data: Record<TableName, any[]> = {
    profiles: [...defaultData.profiles],
    clients: [...defaultData.clients],
    batches: [...defaultData.batches],
    payslips: [...defaultData.payslips],
    issues: [...defaultData.issues],
    processing_jobs: [...defaultData.processing_jobs],
    contracts: [...defaultData.contracts],
    ...(seed ? Object.fromEntries(Object.entries(seed).map(([k, v]) => [k as TableName, v])) : {}),
  } as Record<TableName, any[]>;

  let currentUser: { id: string; email: string } | null = null;
  const listeners = new Set<(event: string, session: any | null) => void>();

  const notify = (event: string) => {
    const session = currentUser ? { user: currentUser } : null;
    listeners.forEach((listener) => listener(event, session));
  };

  const auth = {
    async signInWithPassword({
      email,
    }: {
      email: string;
      password: string;
    }) {
      currentUser = { id: "user-1", email };
      notify("SIGNED_IN");
      return { data: { user: currentUser, session: { user: currentUser } }, error: null };
    },
    async signUp({
      email,
    }: {
      email: string;
      password: string;
    }) {
      currentUser = { id: "user-1", email };
      notify("SIGNED_UP");
      return { data: { user: currentUser, session: { user: currentUser } }, error: null };
    },
    async signOut() {
      currentUser = null;
      notify("SIGNED_OUT");
      return { error: null };
    },
    async getUser() {
      return { data: { user: currentUser }, error: null };
    },
    async getSession() {
      return { data: { session: currentUser ? { user: currentUser } : null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: any | null) => void) {
      listeners.add(callback);
      const subscription = {
        unsubscribe: () => listeners.delete(callback),
      };
      return { data: { subscription } };
    },
  };

  const client = {
    auth,
    from(table: TableName) {
      return new MockQueryBuilder(table, data, () => currentUser?.id ?? null);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "create_organisation_for_current_user") {
        const orgId = randomId("org");
        const profile = data.profiles.find((p) => p.id === currentUser?.id);
        if (profile) {
          profile.organisation_id = orgId;
        } else if (currentUser) {
          data.profiles.push({ id: currentUser.id, organisation_id: orgId, role: "admin" });
        }
        data.clients.push({
          id: randomId("client"),
          organisation_id: orgId,
          name: `${args.organisation_name ?? "New Org"} Client`,
          country: "IE",
          payroll_system: "BrightPay",
        });
        return { data: orgId, error: null };
      }
      return { data: null, error: { message: `RPC ${name} not implemented` } };
    },
    async storage() {
      return { from: () => ({ upload: async () => ({ data: null, error: null }) }) };
    },
  };

  return client;
};
