import { afterEach, describe, it, expect } from "vitest";
import { buildIssuesForPayslip } from "@/supabase/functions/process_batch/rules";
import {
  __dangerousSetRuleDefinitionsForTesting,
  type RuleDefinition,
} from "@/lib/rules/registry";

const basePayslip = {
  id: "current",
  organisation_id: "org",
  client_id: "client",
  batch_id: "batch",
  employee_id: "emp",
  gross_pay: 3000,
  net_pay: 2100,
  paye: 500,
  usc_or_ni: 120,
  pension_employee: 150,
  pension_employer: 150,
  ytd_gross: 15000,
  ytd_net: 12000,
  ytd_tax: 3000,
  ytd_usc_or_ni: 600,
  prsi_or_ni_category: "A1",
};

const capture = (overrides: Partial<typeof basePayslip>, prevOverrides?: Partial<typeof basePayslip>) => {
  const previous = { ...basePayslip, id: "prev", ...prevOverrides };
  const current = { ...basePayslip, ...overrides };
  return buildIssuesForPayslip(current, previous);
};

afterEach(() => {
  __dangerousSetRuleDefinitionsForTesting();
});

describe("buildIssuesForPayslip", () => {
  it("generates issue rows for large net change", () => {
    const issues = capture({ net_pay: 2600 }, { net_pay: 2000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("NET_CHANGE_LARGE");
  });

  it("flags large gross pay shifts", () => {
    const issues = capture({ gross_pay: 3900 }, { gross_pay: 3000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("GROSS_CHANGE_LARGE");
  });

  it("detects tax spike without gross change", () => {
    const issues = capture({ paye: 900 }, { paye: 600, gross_pay: 3000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("TAX_SPIKE_WITHOUT_GROSS");
  });

  it("includes structured data payloads for tax spikes", () => {
    const issues = capture({ paye: 900 }, { paye: 600, gross_pay: 3000 });
    const taxIssue = issues.find((issue) => issue.rule_code === "TAX_SPIKE_WITHOUT_GROSS");
    expect(taxIssue?.data).toMatchObject({
      field: "paye",
      previousValue: 600,
      currentValue: 900,
      difference: 300,
    });
  });

  it("surfaces YTD regressions", () => {
    const issues = capture({ ytd_net: 10000 }, { ytd_net: 12000 });
    expect(issues.map((issue) => issue.rule_code)).toContain("YTD_REGRESSION");
  });

  it("detects PRSI/NI category changes", () => {
    const current = { ...basePayslip, prsi_or_ni_category: "B1" };
    const issues = buildIssuesForPayslip(current, { ...basePayslip, id: "prev", prsi_or_ni_category: "A1" });
    expect(issues.map((issue) => issue.rule_code)).toContain("PRSI_CATEGORY_CHANGE");
  });

  it("EMP003 triggers USC spike rule", () => {
    const issues = capture({ usc_or_ni: 220, gross_pay: 3050 }, { usc_or_ni: 139.5, gross_pay: 3000 });
    const uscIssue = issues.find((issue) => issue.rule_code === "USC_SPIKE_WITHOUT_GROSS");
    expect(uscIssue?.description).toMatch(/USC\/NI increased by \+57\.7%/i);
  });

  it("EMP005 triggers pension threshold rules", () => {
    const issues = capture({ gross_pay: 3200, pension_employee: 320, pension_employer: 400 }, null);
    expect(issues.map((issue) => issue.rule_code)).toEqual(
      expect.arrayContaining(["PENSION_EMPLOYEE_HIGH", "PENSION_EMPLOYER_HIGH"])
    );
  });

  it("returns empty array when no rules triggered", () => {
    const issues = buildIssuesForPayslip(basePayslip, { ...basePayslip, id: "prev" });
    expect(issues).toHaveLength(0);
  });

  it("selects rule packs by country", () => {
    const definitions: RuleDefinition[] = [
      {
        code: "NET_CHANGE_LARGE",
        descriptionTemplate: "IE rule",
        severity: "warning",
        categories: [],
        appliesTo: { countries: ["IE"] },
        evaluate: () => ({ description: "IE triggered" }),
      },
      {
        code: "GROSS_CHANGE_LARGE",
        descriptionTemplate: "UK rule",
        severity: "warning",
        categories: [],
        appliesTo: { countries: ["UK"] },
        evaluate: () => ({ description: "UK triggered" }),
      },
    ];
    __dangerousSetRuleDefinitionsForTesting(definitions);

    const ieIssues = buildIssuesForPayslip(
      { ...basePayslip, clients: { country: "IE" } },
      null
    );
    expect(ieIssues.map((issue) => issue.rule_code)).toEqual(["NET_CHANGE_LARGE"]);

    const ukIssues = buildIssuesForPayslip(
      { ...basePayslip, clients: { country: "UK" } },
      null
    );
    expect(ukIssues.map((issue) => issue.rule_code)).toEqual(["GROSS_CHANGE_LARGE"]);
  });
});

