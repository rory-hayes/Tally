"use client";

import { useEffect, useMemo, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import type { ClientCreateInput } from "@/lib/repositories/clients";

type ClientFormValues = ClientCreateInput;

type ClientFormModalProps = {
  open: boolean;
  initialValues?: ClientFormValues;
  title: string;
  onCancel: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
};

const countryOptions = [
  { label: "Ireland", value: "IE" },
  { label: "United Kingdom", value: "UK" },
];

export function ClientFormModal({
  open,
  initialValues,
  title,
  onCancel,
  onSubmit,
}: ClientFormModalProps) {
  const [form] = Form.useForm<ClientFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const formInitialValues = useMemo(
    () => ({ ...(initialValues ?? {}) }),
    [initialValues]
  );

  useEffect(() => {
    if (open) {
      form.setFieldsValue(formInitialValues);
    } else {
      form.resetFields();
    }
  }, [open, formInitialValues, form]);

  const handleFinish = async (values: ClientFormValues) => {
    setSubmitting(true);
    try {
      const payload: ClientFormValues = { ...values };
      const payrollSystem = payload.payroll_system?.trim();
      if (payrollSystem) {
        payload.payroll_system = payrollSystem;
      } else {
        delete payload.payroll_system;
      }
      await onSubmit(payload);
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText="Save"
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={formInitialValues}
        onFinish={handleFinish}
      >
        <Form.Item
          label="Client name"
          name="name"
          rules={[{ required: true, message: "Enter the client name" }]}
        >
          <Input placeholder="Eg. ACME Advisory" />
        </Form.Item>
        <Form.Item
          label="Country"
          name="country"
          rules={[{ required: true, message: "Select country" }]}
        >
          <Select
            placeholder="Select country"
            options={countryOptions}
            showSearch
            optionFilterProp="label"
            onChange={(value) => {
              form.setFieldValue("country", value ?? null);
            }}
          />
        </Form.Item>
        <Form.Item label="Payroll system" name="payroll_system">
          <Input placeholder="Eg. Sage" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
