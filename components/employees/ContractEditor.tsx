"use client";

import { useEffect } from "react";
import { Card, Form, Input, InputNumber, Select, Space, Button, Alert } from "antd";
import { useEmployeeContract } from "@/hooks/useEmployeeContract";

type ContractEditorProps = {
  employeeId: string;
};

const salaryPeriodOptions = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

export function ContractEditor({ employeeId }: ContractEditorProps) {
  const { status, data, error, save } = useEmployeeContract(employeeId);
  const [form] = Form.useForm();

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        salary_amount: data.salary_amount ?? undefined,
        salary_period: data.salary_period ?? undefined,
        hourly_rate: data.hourly_rate ?? undefined,
        standard_hours_per_week: data.standard_hours_per_week ?? undefined,
        effective_from: data.effective_from ?? undefined,
        effective_to: data.effective_to ?? undefined,
      });
    }
  }, [data, form]);

  const onSubmit = async () => {
    const values = form.getFieldsValue();
    await save({
      salary_amount: values.salary_amount ?? null,
      salary_period: values.salary_period ?? null,
      hourly_rate: values.hourly_rate ?? null,
      standard_hours_per_week: values.standard_hours_per_week ?? null,
      effective_from: values.effective_from || null,
      effective_to: values.effective_to || null,
    });
  };

  return (
    <Card title="Contract details" size="small">
      {status === "error" && error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ salary_period: "annual" }}
        onFinish={onSubmit}
        autoComplete="off"
      >
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          <Form.Item label="Salary amount" name="salary_amount">
            <InputNumber min={0} style={{ width: "100%" }} prefix="€" />
          </Form.Item>
          <Form.Item label="Salary period" name="salary_period">
            <Select options={salaryPeriodOptions} allowClear />
          </Form.Item>
          <Form.Item label="Hourly rate" name="hourly_rate">
            <InputNumber min={0} style={{ width: "100%" }} prefix="€" />
          </Form.Item>
          <Form.Item label="Standard hours per week" name="standard_hours_per_week">
            <InputNumber min={0} max={80} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Effective from" name="effective_from">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Effective to" name="effective_to">
            <Input type="date" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={status === "loading"}>
              Save contract
            </Button>
          </Form.Item>
        </Space>
      </Form>
    </Card>
  );
}
