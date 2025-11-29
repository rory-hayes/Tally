"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { createOrganisationWithProfile } from "@/lib/repositories/profiles";

type FormValues = {
  organisationName: string;
};

type Props = {
  onSuccess?: () => void;
};

export function CreateOrganisationForm({ onSuccess }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      if (!values.organisationName) {
        setError("Please enter an organisation name.");
        return;
      }
      await createOrganisationWithProfile(values.organisationName.trim());
      form.resetFields();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create organisation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ organisationName: "" }}
    >
      {error && (
        <Alert
          type="error"
          title="Setup failed"
          description={error}
          showIcon
          style={{ marginBottom: "1rem" }}
        />
      )}
      <Form.Item
        label="Organisation name"
        name="organisationName"
        rules={[{ required: true, message: "Enter your organisation name" }]}
      >
        <Input placeholder="Eg. ACME Advisory" autoComplete="organization" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting}
        >
          Continue
        </Button>
      </Form.Item>
    </Form>
  );
}

